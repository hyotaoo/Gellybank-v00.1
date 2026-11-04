import os
import unittest
from datetime import timedelta

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SKIP_DEMO_SEED"] = "1"

from backend import app as backend
from backend import email_service


REGISTRATION = {
    "firstName": "Riley",
    "lastName": "Rivera",
    "email": "riley@example.com",
    "password": "rivera123",
    "acceptTerms": True,
    "acceptPrivacy": True,
}


class EmailVerificationTests(unittest.TestCase):
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

    def register(self, **overrides):
        payload = {**REGISTRATION, **overrides}
        return self.client.post("/api/auth/register", json=payload)

    def latest_code(self):
        return email_service.OUTBOX[-1]["code"]

    def test_registration_rejects_name_with_digits(self):
        response = self.register(firstName="R1ley")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")
        self.assertIn("letters", response.json["message"])

    def test_registration_rejects_missing_first_name(self):
        response = self.register(firstName="   ")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")
        self.assertIn("required", response.json["message"])

    def test_registration_rejects_single_character_name(self):
        response = self.register(lastName="R")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")

    def test_registration_rejects_overly_long_name(self):
        response = self.register(lastName="R" * 51)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")

    def test_registration_rejects_invalid_middle_name_when_provided(self):
        response = self.register(middleName="de la @")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")

    def test_registration_allows_names_with_punctuation_and_accented_letters(self):
        response = self.register(
            firstName="José-María",
            middleName="D. Santos",
            lastName="O'Brien",
            email="punctuation@example.com",
        )
        self.assertEqual(response.status_code, 201)

    def test_registration_allows_empty_middle_name(self):
        response = self.register(email="nomiddle@example.com")
        self.assertEqual(response.status_code, 201)

    def test_registration_requires_email_verification_before_login(self):
        response = self.register()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["email"], "riley@example.com")
        self.assertNotIn("token", response.json)
        self.assertEqual(len(email_service.OUTBOX), 1)

        login = self.client.post(
            "/api/auth/login",
            json={"email": "riley@example.com", "password": "rivera123"},
        )
        self.assertEqual(login.status_code, 403)
        self.assertEqual(login.json["code"], "email_not_verified")

    def test_correct_code_verifies_and_returns_token(self):
        self.register()
        response = self.client.post(
            "/api/auth/verify-email",
            json={"email": "riley@example.com", "code": self.latest_code()},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json["token"])

        with backend.app.app_context():
            user = backend.AppUser.query.filter_by(username="riley@example.com").first()
            self.assertIsNotNone(user.email_verified_at)
            self.assertEqual(backend.EmailVerificationToken.query.count(), 0)

        login = self.client.post(
            "/api/auth/login",
            json={"email": "riley@example.com", "password": "rivera123"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.json["token"])

    def test_wrong_code_is_rejected_and_counts_attempts(self):
        self.register()
        wrong_code = "000000" if self.latest_code() != "000000" else "111111"
        for _ in range(backend.VERIFICATION_MAX_ATTEMPTS):
            response = self.client.post(
                "/api/auth/verify-email",
                json={"email": "riley@example.com", "code": wrong_code},
            )
            self.assertEqual(response.status_code, 400)

        blocked = self.client.post(
            "/api/auth/verify-email",
            json={"email": "riley@example.com", "code": self.latest_code()},
        )
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json["code"], "too_many_attempts")

    def test_expired_code_is_rejected(self):
        self.register()
        with backend.app.app_context():
            record = backend.EmailVerificationToken.query.one()
            record.expires_at = backend.utcnow() - timedelta(minutes=1)
            backend.db.session.commit()

        response = self.client.post(
            "/api/auth/verify-email",
            json={"email": "riley@example.com", "code": self.latest_code()},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_verification_code")

    def test_resend_rotates_the_code(self):
        self.register()
        first_code = self.latest_code()

        with backend.app.app_context():
            record = backend.EmailVerificationToken.query.one()
            record.created_at = backend.utcnow() - timedelta(seconds=61)
            backend.db.session.commit()

        response = self.client.post(
            "/api/auth/resend-verification", json={"email": "riley@example.com"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(email_service.OUTBOX), 2)
        self.assertNotEqual(first_code, self.latest_code())

        verified = self.client.post(
            "/api/auth/verify-email",
            json={"email": "riley@example.com", "code": self.latest_code()},
        )
        self.assertEqual(verified.status_code, 200)

    def test_registration_records_consent_version_and_timestamps(self):
        response = self.register()
        self.assertEqual(response.status_code, 201)

        with backend.app.app_context():
            customer = backend.Customer.query.filter_by(email="riley@example.com").one()
            self.assertEqual(customer.consent_version, backend.CONSENT_VERSION)
            self.assertIsNotNone(customer.terms_accepted_at)
            self.assertIsNotNone(customer.privacy_accepted_at)

    def test_registration_requires_terms_and_privacy_consent(self):
        terms = self.register(acceptTerms=False)
        self.assertEqual(terms.status_code, 400)
        self.assertEqual(terms.json["code"], "terms_not_accepted")

        privacy = self.register(acceptPrivacy=False)
        self.assertEqual(privacy.status_code, 400)
        self.assertEqual(privacy.json["code"], "privacy_not_accepted")


if __name__ == "__main__":
    unittest.main()
