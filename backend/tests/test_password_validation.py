import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SKIP_DEMO_SEED"] = "1"

from backend import app as backend
from backend import email_service


VALID_PASSWORD = "Str0ng!Pass"

WEAK_CASES = [
    ("1", "single character"),
    ("Sh0rt!A", "under 8 characters"),
    ("12345678", "digits only"),
    ("abcdefgh", "lowercase only"),
    ("ABCDEFGH", "uppercase only"),
    ("Abcdefgh", "missing number"),
    ("Abcdefg1", "missing special character"),
    ("abcdefg1!", "missing uppercase"),
    ("ABCDEFG1!", "missing lowercase"),
    ("Str0ng! Pass", "contains a space"),
]


class PasswordValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        backend.app.config["TESTING"] = True
        cls.client = backend.app.test_client()

    def setUp(self):
        email_service.OUTBOX.clear()
        backend.LOGIN_ATTEMPTS.clear()
        with backend.app.app_context():
            backend.db.drop_all()
            backend.db.create_all()

    def tearDown(self):
        backend.LOGIN_ATTEMPTS.clear()

    def auth_headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def register_verified_customer(self, email="customer@example.com", password=VALID_PASSWORD):
        response = self.client.post("/api/auth/register", json={
            "firstName": "Casey",
            "lastName": "Customer",
            "email": email,
            "password": password,
            "acceptTerms": True,
            "acceptPrivacy": True,
        })
        self.assertEqual(response.status_code, 201, response.json)
        code = email_service.OUTBOX[-1]["code"]
        verify = self.client.post("/api/auth/verify-email", json={"email": email, "code": code})
        self.assertEqual(verify.status_code, 200, verify.json)
        return verify.json["token"]

    def login(self, email="customer@example.com", password=VALID_PASSWORD):
        response = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 200, response.json)
        return response.json["token"]

    def subtest_weak_password(self, fn):
        for password, description in WEAK_CASES:
            with self.subTest(description):
                fn(password)

    def test_policy_messages(self):
        cases = [
            ("Sh0rt!A", "at least 8 characters"),
            ("Str0ng! Pass", "cannot contain spaces"),
            ("abcdefg1!", "uppercase letter"),
            ("ABCDEFG1!", "lowercase letter"),
            ("Abcdefgh!", "number"),
            ("Abcdefg1", "special character"),
        ]
        for password, expected in cases:
            with self.subTest(expected):
                message, code = backend.validate_password(password)
                self.assertEqual(code, "weak_password")
                self.assertIn(expected, message)

    def test_username_match_is_rejected(self):
        message, code = backend.validate_password("Customer1@example.com", "Customer1@example.com")
        self.assertEqual(code, "weak_password")
        self.assertIn("email or username", message)

        message, code = backend.validate_password("Customer1!", "Customer1!@example.com")
        self.assertEqual(code, "weak_password")
        self.assertIn("email or username", message)

    def test_valid_password_is_accepted(self):
        for password in (VALID_PASSWORD, "Str0ng!!!Pass"):
            with self.subTest(password):
                self.assertEqual(backend.validate_password(password, "customer@example.com"), (None, None))

    def test_register_rejects_weak_passwords(self):
        def attempt(password):
            response = self.client.post("/api/auth/register", json={
                "firstName": "Casey",
                "lastName": "Customer",
                "email": "weak@example.com",
                "password": password,
                "acceptTerms": True,
                "acceptPrivacy": True,
            })
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json["code"], "weak_password")

        self.subtest_weak_password(attempt)

    def test_register_rejects_password_matching_email(self):
        response = self.client.post("/api/auth/register", json={
            "firstName": "Casey",
            "lastName": "Customer",
            "email": "Customer1@example.com",
            "password": "Customer1@example.com",
            "acceptTerms": True,
            "acceptPrivacy": True,
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "weak_password")

    def test_change_password_rejects_weak_passwords(self):
        token = self.register_verified_customer()

        def attempt(password):
            response = self.client.post("/api/auth/change-password", json={
                "currentPassword": VALID_PASSWORD,
                "newPassword": password,
            }, headers=self.auth_headers(token))
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json["code"], "weak_password")

        self.subtest_weak_password(attempt)

    def test_change_password_rejects_recent_passwords(self):
        token = self.register_verified_customer()
        changed = self.client.post("/api/auth/change-password", json={
            "currentPassword": VALID_PASSWORD,
            "newPassword": "N3w!Passw0rd",
        }, headers=self.auth_headers(token))
        self.assertEqual(changed.status_code, 200, changed.json)

        token = self.login(password="N3w!Passw0rd")
        for old_password in ("N3w!Passw0rd", VALID_PASSWORD):
            with self.subTest(old_password):
                response = self.client.post("/api/auth/change-password", json={
                    "currentPassword": "N3w!Passw0rd",
                    "newPassword": old_password,
                }, headers=self.auth_headers(token))
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json["code"], "weak_password")
                self.assertIn("recent passwords", response.json["message"])

    def test_reset_password_rejects_weak_passwords(self):
        self.register_verified_customer()
        token_value = "test-reset-token"
        with backend.app.app_context():
            user = backend.AppUser.query.filter_by(username="customer@example.com").one()
            backend.PasswordResetToken.query.filter_by(user_id=user.user_id).delete()
            backend.db.session.add(backend.PasswordResetToken(
                user_id=user.user_id,
                token_hash=backend.hashlib.sha256(token_value.encode("utf-8")).hexdigest(),
                expires_at=backend.utcnow() + backend.timedelta(hours=1),
            ))
            backend.db.session.commit()

        def attempt(password):
            response = self.client.post("/api/auth/reset-password", json={
                "token": token_value,
                "password": password,
            })
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json["code"], "weak_password")

        self.subtest_weak_password(attempt)

    def test_reset_password_accepts_valid_password(self):
        self.register_verified_customer()
        token_value = "test-reset-token"
        with backend.app.app_context():
            user = backend.AppUser.query.filter_by(username="customer@example.com").first()
            self.assertIsNotNone(user)
            backend.db.session.add(backend.PasswordResetToken(
                user_id=user.user_id,
                token_hash=backend.hashlib.sha256(token_value.encode("utf-8")).hexdigest(),
                expires_at=backend.utcnow() + backend.timedelta(hours=1),
            ))
            backend.db.session.commit()

        response = self.client.post("/api/auth/reset-password", json={
            "token": token_value,
            "password": "N3w!Passw0rd",
        })
        self.assertEqual(response.status_code, 200)

        login = self.client.post("/api/auth/login", json={
            "email": "customer@example.com",
            "password": "N3w!Passw0rd",
        })
        self.assertEqual(login.status_code, 200, login.json)


if __name__ == "__main__":
    unittest.main()
