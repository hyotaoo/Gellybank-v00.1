import os
import unittest
from decimal import Decimal

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SKIP_DEMO_SEED"] = "1"

from backend import app as backend


class AdminOperationsTests(unittest.TestCase):
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
                email="customer@example.com",
            )
            backend.db.session.add_all([savings, checking, customer])
            backend.db.session.flush()
            self.customer = backend.AppUser(
                user_id=1,
                customer_id=customer.customer_id,
                username=customer.email,
                password_hash=backend.hash_password("customer123"),
                role="CUSTOMER",
            )
            self.admin = backend.AppUser(
                user_id=2,
                username="admin@example.com",
                password_hash=backend.hash_password("admin12345"),
                role="ADMIN",
            )
            self.teller = backend.AppUser(
                user_id=3,
                username="teller@example.com",
                password_hash=backend.hash_password("teller123"),
                role="TELLER",
            )
            backend.db.session.add_all([self.customer, self.admin, self.teller])
            backend.db.session.commit()
            self.customer_token = backend.make_token(self.customer)
            self.admin_token = backend.make_token(self.admin)
            self.teller_token = backend.make_token(self.teller)

    def auth_headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_admin_endpoints_require_valid_admin_role(self):
        protected_requests = [
            ("get", "/api/admin/dashboard"),
            ("get", "/api/admin/users"),
            ("patch", "/api/admin/users/1"),
            ("post", "/api/admin/users/1/password-reset"),
            ("get", "/api/admin/applications"),
            ("post", "/api/admin/applications/1/decision"),
            ("get", "/api/admin/logs"),
        ]
        for method, path in protected_requests:
            with self.subTest(path=path, method=method):
                response = getattr(self.client, method)(path)
                self.assertEqual(response.status_code, 401)

        response = self.client.get(
            "/api/admin/dashboard",
            headers=self.auth_headers(self.teller_token),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get("/api/accounts").status_code, 401)

    def test_admin_login_returns_distinct_role_and_failed_login_spikes_are_logged(self):
        response = self.client.post(
            "/api/auth/login",
            json={"email": "teller@example.com", "password": "teller123"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["user"]["role"], "teller")

        for _ in range(5):
            response = self.client.post(
                "/api/auth/login",
                json={"email": "customer@example.com", "password": "wrongpass"},
            )
            self.assertEqual(response.status_code, 401)

        with backend.app.app_context():
            failed_logs = backend.AuditLog.query.filter_by(action="LOGIN_FAILED").all()
            self.assertEqual(len(failed_logs), 5)
            self.assertEqual(
                backend.AuditLog.query.filter_by(action="FAILED_LOGIN_SPIKE").count(),
                1,
            )
            latest_failure = max(failed_logs, key=lambda item: item.audit_log_id)
            self.assertEqual(latest_failure.severity, "WARN")

    def test_admin_cannot_execute_financial_transactions(self):
        response = self.client.post(
            "/api/transactions",
            headers=self.auth_headers(self.admin_token),
            json={"accountId": "1", "type": "deposit", "amount": 1},
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json["code"], "admin_transaction_forbidden")
        for method, path in (("patch", "/api/transactions/1"), ("delete", "/api/transactions/1")):
            response = getattr(self.client, method)(
                path,
                headers=self.auth_headers(self.admin_token),
                json={"note": "admin attempt"},
            )
            self.assertEqual(response.status_code, 403)

    def test_admin_metrics_and_user_search_are_role_protected(self):
        metrics = self.client.get(
            "/api/admin/dashboard",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(metrics.status_code, 200)
        self.assertEqual(metrics.json["totalUsers"], 3)
        self.assertEqual(metrics.json["systemHealth"], "healthy")

        users = self.client.get(
            "/api/admin/users?search=customer",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(users.status_code, 200)
        self.assertEqual(len(users.json), 1)
        self.assertEqual(users.json[0]["role"], "customer")

    def test_application_is_pending_until_admin_approves_it(self):
        response = self.client.post(
            "/api/accounts",
            headers=self.auth_headers(self.customer_token),
            json={"type": "savings", "initialDeposit": 125},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["status"], "pending")

        applications = self.client.get(
            "/api/admin/applications",
            headers=self.auth_headers(self.admin_token),
        )
        application_id = applications.json[0]["id"]
        self.assertEqual(len(applications.json), 1)

        approved = self.client.post(
            f"/api/admin/applications/{application_id}/decision",
            headers=self.auth_headers(self.admin_token),
            json={"decision": "approve"},
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json["status"], "approved")
        self.assertTrue(approved.json["accountNumber"])

        with backend.app.app_context():
            account = backend.BankAccount.query.one()
            transaction = backend.Transaction.query.one()
            self.assertTrue(account.account_number)
            self.assertEqual(account.current_balance, Decimal("125.00"))
            self.assertEqual(transaction.performed_by_user_id, 1)
            self.assertEqual(
                backend.AuditLog.query.filter_by(action="ACCOUNT_APPLICATION_APPROVED").count(),
                1,
            )

    def test_rejection_requires_reason_and_is_audited(self):
        pending = backend.AccountApplication(
            customer_id=1,
            applicant_user_id=1,
            account_type_id=1,
            initial_deposit=Decimal("0"),
        )
        with backend.app.app_context():
            backend.db.session.add(pending)
            backend.db.session.commit()
            application_id = pending.application_id

        rejected = self.client.post(
            f"/api/admin/applications/{application_id}/decision",
            headers=self.auth_headers(self.admin_token),
            json={"decision": "reject"},
        )
        self.assertEqual(rejected.status_code, 400)

        rejected = self.client.post(
            f"/api/admin/applications/{application_id}/decision",
            headers=self.auth_headers(self.admin_token),
            json={"decision": "reject", "reason": "Incomplete documents"},
        )
        self.assertEqual(rejected.status_code, 200)
        self.assertEqual(rejected.json["rejectionReason"], "Incomplete documents")

        with backend.app.app_context():
            self.assertEqual(
                backend.AuditLog.query.filter_by(action="ACCOUNT_APPLICATION_REJECTED").count(),
                1,
            )

    def test_password_reset_token_is_single_use(self):
        issued = self.client.post(
            "/api/admin/users/1/password-reset",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(issued.status_code, 200)
        token = issued.json["resetToken"]

        changed = self.client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "changed123"},
        )
        self.assertEqual(changed.status_code, 200)
        replay = self.client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "changed456"},
        )
        self.assertEqual(replay.status_code, 400)

        login = self.client.post(
            "/api/auth/login",
            json={"email": "customer@example.com", "password": "changed123"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(
            self.client.get(
                "/api/admin/logs",
                headers=self.auth_headers(self.customer_token),
            ).status_code,
            401,
        )

    def test_user_role_and_status_changes_are_audited_and_prevent_self_lockout(self):
        updated = self.client.patch(
            "/api/admin/users/1",
            headers=self.auth_headers(self.admin_token),
            json={"role": "teller", "isActive": False},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json["role"], "teller")
        self.assertEqual(updated.json["status"], "suspended")

        blocked = self.client.patch(
            "/api/admin/users/2",
            headers=self.auth_headers(self.admin_token),
            json={"isActive": False},
        )
        self.assertEqual(blocked.status_code, 400)

        with backend.app.app_context():
            self.assertEqual(backend.AuditLog.query.filter_by(action="USER_ROLE_UPDATED").count(), 1)
            self.assertEqual(backend.AuditLog.query.filter_by(action="USER_STATUS_UPDATED").count(), 1)
