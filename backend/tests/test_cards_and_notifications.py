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
            backend.db.session.add_all([savings, customer])
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
            self.account = backend.BankAccount(
                account_id=1,
                customer_id=customer.customer_id,
                account_type_id=savings.account_type_id,
                account_number="111122223333",
                current_balance=Decimal("100.00"),
                interest_rate=Decimal("0"),
            )
            backend.db.session.add_all([self.user, self.teller, self.account])
            backend.db.session.commit()
            self.headers = {"Authorization": f"Bearer {backend.make_token(self.user)}"}
            self.teller_headers = {"Authorization": f"Bearer {backend.make_token(self.teller)}"}

    def test_cards_require_authentication(self):
        self.assertEqual(self.client.get("/api/cards").status_code, 401)

    def test_get_cards_issues_card_per_account_with_full_details(self):
        response = self.client.get("/api/cards", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json), 1)
        card = response.json[0]
        self.assertEqual(len(card["cardNumber"]), 16)
        self.assertTrue(card["cardNumber"].startswith("5476"))
        self.assertEqual(len(card["cvv"]), 3)
        self.assertEqual(card["holder"], "Casey Customer")
        self.assertEqual(card["status"], "active")
        self.assertIn("expiresOn", card)

        again = self.client.get("/api/cards", headers=self.headers)
        self.assertEqual(again.json[0]["cardNumber"], card["cardNumber"])

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
