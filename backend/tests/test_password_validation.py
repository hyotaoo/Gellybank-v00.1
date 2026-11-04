import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SKIP_DEMO_SEED"] = "1"

from backend import app as backend
from backend import email_service


WEAK_CASES = [
    ("1", "single character"),
    ("short1a", "under 8 characters"),
    ("12345678", "digits only"),
    ("abcdefgh", "letters only"),
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

    def register_verified_customer(self, email="customer@example.com", password="customer123"):
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

    def subtest_weak_password(self, fn):
        for password, description in WEAK_CASES:
            with self.subTest(description):
                fn(password)

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

    def test_change_password_rejects_weak_passwords(self):
        token = self.register_verified_customer()

        def attempt(password):
            response = self.client.post("/api/auth/change-password", json={
                "currentPassword": "customer123",
                "newPassword": password,
            }, headers=self.auth_headers(token))
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json["code"], "weak_password")

        self.subtest_weak_password(attempt)

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
            "password": "newsecure1",
        })
        self.assertEqual(response.status_code, 200)

        login = self.client.post("/api/auth/login", json={
            "email": "customer@example.com",
            "password": "newsecure1",
        })
        self.assertEqual(login.status_code, 200, login.json)


if __name__ == "__main__":
    unittest.main()
