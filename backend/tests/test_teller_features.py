import os
import unittest
from decimal import Decimal

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SKIP_DEMO_SEED"] = "1"

from backend import app as backend


class TellerFeatureTests(unittest.TestCase):
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
                customer_id=10,
                first_name="Casey",
                last_name="Customer",
                email="casey@example.com",
            )
            backend.db.session.add_all([savings, customer])
            backend.db.session.flush()

            self.customer_user = backend.AppUser(
                user_id=1,
                customer_id=customer.customer_id,
                username=customer.email,
                password_hash=backend.hash_password("customer123"),
                role="CUSTOMER",
                email_verified_at=backend.utcnow(),
            )
            self.account = backend.BankAccount(
                account_id=1,
                customer_id=customer.customer_id,
                account_type_id=savings.account_type_id,
                account_number="111122223333",
                current_balance=Decimal("100.00"),
                interest_rate=Decimal("0"),
            )
            self.teller = backend.AppUser(
                user_id=2,
                username="teller@example.com",
                password_hash=backend.hash_password("teller123"),
                role="TELLER",
                email_verified_at=backend.utcnow(),
            )
            backend.db.session.add_all([self.customer_user, self.account, self.teller])
            backend.db.session.commit()

            self.customer_headers = {
                "Authorization": f"Bearer {backend.make_token(self.customer_user)}"
            }
            self.teller_headers = {
                "Authorization": f"Bearer {backend.make_token(self.teller)}"
            }

    def test_teller_can_read_and_update_display_name(self):
        response = self.client.get("/api/teller/profile", headers=self.teller_headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["role"], "teller")
        self.assertEqual(response.json["email"], "teller@example.com")

        updated = self.client.patch(
            "/api/teller/profile",
            json={"displayName": "Tessa Teller"},
            headers=self.teller_headers,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json["displayName"], "Tessa Teller")

        me = self.client.get("/api/auth/me", headers=self.teller_headers)
        self.assertEqual(me.json["displayName"], "Tessa Teller")

    def test_teller_profile_rejects_empty_display_name(self):
        response = self.client.patch(
            "/api/teller/profile",
            json={"displayName": "   "},
            headers=self.teller_headers,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")

    def test_new_deposit_request_notifies_active_tellers(self):
        created = self.client.post(
            "/api/requests",
            json={"accountId": "1", "type": "deposit", "amount": 25},
            headers=self.customer_headers,
        )
        self.assertEqual(created.status_code, 201)

        notifications = self.client.get("/api/notifications", headers=self.teller_headers)
        self.assertEqual(notifications.status_code, 200)
        titles = [item["title"] for item in notifications.json["items"]]
        self.assertIn("New deposit request", titles)
        item = next(
            item for item in notifications.json["items"]
            if item["title"] == "New deposit request"
        )
        self.assertEqual(item["link"], "/teller/requests")
        self.assertEqual(item["category"], "request")

    def test_teller_can_process_walk_in_deposit(self):
        response = self.client.post(
            "/api/teller/transactions",
            json={"accountId": "1", "type": "deposit", "amount": 40},
            headers=self.teller_headers,
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["type"], "deposit")
        self.assertEqual(response.json["balanceAfter"], 140)


if __name__ == "__main__":
    unittest.main()
