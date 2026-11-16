import unittest
from datetime import date
from app.schemas.auth import (
    RegisterRequest, VerifyOTPRequest, LoginRequest, RequestOTPRequest, ResendOTPRequest
)
from app.routes.auth import register, verify_otp, login, request_otp, resend_user_otp, refresh_token
from app.security import (
    verhoeff_validate, generate_mediclaim_id, format_mediclaim_id,
    hash_otp, get_current_user, AuthenticatedUser
)
from app.database import get_db
from app.exceptions import APIProblemException

class TestAuthAndSecurity(unittest.TestCase):
    def test_verhoeff_algorithm(self):
        # Test 10 randomly generated Mediclaim IDs
        for _ in range(10):
            mid = generate_mediclaim_id()
            self.assertEqual(len(mid), 12)
            self.assertTrue(verhoeff_validate(mid), f"Valid ID failed: {mid}")
            # Corrupt single digit
            corrupted = mid[:-1] + str((int(mid[-1]) + 1) % 10)
            self.assertFalse(verhoeff_validate(corrupted), f"Corrupted ID passed: {corrupted}")

        formatted = format_mediclaim_id("123456789012")
        self.assertEqual(formatted, "1234 5678 9012")

    def test_auth_registration_and_login_flow(self):
        phone = "+919999988888"
        aadhaar = "998877665544"
        password = "SecurePassword123!"

        # Clean up any existing test user with this phone or aadhaar
        with get_db() as conn:
            conn.execute("DELETE FROM users WHERE phone = %s OR aadhaar_number = %s", (phone, aadhaar))

        # 1. Register
        reg_payload = RegisterRequest(
            fullName="Test User",
            dateOfBirth=date(1990, 1, 1),
            phone=phone,
            aadhaarNumber=aadhaar,
            password=password
        )
        res = register(reg_payload)
        self.assertEqual(res["status"], "success")
        user_id = res["data"]["userId"]
        mediclaim_id = res["data"]["mediclaimId"]
        self.assertEqual(len(mediclaim_id.replace(" ", "")), 12)

        # 2. Duplicate registration test
        with self.assertRaises(APIProblemException) as ctx:
            register(reg_payload)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.code, "ACCOUNT_ALREADY_EXISTS")

        # 3. Verify OTP
        with self.assertRaises(APIProblemException) as ctx:
            verify_otp(VerifyOTPRequest(userId=user_id, otp="000000"))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.code, "INVALID_OTP")

        # Set known OTP
        test_otp = "123456"
        with get_db() as conn:
            conn.execute("UPDATE users SET otp_hash = %s, otp_expires_at = 9999999999 WHERE phone = %s", (hash_otp(test_otp), phone))

        # Successful verification
        verify_res = verify_otp(VerifyOTPRequest(userId=user_id, otp=test_otp))
        self.assertEqual(verify_res["status"], "success")
        verify_data = verify_res["data"]
        token = verify_data["accessToken"]
        self.assertTrue(token)
        self.assertEqual(verify_data["user"]["phone"], phone)

        # 4. Login with password
        login_res = login(LoginRequest(mediclaimId=mediclaim_id, password=password))
        self.assertEqual(login_res["status"], "success")
        login_data = login_res["data"]
        self.assertTrue(login_data["accessToken"])

        # 5. Refresh token
        auth_user = AuthenticatedUser(
            id=user_id,
            raw_uuid=user_id.replace("usr_", ""),
            public_id=mediclaim_id.replace(" ", ""),
            mediclaim_id=mediclaim_id,
            full_name="Test User",
            email=None,
            phone=phone,
            roles=["patient"],
            is_active=True,
            admin_verified=False,
            profile_complete=False
        )
        refreshed = refresh_token(current_user=auth_user)
        self.assertEqual(refreshed["status"], "success")
        self.assertTrue(refreshed["data"]["accessToken"])

        # 6. Request login OTP & Login with OTP
        req_otp_res = request_otp(RequestOTPRequest(mediclaimId=mediclaim_id))
        self.assertEqual(req_otp_res["status"], "success")

        login_otp = "654321"
        with get_db() as conn:
            conn.execute("UPDATE users SET otp_hash = %s, otp_expires_at = 9999999999 WHERE phone = %s", (hash_otp(login_otp), phone))

        otp_login_res = login(LoginRequest(mediclaimId=mediclaim_id, otp=login_otp))
        self.assertEqual(otp_login_res["status"], "success")
        self.assertTrue(otp_login_res["data"]["accessToken"])

        # 7. Resend OTP
        resend_res = resend_user_otp(ResendOTPRequest(userId=user_id))
        self.assertEqual(resend_res["status"], "success")

        # 8. Clean up
        with get_db() as conn:
            conn.execute("DELETE FROM users WHERE phone = %s", (phone,))

if __name__ == "__main__":
    unittest.main()
