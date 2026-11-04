import os
import unittest
from decimal import Decimal

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SKIP_DEMO_SEED"] = "1"

from backend import app as backend


class CardRequestAndNotificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        backend.app.config["TESTING"] = True
        cls.client = backend.app.test_client()

    def setUp(self):
        with backend.app.app_context():
            backend.db.drop_all()
            backend.db.create_all()
            savings = backend.AccountType(
                account_type_id=1,
                type_name="SAVINGS",
                default_interest_rate=Decimal("0"),
            )
            customer = backend.Customer(
                customer_id=1,
                first_name="Casey",
                last_name="Customer",
                email="customer@example.com",
            )
            checking = backend.AccountType(
                account_type_id=2,
                type_name="CHECKING",
                default_interest_rate=Decimal("0"),
            )
            backend.db.session.add_all([savings, checking, customer])
            backend.db.session.flush()
            self.user = backend.AppUser(
                user_id=1,
                customer_id=customer.customer_id,
                username=customer.email,
                password_hash=backend.hash_password("customer123"),
                role="CUSTOMER",
            )
            self.teller = backend.AppUser(
                user_id=2,
                username="teller@example.com",
                password_hash=backend.hash_password("teller123"),
                role="TELLER",
            )
            self.admin = backend.AppUser(
                user_id=3,
                username="admin@example.com",
                password_hash=backend.hash_password("admin123"),
                role="ADMIN",
            )
            self.account = backend.BankAccount(
                account_id=1,
                customer_id=customer.customer_id,
                account_type_id=savings.account_type_id,
                account_number="111122223333",
                current_balance=Decimal("100.00"),
                interest_rate=Decimal("0"),
            )
            self.checking_account = backend.BankAccount(
                account_id=2,
                customer_id=customer.customer_id,
                account_type_id=checking.account_type_id,
                account_number="444455556666",
                current_balance=Decimal("100.00"),
                interest_rate=Decimal("0"),
            )
            backend.db.session.add_all([self.user, self.teller, self.admin, self.account, self.checking_account])
            backend.db.session.commit()
            self.headers = {"Authorization": f"Bearer {backend.make_token(self.user)}"}
            self.teller_headers = {"Authorization": f"Bearer {backend.make_token(self.teller)}"}
            self.admin_headers = {"Authorization": f"Bearer {backend.make_token(self.admin)}"}

    def test_cards_require_authentication(self):
        self.assertEqual(self.client.get("/api/cards").status_code, 401)

    def test_get_cards_returns_one_card_shared_by_savings_and_checking(self):
        response = self.client.get("/api/cards", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json), 1)

        card = response.json[0]
        self.assertEqual(len(card["cardNumber"]), 16)
        self.assertTrue(card["cardNumber"].startswith("5476"))
        self.assertEqual(len(card["cvv"]), 3)
        self.assertEqual(card["holder"], "Casey Customer")
        self.assertEqual(card["status"], "active")
        self.assertEqual(card["accountId"], "1")
        self.assertIn("expiresOn", card)

        again = self.client.get("/api/cards", headers=self.headers)
        self.assertEqual(again.json[0]["cardNumber"], card["cardNumber"])

        with backend.app.app_context():
            self.assertEqual(backend.BankCard.query.count(), 1)
            self.assertIsNone(
                backend.BankCard.query.filter_by(account_id=2).first()
            )

    def test_only_one_card_per_customer_with_multiple_savings_accounts(self):
        with backend.app.app_context():
            backend.db.session.add(
                backend.BankAccount(
                    account_id=3,
                    customer_id=1,
                    account_type_id=1,
                    account_number="777788889999",
                    current_balance=Decimal("0"),
                    interest_rate=Decimal("0"),
                )
            )
            backend.db.session.commit()

        response = self.client.get("/api/cards", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json), 1)

        again = self.client.get("/api/cards", headers=self.headers)
        self.assertEqual(len(again.json), 1)

        with backend.app.app_context():
            self.assertEqual(backend.BankCard.query.count(), 1)

    def test_card_request_goes_to_teller_and_approval_issues_card(self):
        submitted = self.client.post(
            "/api/requests",
            headers=self.headers,
            json={"accountId": "1", "type": "card"},
        )
        self.assertEqual(submitted.status_code, 201)
        self.assertEqual(submitted.json["type"], "card")
        self.assertEqual(submitted.json["status"], "pending")

        # Card request appears in the teller queue.
        queue = self.client.get("/api/teller/requests", headers=self.teller_headers)
        self.assertEqual(queue.status_code, 200)
        self.assertEqual(len(queue.json), 1)
        self.assertEqual(queue.json[0]["type"], "card")

        approved = self.client.post(
            "/api/teller/requests/1/approve",
            headers=self.teller_headers,
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json["status"], "approved")

        cards = self.client.get("/api/cards", headers=self.headers)
        self.assertEqual(cards.status_code, 200)
        self.assertEqual(len(cards.json), 1)

        with backend.app.app_context():
            self.assertEqual(backend.BankCard.query.count(), 1)

    def test_lost_card_goes_to_admin_and_approval_issues_replacement(self):
        self.client.get("/api/cards", headers=self.headers)

        submitted = self.client.post(
            "/api/requests",
            headers=self.headers,
            json={"accountId": "1", "type": "card_lost", "note": "Lost card reported"},
        )
        self.assertEqual(submitted.status_code, 201)
        self.assertEqual(submitted.json["type"], "card_lost")
        self.assertEqual(submitted.json["status"], "pending")

        duplicate = self.client.post(
            "/api/requests",
            headers=self.headers,
            json={"accountId": "1", "type": "card_lost"},
        )
        self.assertEqual(duplicate.status_code, 409)

        teller_queue = self.client.get("/api/teller/requests", headers=self.teller_headers)
        self.assertEqual(teller_queue.status_code, 200)
        self.assertEqual(teller_queue.json, [])

        admin_queue = self.client.get("/api/admin/card-requests", headers=self.admin_headers)
        self.assertEqual(admin_queue.status_code, 200)
        self.assertEqual(len(admin_queue.json), 1)
        self.assertEqual(admin_queue.json[0]["type"], "card_lost")

        approved = self.client.post(
            "/api/admin/card-requests/1/approve",
            headers=self.admin_headers,
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json["status"], "approved")

        with backend.app.app_context():
            self.assertEqual(backend.BankCard.query.count(), 2)
            self.assertEqual(
                backend.BankCard.query.filter_by(status="ACTIVE").count(), 1
            )

    def test_notifications_created_and_marked_read(self):
        response = self.client.get("/api/notifications", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["unread"], 0)
        self.assertEqual(response.json["items"], [])

        self.client.post(
            "/api/requests",
            headers=self.headers,
            json={"accountId": "1", "type": "card"},
        )
        listing = self.client.get("/api/notifications", headers=self.headers)
        self.assertEqual(listing.json["unread"], 1)
        self.assertEqual(listing.json["items"][0]["category"], "card")

        self.client.post("/api/notifications/1/read", headers=self.headers)
        listing = self.client.get("/api/notifications", headers=self.headers)
        self.assertEqual(listing.json["unread"], 0)

        self.client.post(
            "/api/requests",
            headers=self.headers,
            json={"accountId": "1", "type": "deposit", "amount": 10},
        )
        self.assertTrue(self.client.post("/api/notifications/read-all", headers=self.headers).status_code == 200)
        listing = self.client.get("/api/notifications", headers=self.headers)
        self.assertEqual(listing.json["unread"], 0)
        self.assertEqual(len(listing.json["items"]), 2)

    def test_other_user_cannot_read_someone_elses_notification(self):
        self.client.post(
            "/api/requests",
            headers=self.headers,
            json={"accountId": "1", "type": "card"},
        )
        response = self.client.post(
            "/api/notifications/1/read",
            headers=self.teller_headers,
        )
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
