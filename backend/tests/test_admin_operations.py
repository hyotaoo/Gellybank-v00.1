import io
import os
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

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
                email_verified_at=backend.utcnow(),
            )
            self.admin = backend.AppUser(
                user_id=2,
                username="admin@example.com",
                password_hash=backend.hash_password("admin12345"),
                role="ADMIN",
                email_verified_at=backend.utcnow(),
            )
            self.teller = backend.AppUser(
                user_id=3,
                username="teller@example.com",
                password_hash=backend.hash_password("teller123"),
                role="TELLER",
                email_verified_at=backend.utcnow(),
            )
            backend.db.session.add_all([self.customer, self.admin, self.teller])
            backend.db.session.commit()
            # The lockout table lives in process memory and is shared by every
            # test in the class; drop it so failures in one test don't lock the
            # email used by another test.
            backend.LOGIN_ATTEMPTS.clear()
            self.customer_token = backend.make_token(self.customer)
            self.admin_token = backend.make_token(self.admin)
            self.teller_token = backend.make_token(self.teller)

    def auth_headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_admin_endpoints_require_valid_admin_role(self):
        protected_requests = [
            ("get", "/api/admin/dashboard"),
            ("get", "/api/admin/users"),
            ("get", "/api/admin/users/1"),
            ("post", "/api/admin/users"),
            ("patch", "/api/admin/users/1"),
            ("post", "/api/admin/users/1/password-reset"),
            ("get", "/api/admin/applications"),
            ("post", "/api/admin/applications/1/decision"),
            ("get", "/api/admin/logs"),
            ("get", "/api/admin/backups"),
            ("get", "/api/admin/backups/sample.sql"),
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

    def test_admin_can_list_and_download_backups(self):
        with tempfile.TemporaryDirectory() as directory:
            backup_dir = Path(directory)
            (backup_dir / "gellybank_db_20260101_000000.sql").write_text("SELECT 1;\n")
            original_dir = backend.BACKUP_DIR
            backend.BACKUP_DIR = backup_dir
            try:
                listed = self.client.get(
                    "/api/admin/backups",
                    headers=self.auth_headers(self.admin_token),
                )
                self.assertEqual(listed.status_code, 200)
                self.assertEqual(
                    [entry["name"] for entry in listed.json],
                    ["gellybank_db_20260101_000000.sql"],
                )

                downloaded = self.client.get(
                    "/api/admin/backups/gellybank_db_20260101_000000.sql",
                    headers=self.auth_headers(self.admin_token),
                )
                self.assertEqual(downloaded.status_code, 200)
                self.assertEqual(downloaded.data, b"SELECT 1;\n")
                self.assertIn(
                    "attachment",
                    downloaded.headers["Content-Disposition"],
                )

                missing = self.client.get(
                    "/api/admin/backups/../app.py",
                    headers=self.auth_headers(self.admin_token),
                )
                self.assertEqual(missing.status_code, 404)
            finally:
                backend.BACKUP_DIR = original_dir

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

    def test_successful_logins_are_audited_and_exposed(self):
        self.client.post(
            "/api/auth/login",
            json={"email": "teller@example.com", "password": "teller123"},
        )
        self.client.post(
            "/api/auth/login",
            json={"email": "customer@example.com", "password": "wrongpass"},
        )

        headers = self.auth_headers(self.admin_token)
        history = self.client.get("/api/admin/login-history", headers=headers)
        self.assertEqual(history.status_code, 200)
        by_action = {}
        for entry in history.json:
            by_action.setdefault(entry["action"], []).append(entry)
        self.assertEqual(len(by_action["LOGIN_SUCCESS"]), 1)
        self.assertEqual(by_action["LOGIN_SUCCESS"][0]["email"], "teller@example.com")
        self.assertEqual(by_action["LOGIN_SUCCESS"][0]["ipAddress"], "127.0.0.1")
        self.assertEqual(len(by_action["LOGIN_FAILED"]), 1)
        self.assertEqual(by_action["LOGIN_FAILED"][0]["email"], "customer@example.com")

        filtered = self.client.get(
            "/api/admin/login-history?email=teller@example.com",
            headers=headers,
        )
        self.assertEqual([entry["action"] for entry in filtered.json], ["LOGIN_SUCCESS"])

        summary = self.client.get("/api/admin/security-summary", headers=headers)
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.json["failedLogins24h"], 1)
        self.assertEqual(summary.json["failedLogins1h"], 1)
        self.assertEqual(summary.json["successfulLogins24h"], 1)
        self.assertEqual(summary.json["loginSpikes24h"], 0)

    def test_audit_log_action_and_entity_filters(self):
        self.client.post(
            "/api/auth/login",
            json={"email": "teller@example.com", "password": "teller123"},
        )
        headers = self.auth_headers(self.admin_token)

        by_action = self.client.get("/api/admin/logs?action=LOGIN", headers=headers)
        self.assertEqual(by_action.status_code, 200)
        self.assertTrue(all("LOGIN" in entry["action"] for entry in by_action.json))
        self.assertGreater(len(by_action.json), 0)

        by_entity = self.client.get("/api/admin/logs?entityType=AUTH", headers=headers)
        self.assertEqual(
            {entry["entityType"] for entry in by_entity.json},
            {"AUTH"},
        )

        peaked = self.client.get("/api/admin/logs?action=SPIKE", headers=headers)
        self.assertEqual(peaked.status_code, 200)
        self.assertEqual(peaked.json, [])

        self.assertEqual(
            self.client.get(
                "/api/admin/logs?actorId=not-a-number",
                headers=headers,
            ).json["code"],
            "invalid_actor",
        )


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
        self.assertEqual(metrics.json["totalCustomers"], 1)
        self.assertEqual(metrics.json["totalTellers"], 1)
        self.assertEqual(metrics.json["totalTransactions"], 0)
        self.assertEqual(metrics.json["pendingRequests"], 0)
        self.assertEqual(metrics.json["systemHealth"], "healthy")
        self.assertEqual(metrics.json["transactionOverview"]["today"], {})
        self.assertEqual(metrics.json["recentActivity"], [])

        users = self.client.get(
            "/api/admin/users?search=customer",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(users.status_code, 200)
        self.assertEqual(len(users.json), 1)
        self.assertEqual(users.json[0]["role"], "customer")

    def test_admin_users_support_role_and_status_filters(self):
        active = self.client.get(
            "/api/admin/users?role=teller&status=active",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(active.status_code, 200)
        self.assertEqual([entry["role"] for entry in active.json], ["teller"])

        suspended = self.client.get(
            "/api/admin/users?status=suspended",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(suspended.status_code, 200)
        self.assertEqual(suspended.json, [])

        self.assertEqual(
            self.client.get(
                "/api/admin/users?role=manager",
                headers=self.auth_headers(self.admin_token),
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.get(
                "/api/admin/users?status=gone",
                headers=self.auth_headers(self.admin_token),
            ).status_code,
            400,
        )

    def test_admin_creates_teller_and_admin_logins(self):
        created = self.client.post(
            "/api/admin/users",
            headers=self.auth_headers(self.admin_token),
            json={"email": "newteller@example.com", "password": "Teller1!Pass", "role": "teller"},
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json["role"], "teller")
        self.assertEqual(created.json["status"], "active")
        self.assertTrue(created.json["emailVerified"])

        with backend.app.app_context():
            created_user = backend.AppUser.query.filter_by(username="newteller@example.com").one()
            self.assertEqual(created_user.role, "TELLER")
            self.assertTrue(backend.check_password(created_user.password_hash, "Teller1!Pass"))
            self.assertEqual(
                backend.AuditLog.query.filter_by(action="USER_CREATED").count(),
                1,
            )

        # The new teller can sign in through the normal login flow.
        login = self.client.post(
            "/api/auth/login",
            json={"email": "newteller@example.com", "password": "Teller1!Pass"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json["user"]["role"], "teller")

    def test_admin_account_status_actions(self):
        with backend.app.app_context():
            account = backend.BankAccount(
                customer_id=1,
                account_type_id=1,
                account_number="0000000001",
                current_balance=Decimal("50.00"),
            )
            backend.db.session.add(account)
            backend.db.session.commit()
            account_id = account.account_id

        headers = self.auth_headers(self.admin_token)

        # Tellers may view accounts but not change status.
        self.assertEqual(
            self.client.get(
                f"/api/admin/accounts/{account_id}",
                headers=self.auth_headers(self.teller_token),
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/admin/accounts/{account_id}/status",
                headers=self.auth_headers(self.teller_token),
                json={"action": "freeze"},
            ).status_code,
            403,
        )

        frozen = self.client.patch(
            f"/api/admin/accounts/{account_id}/status",
            headers=headers,
            json={"action": "freeze"},
        )
        self.assertEqual(frozen.status_code, 200)
        self.assertEqual(frozen.json["status"], "frozen")

        # Closing is refused while there is money in the account.
        blocked = self.client.patch(
            f"/api/admin/accounts/{account_id}/status",
            headers=headers,
            json={"action": "close"},
        )
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(blocked.json["code"], "balance_not_zero")

        with backend.app.app_context():
            refreshed = backend.BankAccount.query.get(account_id)
            refreshed.current_balance = Decimal("0.00")
            backend.db.session.commit()

        closed = self.client.patch(
            f"/api/admin/accounts/{account_id}/status",
            headers=headers,
            json={"action": "close"},
        )
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(closed.json["status"], "closed")

        reopened = self.client.patch(
            f"/api/admin/accounts/{account_id}/status",
            headers=headers,
            json={"action": "reopen"},
        )
        self.assertEqual(reopened.status_code, 200)
        self.assertEqual(reopened.json["status"], "active")

        invalid = self.client.patch(
            f"/api/admin/accounts/{account_id}/status",
            headers=headers,
            json={"action": "delete"},
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.json["code"], "invalid_action")

    def test_admin_transaction_list_filters_detail_and_reversal(self):
        with backend.app.app_context():
            customer2 = backend.Customer(
                customer_id=2,
                first_name="Renee",
                last_name="Recipient",
                email="renee@example.com",
            )
            backend.db.session.add(customer2)
            source = backend.BankAccount(
                customer_id=1,
                account_type_id=1,
                account_number="0000000001",
                current_balance=Decimal("200.00"),
            )
            destination = backend.BankAccount(
                customer_id=2,
                account_type_id=2,
                account_number="0000000002",
                current_balance=Decimal("40.00"),
            )
            backend.db.session.add_all([source, destination])
            backend.db.session.flush()
            transfer = backend.Transfer(
                reference_code=backend.new_reference(),
                from_account_id=source.account_id,
                to_account_id=destination.account_id,
                amount=Decimal("30.00"),
            )
            backend.db.session.add(transfer)
            backend.db.session.flush()
            backend.db.session.add_all([
                backend.Transaction(
                    account_id=source.account_id,
                    transaction_type="DEPOSIT",
                    amount=Decimal("200.00"),
                    balance_after=Decimal("200.00"),
                    reference_code="TXDEP1",
                    performed_by_user_id=3,
                ),
                backend.Transaction(  # sent leg
                    account_id=source.account_id,
                    transaction_type="TRANSFER_OUT",
                    amount=Decimal("30.00"),
                    balance_after=Decimal("170.00"),
                    reference_code="TXTX-S",
                    transfer_id=transfer.transfer_id,
                ),
                backend.Transaction(  # received leg
                    account_id=destination.account_id,
                    transaction_type="TRANSFER_IN",
                    amount=Decimal("30.00"),
                    balance_after=Decimal("40.00"),
                    reference_code="TXTX-R",
                    transfer_id=transfer.transfer_id,
                ),
            ])
            backend.db.session.commit()
            transfer_id = transfer.transfer_id
            source_id = source.account_id
            destination_id = destination.account_id

        headers = self.auth_headers(self.admin_token)
        teller_headers = self.auth_headers(self.teller_token)

        listed = self.client.get("/api/admin/transactions?limit=100", headers=headers)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json), 3)
        sent_leg = next(tx for tx in listed.json if tx["reference"] == "TXTX-S")
        self.assertEqual(sent_leg["customerName"], "Casey Customer")
        self.assertEqual(sent_leg["customerEmail"], "customer@example.com")
        self.assertEqual(sent_leg["accountNumber"], "0000000001")
        self.assertEqual(sent_leg["performedBy"], None)

        searched = self.client.get(
            "/api/admin/transactions?search=casey&type=deposit",
            headers=headers,
        )
        self.assertEqual(searched.status_code, 200)
        self.assertEqual([tx["reference"] for tx in searched.json], ["TXDEP1"])

        transfer_only = self.client.get(
            "/api/admin/transactions?type=transfer",
            headers=headers,
        )
        self.assertEqual(
            {tx["reference"] for tx in transfer_only.json},
            {"TXTX-S", "TXTX-R"},
        )

        void_status = self.client.get(
            "/api/admin/transactions?status=void",
            headers=headers,
        )
        self.assertEqual(void_status.status_code, 200)
        self.assertEqual(void_status.json, [])

        detail = self.client.get(f"/api/admin/transactions/{sent_leg['id']}", headers=teller_headers)
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json["reference"], "TXTX-S")
        self.assertEqual(detail.json["account"]["customerName"], "Casey Customer")

        # Reversal needs a reason.
        no_reason = self.client.post(
            f"/api/admin/transactions/{sent_leg['id']}/reverse",
            headers=headers,
            json={},
        )
        self.assertEqual(no_reason.status_code, 400)
        self.assertEqual(no_reason.json["code"], "reason_required")

        customer_forbidden = self.client.post(
            "/api/admin/transactions/1/reverse",
            headers=self.auth_headers(self.customer_token),
            json={"reason": "nope"},
        )
        self.assertEqual(customer_forbidden.status_code, 403)

        reversed_tx = self.client.post(
            f"/api/admin/transactions/{sent_leg['id']}/reverse",
            headers=headers,
            json={"reason": "Sent to the wrong account"},
        )
        self.assertEqual(reversed_tx.status_code, 200)
        self.assertEqual(reversed_tx.json["status"], "void")

        with backend.app.app_context():
            legs = backend.Transaction.query.filter_by(transfer_id=transfer_id).all()
            self.assertEqual({leg.status for leg in legs}, {"VOID"})
            leg_accounts = {leg.account_id for leg in legs}
            adjustments = backend.Transaction.query.filter(
                backend.Transaction.transaction_type == "ADJUSTMENT"
            ).all()
            self.assertEqual(len(adjustments), 2)
            self.assertEqual(
                backend.db.session.get(backend.Transfer, transfer_id).status,
                "REVERSED",
            )
            for adjustment in adjustments:
                self.assertIsNone(adjustment.transfer_id)
                self.assertIn(adjustment.account_id, leg_accounts)
                if adjustment.account_id == source_id:
                    self.assertEqual(adjustment.amount, Decimal("30.00"))
                    self.assertEqual(adjustment.balance_after, Decimal("230.00"))
                else:
                    self.assertEqual(adjustment.balance_after, Decimal("10.00"))
            restored_source = backend.BankAccount.query.get(source_id)
            restored_destination = backend.BankAccount.query.get(destination_id)
            self.assertEqual(restored_source.current_balance, Decimal("230.00"))
            self.assertEqual(restored_destination.current_balance, Decimal("10.00"))
            self.assertEqual(
                backend.AuditLog.query.filter_by(action="TRANSACTION_REVERSED").count(),
                1,
            )

        already_void = self.client.post(
            f"/api/admin/transactions/{sent_leg['id']}/reverse",
            headers=headers,
            json={"reason": "again"},
        )
        self.assertEqual(already_void.status_code, 409)
        self.assertEqual(already_void.json["code"], "already_void")

    def test_admin_reports_summary_and_csv_export(self):
        with backend.app.app_context():
            source = backend.BankAccount(
                customer_id=1,
                account_type_id=1,
                account_number="0000000001",
                current_balance=Decimal("200.00"),
            )
            backend.db.session.add(source)
            backend.db.session.flush()
            backend.db.session.add_all([
                backend.Transaction(
                    account_id=source.account_id,
                    transaction_type="DEPOSIT",
                    amount=Decimal("200.00"),
                    balance_after=Decimal("200.00"),
                    reference_code="TXDEP1",
                    performed_by_user_id=3,
                ),
                backend.Transaction(
                    account_id=source.account_id,
                    transaction_type="WITHDRAWAL",
                    amount=Decimal("50.00"),
                    balance_after=Decimal("150.00"),
                    reference_code="TXWD1",
                    performed_by_user_id=3,
                ),
                backend.Transaction(
                    account_id=source.account_id,
                    transaction_type="DEPOSIT",
                    amount=Decimal("10.00"),
                    balance_after=Decimal("160.00"),
                    reference_code="TXVOID1",
                    status="VOID",
                ),
            ])
            backend.db.session.commit()

        headers = self.auth_headers(self.admin_token)
        report = self.client.get("/api/admin/reports", headers=headers)
        self.assertEqual(report.status_code, 200)
        deposit_row = report.json["lifetimeByType"]["DEPOSIT"]
        self.assertEqual(deposit_row["count"], 1)
        self.assertEqual(deposit_row["total"], 200)
        withdrawal_row = report.json["lifetimeByType"]["WITHDRAWAL"]
        self.assertEqual(withdrawal_row["total"], 50)
        self.assertEqual(report.json["customerStats"]["totalCustomers"], 1)
        self.assertEqual(report.json["customerStats"]["newCustomers"], 1)
        self.assertEqual(report.json["deployedBalance"], 200)
        tellers = report.json["tellerStats"]
        self.assertEqual(len(tellers), 1)
        self.assertEqual(tellers[0]["transactions"], 2)
        self.assertEqual(tellers[0]["total"], 250)

        ranged = self.client.get(
            "/api/admin/reports?from=2020-01-01&to=2020-01-02",
            headers=headers,
        )
        self.assertEqual(ranged.status_code, 200)
        self.assertEqual(ranged.json["rangeByType"], {})

        exported = self.client.get("/api/admin/reports/export", headers=headers)
        self.assertEqual(exported.status_code, 200)
        self.assertTrue(exported.headers["Content-Disposition"].startswith("attachment; filename="))
        lines = exported.get_data(as_text=True).strip().splitlines()
        self.assertEqual(lines[0], "reference,date,type,amount,currency,status,account,customer,note,performed_by")
        self.assertEqual(len(lines), 4)

        self.assertEqual(
            self.client.get("/api/admin/reports/export", headers=self.auth_headers(self.teller_token)).status_code,
            403,
        )

    def test_bank_settings_and_maintenance_mode(self):
        public = self.client.get("/api/settings")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.json["bankName"], "GellyBank")
        self.assertFalse(public.json["maintenanceMode"])
        self.assertIsNone(public.json["logo"])

        headers = self.auth_headers(self.admin_token)
        updated = self.client.patch(
            "/api/admin/settings",
            headers=headers,
            json={
                "bankName": "Gelly Trust Bank",
                "contactEmail": "help@gellybank.com",
                "contactPhone": "+63 900 000 0000",
                "address": "Manila",
                "maintenanceMode": True,
            },
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json["bankName"], "Gelly Trust Bank")
        self.assertTrue(updated.json["maintenanceMode"])

        refreshed = self.client.get("/api/settings")
        self.assertEqual(refreshed.json["bankName"], "Gelly Trust Bank")
        self.assertEqual(refreshed.json["contactEmail"], "help@gellybank.com")

        with backend.app.app_context():
            self.assertEqual(
                backend.AuditLog.query.filter_by(action="BANK_SETTINGS_UPDATED").count(),
                1,
            )

        # Maintenance mode blocks customers and tellers everywhere but auth.
        self.assertEqual(
            self.client.get("/api/accounts", headers=self.auth_headers(self.customer_token)).status_code,
            503,
        )
        self.assertEqual(
            self.client.get("/api/teller/requests", headers=self.auth_headers(self.teller_token)).status_code,
            503,
        )
        # Admin portal and auth stay reachable.
        self.assertEqual(
            self.client.get("/api/admin/users", headers=headers).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(
                "/api/auth/login",
                json={"email": "teller@example.com", "password": "teller123"},
            ).status_code,
            200,
        )

        # Getting the settings while in maintenance mode must not 503 itself.
        self.assertEqual(
            self.client.get("/api/settings").status_code,
            200,
        )

        invalid = self.client.patch("/api/admin/settings", headers=headers, json={"maintenanceMode": "on"})
        self.assertEqual(invalid.status_code, 400)
        invalid_name = self.client.patch("/api/admin/settings", headers=headers, json={"bankName": ""})
        self.assertEqual(invalid_name.status_code, 400)
        self.assertEqual(invalid_name.json["code"], "invalid_bank_name")

        turned_off = self.client.patch("/api/admin/settings", headers=headers, json={"maintenanceMode": False})
        self.assertEqual(turned_off.status_code, 200)
        self.assertEqual(
            self.client.get("/api/accounts", headers=self.auth_headers(self.customer_token)).status_code,
            200,
        )

    def test_staff_identity_me_and_admin_profile(self):
        me = self.client.get(
            "/api/auth/me",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json["role"], "admin")
        self.assertEqual(me.json["email"], "admin@example.com")
        self.assertIsNone(me.json["displayName"])

        # Staff display name flows into /api/admin/profile and /api/auth/me.
        renamed = self.client.patch(
            "/api/admin/profile",
            headers=self.auth_headers(self.admin_token),
            json={"displayName": "Ada Admin"},
        )
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.json["displayName"], "Ada Admin")

        with backend.app.app_context():
            self.assertEqual(backend.AuditLog.query.filter_by(action="USER_PROFILE_UPDATED").count(), 1)

        reminder = self.client.get("/api/auth/me", headers=self.auth_headers(self.admin_token))
        self.assertEqual(reminder.json["displayName"], "Ada Admin")
        self.assertEqual(reminder.json["firstName"], "Ada Admin")

        profile = self.client.get("/api/admin/profile", headers=self.auth_headers(self.admin_token))
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.json["displayName"], "Ada Admin")
        self.assertIn("lastLoginAt", profile.json)

        self.assertEqual(
            self.client.patch(
                "/api/admin/profile",
                headers=self.auth_headers(self.admin_token),
                json={"displayName": "  "},
            ).status_code,
            400,
        )

    def test_admin_restore_backup_from_upload(self):
        import types

        with tempfile.TemporaryDirectory() as directory:
            backup_dir = Path(directory)
            original_dir = backend.BACKUP_DIR
            original_run = backend.run_project_script
            backend.BACKUP_DIR = backup_dir

            calls = []

            def fake_run(script_path, *args):
                calls.append([str(arg) for arg in (script_path, *args)])
                payload = Path(str(args[0])).read_bytes()
                self.assertEqual(payload, b"SELECT 1;\n")
                return types.SimpleNamespace(returncode=0, stdout="", stderr="")

            backend.run_project_script = fake_run
            try:
                headers = self.auth_headers(self.admin_token)

                no_file = self.client.post(
                    "/api/admin/backups/restore-upload",
                    headers=headers,
                    data={"confirm": "RESTORE"},
                    content_type="multipart/form-data",
                )
                self.assertEqual(no_file.status_code, 400)
                self.assertEqual(no_file.json["code"], "file_missing")

                invalid_confirm = self.client.post(
                    "/api/admin/backups/restore-upload",
                    headers=headers,
                    data={"file": (io.BytesIO(b"SELECT 1;\n"), "dump.sql"), "confirm": "yes"},
                    content_type="multipart/form-data",
                )
                self.assertEqual(invalid_confirm.status_code, 400)
                self.assertEqual(invalid_confirm.json["code"], "confirmation_invalid")

                wrong_type = self.client.post(
                    "/api/admin/backups/restore-upload",
                    headers=headers,
                    data={"file": (io.BytesIO(b"hello"), "dump.txt"), "confirm": "RESTORE"},
                    content_type="multipart/form-data",
                )
                self.assertEqual(wrong_type.status_code, 400)
                self.assertEqual(wrong_type.json["code"], "file_invalid")

                empty = self.client.post(
                    "/api/admin/backups/restore-upload",
                    headers=headers,
                    data={"file": (io.BytesIO(b""), "dump.sql"), "confirm": "RESTORE"},
                    content_type="multipart/form-data",
                )
                self.assertEqual(empty.status_code, 400)
                self.assertEqual(empty.json["code"], "file_empty")

                self.assertEqual(len(calls), 0)

                with backend.app.app_context():
                    before = backend.AuditLog.query.filter_by(action="BACKUP_RESTORED").count()

                restored = self.client.post(
                    "/api/admin/backups/restore-upload",
                    headers=headers,
                    data={"file": (io.BytesIO(b"SELECT 1;\n"), "dump.sql"), "confirm": "RESTORE"},
                    content_type="multipart/form-data",
                )
                self.assertEqual(restored.status_code, 200)
                self.assertEqual(len(calls), 1)
                self.assertIn("restore_db.sh", calls[0][0])
                self.assertEqual(calls[0][-1], "--yes")
                # The temporary upload file must be cleaned up.
                self.assertFalse(os.path.exists(calls[0][1]))

                with backend.app.app_context():
                    self.assertEqual(
                        backend.AuditLog.query.filter_by(action="BACKUP_RESTORED").count(),
                        before + 1,
                    )
            finally:
                backend.run_project_script = original_run
                backend.BACKUP_DIR = original_dir

    def test_admin_generate_and_restore_backups(self):
        import types  # noqa: F401

        with tempfile.TemporaryDirectory() as directory:
            backup_dir = Path(directory)
            original_dir = backend.BACKUP_DIR
            original_run = backend.run_project_script
            backend.BACKUP_DIR = backup_dir

            calls = []

            def fake_run(script_path, *args):
                calls.append([str(script_path), *(str(a) for a in args)])
                name = f"gellybank_db_{len(calls):04d}.sql"
                (backup_dir / name).write_text("SELECT 1;\n")
                return types.SimpleNamespace(returncode=0, stdout="", stderr="")

            backend.run_project_script = fake_run
            try:
                headers = self.auth_headers(self.admin_token)

                generated = self.client.post("/api/admin/backups", headers=headers)
                self.assertEqual(generated.status_code, 201)
                generated_name = generated.json["generated"]
                self.assertTrue(generated.json["backups"][0]["name"] == generated_name)
                self.assertIn("backup_db.sh", calls[0][0])

                invalid_confirm = self.client.post(
                    "/api/admin/backups/restore",
                    headers=headers,
                    json={"filename": generated_name, "confirm": "yes"},
                )
                self.assertEqual(invalid_confirm.status_code, 400)
                self.assertEqual(invalid_confirm.json["code"], "confirmation_invalid")

                missing = self.client.post(
                    "/api/admin/backups/restore",
                    headers=headers,
                    json={"filename": "missing.sql", "confirm": "RESTORE"},
                )
                self.assertEqual(missing.status_code, 404)

                traversal = self.client.post(
                    "/api/admin/backups/restore",
                    headers=headers,
                    json={"filename": "../app.py.sql", "confirm": "RESTORE"},
                )
                self.assertEqual(traversal.status_code, 404)

                restored = self.client.post(
                    "/api/admin/backups/restore",
                    headers=headers,
                    json={"filename": generated_name, "confirm": "RESTORE"},
                )
                self.assertEqual(restored.status_code, 200)
                restore_call = calls[-1]
                self.assertIn("restore_db.sh", restore_call[0])
                self.assertEqual(restore_call[-1], "--yes")

                with backend.app.app_context():
                    self.assertEqual(
                        backend.AuditLog.query.filter_by(action="BACKUP_GENERATED").count(),
                        1,
                    )
                    self.assertEqual(
                        backend.AuditLog.query.filter_by(action="BACKUP_RESTORED").count(),
                        1,
                    )

                def failing_run(script_path, *args):
                    return types.SimpleNamespace(returncode=1, stdout="", stderr="mysqldump: boom")

                backend.run_project_script = failing_run
                failed = self.client.post("/api/admin/backups", headers=headers)
                self.assertEqual(failed.status_code, 503)
                self.assertEqual(failed.json["message"], "mysqldump: boom")
            finally:
                backend.run_project_script = original_run
                backend.BACKUP_DIR = original_dir

        self.assertEqual(
            self.client.post("/api/admin/backups", headers=self.auth_headers(self.teller_token)).status_code,
            403,
        )

    def test_admin_create_user_validation(self):
        cases = [
            (
                {"email": "newteller@example.com", "password": "teller123", "role": "manager"},
                "invalid_role",
                400,
            ),
            (
                {"email": "not-an-email", "password": "teller123", "role": "teller"},
                "invalid_email",
                400,
            ),
            (
                {"email": "weak@example.com", "password": "short", "role": "teller"},
                "weak_password",
                400,
            ),
            (
                {"email": "teller@example.com", "password": "Teller1!Pass", "role": "teller"},
                "email_taken",
                409,
            ),
        ]
        for payload, expected_code, expected_status in cases:
            with self.subTest(code=expected_code):
                response = self.client.post(
                    "/api/admin/users",
                    headers=self.auth_headers(self.admin_token),
                    json=payload,
                )
                self.assertEqual(response.status_code, expected_status)
                self.assertEqual(response.json["code"], expected_code)

        with backend.app.app_context():
            self.assertIsNone(
                backend.AppUser.query.filter_by(username="weak@example.com").first(),
            )

        forbidden = self.client.post(
            "/api/admin/users",
            headers=self.auth_headers(self.teller_token),
            json={"email": "nope@example.com", "password": "teller123", "role": "teller"},
        )
        self.assertEqual(forbidden.status_code, 403)

    def test_admin_user_detail(self):
        detail = self.client.get(
            "/api/admin/users/1",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json["role"], "customer")
        self.assertEqual(detail.json["name"], "Casey Customer")
        self.assertEqual(detail.json["accounts"], [])
        self.assertEqual(detail.json["customerStatus"], "active")

        staff_detail = self.client.get(
            "/api/admin/users/3",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(staff_detail.status_code, 200)
        self.assertEqual(staff_detail.json["role"], "teller")
        self.assertIsNone(staff_detail.json["customerStatus"])
        self.assertEqual(staff_detail.json["accounts"], [])

        self.assertEqual(
            self.client.get(
                "/api/admin/users/999",
                headers=self.auth_headers(self.admin_token),
            ).status_code,
            404,
        )


    def test_admin_dashboard_sums_and_activity(self):
        with backend.app.app_context():
            account = backend.BankAccount(
                customer_id=1,
                account_type_id=1,
                account_number="0000000001",
                current_balance=Decimal("100.00"),
            )
            backend.db.session.add(account)
            backend.db.session.flush()
            backend.db.session.add_all([
                backend.Transaction(
                    account_id=account.account_id,
                    transaction_type="DEPOSIT",
                    amount=Decimal("150.00"),
                    balance_after=Decimal("150.00"),
                    reference_code="TXDEP1",
                    performed_by_user_id=3,
                ),
                backend.Transaction(
                    account_id=account.account_id,
                    transaction_type="WITHDRAWAL",
                    amount=Decimal("50.00"),
                    balance_after=Decimal("100.00"),
                    reference_code="TXWD1",
                    performed_by_user_id=3,
                ),
                backend.Transaction(
                    account_id=account.account_id,
                    transaction_type="TRANSFER_IN",
                    amount=Decimal("25.00"),
                    balance_after=Decimal("125.00"),
                    reference_code="TXTR1",
                ),
            ])
            backend.db.session.add(backend.TransactionRequest(
                customer_id=1,
                account_id=account.account_id,
                requested_by_user_id=1,
                transaction_type="DEPOSIT",
                amount=Decimal("10.00"),
            ))
            backend.db.session.commit()

        metrics = self.client.get(
            "/api/admin/dashboard",
            headers=self.auth_headers(self.admin_token),
        )
        self.assertEqual(metrics.status_code, 200)
        self.assertEqual(metrics.json["totalTransactions"], 3)
        self.assertEqual(metrics.json["pendingRequests"], 1)
        overview = metrics.json["transactionOverview"]["lifetime"]
        self.assertEqual(overview["deposit"]["count"], 1)
        self.assertEqual(overview["deposit"]["total"], 150)
        self.assertEqual(overview["withdrawal"]["count"], 1)
        self.assertEqual(overview["withdrawal"]["total"], 50)
        self.assertNotIn("transfer_in", overview)
        self.assertIsInstance(metrics.json["recentActivity"], list)

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
            json={"token": token, "password": "Changed1!Pass"},
        )
        self.assertEqual(changed.status_code, 200)
        replay = self.client.post(
            "/api/auth/reset-password",
            json={"token": token, "password": "Changed2!Pass"},
        )
        self.assertEqual(replay.status_code, 400)

        login = self.client.post(
            "/api/auth/login",
            json={"email": "customer@example.com", "password": "Changed1!Pass"},
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
