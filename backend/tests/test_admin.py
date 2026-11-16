from datetime import date
import secrets
import unittest
import uuid
from app.database import get_db
from app.exceptions import APIProblemException
from app.schemas.auth import RegisterRequest
from app.schemas.admin import RejectPatientRequest
from app.routes.auth import register
from app.routes.admin import (
    get_pending_verifications, get_patient_verification_detail,
    approve_patient_verification, reject_patient_verification,
    get_system_stats, get_all_patients
)
from app.security import AuthenticatedUser


class TestAdminPortalService(unittest.TestCase):
    def setUp(self):
        self.patient_phone = f"+9198{secrets.randbelow(90000000) + 10000000}"
        self.patient_aadhaar = str(secrets.randbelow(900000000000) + 100000000000)
        self.password = "SecurePassword123!"

        # Create Admin User
        self.admin_phone = f"+9197{secrets.randbelow(90000000) + 10000000}"
        self.admin_uuid = str(uuid.uuid4())
        self.admin_pub_id = f"adm{secrets.randbelow(900000000) + 100000000}"
        self.admin_email = f"admin_{secrets.token_hex(4)}@mediclaim.gov.in"
        self.admin_user = AuthenticatedUser(
            id=f"usr_{self.admin_uuid}",
            raw_uuid=self.admin_uuid,
            public_id=self.admin_pub_id,
            mediclaim_id=self.admin_pub_id,
            full_name="Chief Hospital Administrator",
            email=self.admin_email,
            phone=self.admin_phone,
            roles=["admin", "hospital_admin"],
            is_active=True,
            admin_verified=True,
            profile_complete=True,
        )

        with get_db() as conn:
            conn.execute("""
                INSERT INTO users (id, public_id, mediclaim_id, full_name, email, phone, password_hash, admin_verified, profile_complete, is_active)
                VALUES (%s, %s, %s, 'Chief Hospital Administrator', %s, %s, 'hash', true, true, true)
                ON CONFLICT (id) DO NOTHING
            """, (self.admin_uuid, self.admin_pub_id, self.admin_pub_id, self.admin_email, self.admin_phone))
            conn.execute("""
                INSERT INTO user_roles (user_id, role) VALUES (%s, 'admin') ON CONFLICT DO NOTHING
            """, (self.admin_uuid,))

    def tearDown(self):
        pass

    def test_admin_verification_lifecycle(self):
        # 1. Register a new patient
        reg_res = register(RegisterRequest(
            fullName="Sunita Verma",
            dateOfBirth=date(1996, 5, 20),
            phone=self.patient_phone,
            aadhaarNumber=self.patient_aadhaar,
            password=self.password
        ))
        patient_user_id = reg_res["data"]["userId"]
        self.assertNotIn("mediclaimId", reg_res["data"])

        # 2. Admin lists pending verifications
        pending_res = get_pending_verifications(limit=50, query="Sunita", current_user=self.admin_user)
        self.assertEqual(pending_res["status"], "success")
        matching = [p for p in pending_res["data"] if p["userId"] == patient_user_id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["fullName"], "Sunita Verma")
        self.assertEqual(matching[0]["aadhaarMasked"], f"XXXX-XXXX-{self.patient_aadhaar[-4:]}")
        self.assertFalse(matching[0]["adminVerified"])

        # 3. Admin gets detailed view
        detail_res = get_patient_verification_detail(user_id=patient_user_id, current_user=self.admin_user)
        self.assertEqual(detail_res["status"], "success")
        self.assertEqual(detail_res["data"]["fullName"], "Sunita Verma")
        self.assertEqual(detail_res["data"]["dateOfBirth"], "1996-05-20")

        # 4. Admin approves patient registration
        approve_res = approve_patient_verification(user_id=patient_user_id, current_user=self.admin_user)
        self.assertEqual(approve_res["status"], "success")
        self.assertTrue(approve_res["data"]["adminVerified"])
        self.assertTrue(approve_res["data"]["notificationSent"])
        assigned_med_id = approve_res["data"]["mediclaimId"]
        self.assertEqual(len(assigned_med_id.replace(" ", "")), 12)

        # 5. Verify user is now marked as admin_verified in database
        with get_db() as conn:
            user_row = conn.execute("SELECT admin_verified FROM users WHERE id = %s", (patient_user_id.replace("usr_", ""),)).fetchone()
            self.assertTrue(user_row["admin_verified"])

        # 6. Admin stats check
        stats_res = get_system_stats(current_user=self.admin_user)
        self.assertEqual(stats_res["status"], "success")
        self.assertGreaterEqual(stats_res["data"]["totalPatients"], 1)
        self.assertGreaterEqual(stats_res["data"]["approvedPatients"], 1)

        # 7. Admin lists all patients
        patients_res = get_all_patients(limit=10, query="Sunita", current_user=self.admin_user)
        self.assertEqual(patients_res["status"], "success")
        self.assertTrue(any(p["userId"] == patient_user_id for p in patients_res["data"]))


if __name__ == "__main__":
    unittest.main()
