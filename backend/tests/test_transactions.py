import os
import unittest
from decimal import Decimal

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SKIP_DEMO_SEED"] = "1"

from backend import app as backend


class TransactionReceiptTests(unittest.TestCase):
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
            checking = backend.AccountType(
                account_type_id=2,
                type_name="CHECKING",
                default_interest_rate=Decimal("0"),
            )
            customer = backend.Customer(
                customer_id=1,
                first_name="Casey",
                last_name="Customer",
                email="casey@example.com",
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
            self.source = backend.BankAccount(
                account_id=1,
                customer_id=customer.customer_id,
                account_type_id=savings.account_type_id,
                account_number="111122223333",
                current_balance=Decimal("100.00"),
                interest_rate=Decimal("0"),
            )
            self.destination = backend.BankAccount(
                account_id=2,
                customer_id=customer.customer_id,
                account_type_id=checking.account_type_id,
                account_number="444455556666",
                current_balance=Decimal("50.00"),
                interest_rate=Decimal("0"),
            )
            backend.db.session.add_all([self.user, self.source, self.destination])
            backend.db.session.commit()
            self.headers = {"Authorization": f"Bearer {backend.make_token(self.user)}"}

    def test_deposit_and_withdrawal_return_receipt_balance(self):
        deposited = self.client.post(
            "/api/transactions",
            headers=self.headers,
            json={"accountId": "1", "type": "deposit", "amount": 25, "note": "Payroll"},
        )
        self.assertEqual(deposited.status_code, 201)
        self.assertEqual(deposited.json["balanceAfter"], 125.0)
        self.assertEqual(deposited.json["status"], "completed")
        self.assertTrue(deposited.json["reference"].startswith("TXN-"))

        withdrawal = self.client.post(
            "/api/transactions",
            headers=self.headers,
            json={"accountId": "1", "type": "withdraw", "amount": 40},
        )
        self.assertEqual(withdrawal.status_code, 201)
        self.assertEqual(withdrawal.json["balanceAfter"], 85.0)

        listing = self.client.get("/api/transactions?accountId=1", headers=self.headers)
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json[0]["balanceAfter"], 85.0)

    def test_transfer_receipt_includes_counterparty_and_new_balance(self):
        response = self.client.post(
            "/api/transactions/transfer",
            headers=self.headers,
            json={
                "sourceAccountId": "1",
                "destinationAccountId": "2",
                "amount": 30,
                "note": "Shared bill",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["type"], "transfer")
        self.assertEqual(response.json["balanceAfter"], 70.0)
        self.assertEqual(response.json["counterparty"], "Casey Customer")
        self.assertEqual(response.json["note"], "Shared bill")

        with backend.app.app_context():
            source = backend.db.session.get(backend.BankAccount, 1)
            destination = backend.db.session.get(backend.BankAccount, 2)
            self.assertEqual(source.current_balance, Decimal("70.00"))
            self.assertEqual(destination.current_balance, Decimal("80.00"))


if __name__ == "__main__":
    unittest.main()
