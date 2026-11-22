from datetime import date
import secrets
import unittest
from pydantic import ValidationError
from app.database import get_db
from app.exceptions import APIProblemException
from app.routes.auth import register
from app.schemas.auth import RegisterRequest


class TestRegistrationValidationSuite(unittest.TestCase):
    """
    Comprehensive tests covering all 10 validation scenarios:
    1. Submit completely empty form
    2. Submit invalid email
    3. Submit name with numbers
    4. Submit future date of birth
    5. Submit invalid mobile number
    6. Submit mobile number with fewer than 10 digits
    7. Submit Aadhaar with fewer than 12 digits
    8. Submit Aadhaar with more than 12 digits
    9. Submit valid details
    10. Submit duplicate registration
    Also verifies invalid requests never create database records.
    """

    def setUp(self):
        self.valid_name = "Rajesh Sharma"
        self.valid_email = f"rajesh_{secrets.token_hex(4)}@example.com"
        self.valid_dob = date(1992, 8, 15)
        self.valid_phone = f"+9198{secrets.randbelow(90000000) + 10000000}"
        self.valid_aadhaar = str(secrets.randbelow(900000000000) + 100000000000)
        self.valid_password = "SecurePassword123!"

    def _get_user_count(self) -> int:
        with get_db() as conn:
            row = conn.execute("SELECT count(*) as count FROM users").fetchone()
            return row["count"]

    def test_01_empty_form(self):
        initial_count = self._get_user_count()
        with self.assertRaises(ValidationError) as ctx:
            RegisterRequest.model_validate({})
        errors = {e["loc"][0]: e["msg"] for e in ctx.exception.errors()}
        self.assertIn("fullName", errors)
        self.assertIn("email", errors)
        self.assertIn("dateOfBirth", errors)
        self.assertIn("phone", errors)
        self.assertIn("aadhaarNumber", errors)
        self.assertIn("password", errors)
        self.assertEqual(self._get_user_count(), initial_count)

    def test_02_invalid_email(self):
        initial_count = self._get_user_count()
        with self.assertRaises(ValidationError) as ctx:
            RegisterRequest(
                fullName=self.valid_name,
                email="not-a-valid-email",
                dateOfBirth=self.valid_dob,
                phone=self.valid_phone,
                aadhaarNumber=self.valid_aadhaar,
                password=self.valid_password,
            )
        err = ctx.exception.errors()[0]
        self.assertIn("email", str(err["loc"]))
        self.assertIn("valid email address", err["msg"])
        self.assertEqual(self._get_user_count(), initial_count)

    def test_03_name_with_numbers(self):
        initial_count = self._get_user_count()
        with self.assertRaises(ValidationError) as ctx:
            RegisterRequest(
                fullName="Aarav123",
                email=self.valid_email,
                dateOfBirth=self.valid_dob,
                phone=self.valid_phone,
                aadhaarNumber=self.valid_aadhaar,
                password=self.valid_password,
            )
        err = ctx.exception.errors()[0]
        self.assertIn("fullName", str(err["loc"]))
        self.assertIn("valid name", err["msg"])
        self.assertEqual(self._get_user_count(), initial_count)

    def test_04_future_date_of_birth(self):
        initial_count = self._get_user_count()
        with self.assertRaises(ValidationError) as ctx:
            RegisterRequest(
                fullName=self.valid_name,
                email=self.valid_email,
                dateOfBirth=date(2035, 1, 1),
                phone=self.valid_phone,
                aadhaarNumber=self.valid_aadhaar,
                password=self.valid_password,
            )
        err = ctx.exception.errors()[0]
        self.assertIn("dateOfBirth", str(err["loc"]))
        self.assertIn("future", err["msg"])
        self.assertEqual(self._get_user_count(), initial_count)

    def test_04b_pediatric_date_of_birth_allowed(self):
        req = RegisterRequest(
            fullName=self.valid_name,
            email=self.valid_email,
            dateOfBirth=date(2020, 1, 1),  # Pediatric / minor registration allowed
            phone=self.valid_phone,
            aadhaarNumber=self.valid_aadhaar,
            password=self.valid_password,
        )
        self.assertEqual(req.dateOfBirth, date(2020, 1, 1))

    def test_05_invalid_mobile_number(self):
        initial_count = self._get_user_count()
        with self.assertRaises(ValidationError) as ctx:
            RegisterRequest(
                fullName=self.valid_name,
                email=self.valid_email,
                dateOfBirth=self.valid_dob,
                phone="1234567890",  # starts with 1 instead of 6-9
                aadhaarNumber=self.valid_aadhaar,
                password=self.valid_password,
            )
        err = ctx.exception.errors()[0]
        self.assertIn("phone", str(err["loc"]))
        self.assertIn("valid Indian mobile number", err["msg"])
        self.assertEqual(self._get_user_count(), initial_count)

    def test_06_mobile_fewer_than_10_digits(self):
        initial_count = self._get_user_count()
        with self.assertRaises(ValidationError) as ctx:
            RegisterRequest(
                fullName=self.valid_name,
                email=self.valid_email,
                dateOfBirth=self.valid_dob,
                phone="9876543",
                aadhaarNumber=self.valid_aadhaar,
                password=self.valid_password,
            )
        err = ctx.exception.errors()[0]
        self.assertIn("phone", str(err["loc"]))
        self.assertIn("exactly 10 digits", err["msg"])
        self.assertEqual(self._get_user_count(), initial_count)

    def test_07_aadhaar_fewer_than_12_digits(self):
        initial_count = self._get_user_count()
        with self.assertRaises(ValidationError) as ctx:
            RegisterRequest(
                fullName=self.valid_name,
                email=self.valid_email,
                dateOfBirth=self.valid_dob,
                phone=self.valid_phone,
                aadhaarNumber="123456",
                password=self.valid_password,
            )
        err = ctx.exception.errors()[0]
        self.assertIn("aadhaarNumber", str(err["loc"]))
        self.assertIn("exactly 12 digits", err["msg"])
        self.assertEqual(self._get_user_count(), initial_count)

    def test_08_aadhaar_more_than_12_digits(self):
        initial_count = self._get_user_count()
        with self.assertRaises(ValidationError) as ctx:
            RegisterRequest(
                fullName=self.valid_name,
                email=self.valid_email,
                dateOfBirth=self.valid_dob,
                phone=self.valid_phone,
                aadhaarNumber="1234567890123456",
                password=self.valid_password,
            )
        err = ctx.exception.errors()[0]
        self.assertIn("aadhaarNumber", str(err["loc"]))
        self.assertIn("exactly 12 digits", err["msg"])
        self.assertEqual(self._get_user_count(), initial_count)

    def test_09_valid_registration(self):
        initial_count = self._get_user_count()
        phone_10 = f"98{secrets.randbelow(90000000) + 10000000}"
        aadhaar_12 = f"88{secrets.randbelow(9000000000) + 1000000000}"
        payload = RegisterRequest(
            fullName=self.valid_name,
            email=f"valid_{secrets.token_hex(4)}@example.com",
            dateOfBirth=self.valid_dob,
            phone=phone_10,  # Test standard 10-digit format
            aadhaarNumber=f"{aadhaar_12[:4]} {aadhaar_12[4:8]} {aadhaar_12[8:]}",  # Test formatted Aadhaar
            password=self.valid_password,
        )
        self.assertEqual(payload.phone, f"+91{phone_10}")
        self.assertEqual(payload.aadhaarNumber, aadhaar_12)

        res = register(payload)
        self.assertEqual(res["status"], "success")
        self.assertTrue(res["data"]["otpSent"])
        self.assertEqual(self._get_user_count(), initial_count + 1)

    def test_10_duplicate_registration_prevention(self):
        # Register user initially
        phone = f"+9196{secrets.randbelow(90000000) + 10000000}"
        email = f"dup_{secrets.token_hex(4)}@example.com"
        aadhaar = str(secrets.randbelow(900000000000) + 100000000000)

        reg_payload = RegisterRequest(
            fullName="Duplicate Test User",
            email=email,
            dateOfBirth=date(1991, 5, 10),
            phone=phone,
            aadhaarNumber=aadhaar,
            password="SecurePassword123!",
        )
        res = register(reg_payload)
        self.assertEqual(res["status"], "success")

        # 10a. Duplicate email
        dup_email_payload = RegisterRequest(
            fullName="Another User",
            email=email,  # same email
            dateOfBirth=date(1992, 6, 12),
            phone=f"+9195{secrets.randbelow(90000000) + 10000000}",
            aadhaarNumber=str(secrets.randbelow(900000000000) + 100000000000),
            password="SecurePassword123!",
        )
        with self.assertRaises(APIProblemException) as ctx:
            register(dup_email_payload)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("email address already exists", ctx.exception.detail)

        # 10b. Duplicate phone
        dup_phone_payload = RegisterRequest(
            fullName="Another User Two",
            email=f"unique_{secrets.token_hex(4)}@example.com",
            dateOfBirth=date(1992, 6, 12),
            phone=phone,  # same phone
            aadhaarNumber=str(secrets.randbelow(900000000000) + 100000000000),
            password="SecurePassword123!",
        )
        with self.assertRaises(APIProblemException) as ctx:
            register(dup_phone_payload)
        self.assertEqual(ctx.exception.status_code, 409)

        # 10c. Duplicate Aadhaar
        dup_aadhaar_payload = RegisterRequest(
            fullName="Another User Three",
            email=f"unique2_{secrets.token_hex(4)}@example.com",
            dateOfBirth=date(1992, 6, 12),
            phone=f"+9194{secrets.randbelow(90000000) + 10000000}",
            aadhaarNumber=aadhaar,  # same Aadhaar
            password="SecurePassword123!",
        )
        with self.assertRaises(APIProblemException) as ctx:
            register(dup_aadhaar_payload)
        self.assertEqual(ctx.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
