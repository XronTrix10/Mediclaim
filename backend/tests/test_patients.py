import unittest
from datetime import date
from app.schemas.auth import RegisterRequest, VerifyOTPRequest
from app.schemas.patient import CompleteProfileRequest, PermittedDetailsUpdateRequest, EmergencyContact
from app.routes.auth import register, verify_otp
from app.routes.patients import get_my_profile, complete_profile, update_details
from app.security import hash_otp, AuthenticatedUser
from app.database import get_db, init_db

class TestPatientProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        self.phone = "+919111122222"
        self.aadhaar = "112233445566"
        self.password = "SecurePassword123!"

        with get_db() as conn:
            conn.execute("DELETE FROM users WHERE phone = %s OR aadhaar_number = %s", (self.phone, self.aadhaar))

        # Register user
        reg_res = register(RegisterRequest(
            fullName="Ananya Rao",
            dateOfBirth=date(1994, 5, 12),
            phone=self.phone,
            aadhaarNumber=self.aadhaar,
            password=self.password
        ))
        self.user_id = reg_res["data"]["userId"]
        self.mediclaim_id = reg_res["data"]["mediclaimId"]

        # Verify OTP
        otp = "789123"
        with get_db() as conn:
            conn.execute("UPDATE users SET otp_hash = %s, otp_expires_at = 9999999999 WHERE phone = %s", (hash_otp(otp), self.phone))
        verify_res = verify_otp(VerifyOTPRequest(userId=self.user_id, otp=otp))

        self.auth_user = AuthenticatedUser(
            id=self.user_id,
            raw_uuid=self.user_id.replace("usr_", ""),
            public_id=self.mediclaim_id.replace(" ", ""),
            mediclaim_id=self.mediclaim_id,
            full_name="Ananya Rao",
            email=None,
            phone=self.phone,
            roles=["patient"],
            is_active=True,
            admin_verified=False,
            profile_complete=False
        )

    def tearDown(self):
        with get_db() as conn:
            conn.execute("DELETE FROM users WHERE phone = %s", (self.phone,))

    def test_patient_profile_lifecycle(self):
        # 1. Get profile (incomplete initially)
        profile_res = get_my_profile(current_user=self.auth_user)
        self.assertEqual(profile_res["status"], "success")
        data = profile_res["data"]
        self.assertEqual(data["fullName"], "Ananya Rao")
        self.assertEqual(data["firstName"], "Ananya")
        self.assertEqual(data["dateOfBirth"], "1994-05-12")
        self.assertEqual(data["aadhaarMasked"], "XXXX-XXXX-5566")
        self.assertFalse(data["isProfileComplete"])

        # 2. Complete profile
        comp_payload = CompleteProfileRequest(
            gender="Female",
            bloodGroup="O+",
            address="Flat 402, Sea View Apartments, Shivaji Park, Mumbai",
            emergencyName="Lakshmi Rao",
            emergencyPhone="+919876512345",
            emergencyRelation="Mother"
        )
        comp_res = complete_profile(comp_payload, current_user=self.auth_user)
        self.assertEqual(comp_res["status"], "success")
        self.assertTrue(comp_res["data"]["isProfileComplete"])

        # 3. Verify profile reflects completed details
        profile_res2 = get_my_profile(current_user=self.auth_user)
        data2 = profile_res2["data"]
        self.assertTrue(data2["isProfileComplete"])
        self.assertEqual(data2["gender"], "Female")
        self.assertEqual(data2["bloodGroup"], "O+")
        self.assertEqual(data2["emergencyContact"]["name"], "Lakshmi Rao")
        self.assertEqual(data2["emergencyContact"]["relation"], "Mother")

        # 4. Update permitted details
        update_payload = PermittedDetailsUpdateRequest(
            address="Bungalow 12, Koregaon Park, Pune – 411001",
            emergencyContact=EmergencyContact(
                name="Lakshmi Rao",
                phone="+919876588888",
                relation="Mother"
            )
        )
        update_res = update_details(update_payload, current_user=self.auth_user)
        self.assertEqual(update_res["status"], "success")
        self.assertEqual(update_res["data"]["address"], "Bungalow 12, Koregaon Park, Pune – 411001")
        self.assertEqual(update_res["data"]["emergencyContact"]["phone"], "+919876588888")

if __name__ == "__main__":
    unittest.main()
