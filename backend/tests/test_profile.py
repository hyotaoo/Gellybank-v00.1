import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SKIP_DEMO_SEED"] = "1"

from backend import app as backend


class ProfileUpdateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        backend.app.config["TESTING"] = True
        cls.client = backend.app.test_client()

    def setUp(self):
        with backend.app.app_context():
            backend.db.drop_all()
            backend.db.create_all()
            customer = backend.Customer(
                customer_id=1,
                first_name="Casey",
                last_name="Customer",
                email="customer@example.com",
            )
            backend.db.session.add(customer)
            backend.db.session.flush()
            self.user = backend.AppUser(
                user_id=1,
                customer_id=customer.customer_id,
                username="customer@example.com",
                password_hash=backend.hash_password("customer123"),
                role="CUSTOMER",
                email_verified_at=backend.utcnow(),
            )
            backend.db.session.add(self.user)
            backend.db.session.commit()
            self.token = backend.make_token(self.user)

    def auth_headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def patch_profile(self, payload):
        return self.client.patch("/api/profile", json=payload, headers=self.auth_headers())

    def test_update_profile_rejects_name_with_digits(self):
        response = self.patch_profile({"firstName": "C4sey"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")
        self.assertIn("letters", response.json["message"])

    def test_update_profile_rejects_empty_first_name(self):
        response = self.patch_profile({"firstName": "   "})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")
        self.assertIn("required", response.json["message"])

    def test_update_profile_rejects_single_character_name(self):
        response = self.patch_profile({"lastName": "C"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")

    def test_update_profile_rejects_overly_long_name(self):
        response = self.patch_profile({"lastName": "C" * 51})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")

    def test_update_profile_rejects_invalid_middle_name_when_provided(self):
        response = self.patch_profile({"middleName": "de la @"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["code"], "invalid_name")

    def test_update_profile_allows_punctuation_and_updates_names(self):
        response = self.patch_profile({
            "firstName": "Anne-Marie",
            "middleName": "D.",
            "lastName": "O'Brien",
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["firstName"], "Anne-Marie")
        self.assertEqual(response.json["middleName"], "D.")
        self.assertEqual(response.json["lastName"], "O'Brien")

    def test_update_profile_allows_clearing_middle_name(self):
        response = self.patch_profile({"middleName": ""})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json["middleName"])


if __name__ == "__main__":
    unittest.main()
