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
    get_system_stats, get_all_patients,
    delete_patient, delete_practitioner, delete_organization, delete_user
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
            email=f"sunita_{secrets.token_hex(4)}@example.com",
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

        # 5b. Verify status filters in verifications list
        verified_res = get_pending_verifications(limit=50, query="Sunita", status="verified", current_user=self.admin_user)
        self.assertTrue(any(p["userId"] == patient_user_id and p["adminVerified"] for p in verified_res["data"]))

        all_res = get_pending_verifications(limit=50, query="Sunita", status="all", current_user=self.admin_user)
        self.assertTrue(any(p["userId"] == patient_user_id for p in all_res["data"]))

        pending_again = get_pending_verifications(limit=50, query="Sunita", status="pending", current_user=self.admin_user)
        self.assertFalse(any(p["userId"] == patient_user_id for p in pending_again["data"]))

        # 6. Admin stats check
        stats_res = get_system_stats(current_user=self.admin_user)
        self.assertEqual(stats_res["status"], "success")
        self.assertGreaterEqual(stats_res["data"]["totalPatients"], 1)
        self.assertGreaterEqual(stats_res["data"]["approvedPatients"], 1)

        # 7. Admin lists all patients
        patients_res = get_all_patients(limit=10, query="Sunita", current_user=self.admin_user)
        self.assertEqual(patients_res["status"], "success")
        self.assertTrue(any(p["userId"] == patient_user_id for p in patients_res["data"]))

        # 8. Admin removes patient
        del_res = delete_patient(patient_id=patient_user_id, current_user=self.admin_user)
        self.assertEqual(del_res["status"], "success")
        self.assertTrue(del_res["data"]["removed"])

        # 9. Verify patient is completely removed
        with get_db() as conn:
            check_u = conn.execute("SELECT id FROM users WHERE id = %s", (patient_user_id.replace("usr_", ""),)).fetchone()
            self.assertIsNone(check_u)

    def test_admin_remove_doctor(self):
        from app.services.hospital_service import create_practitioner
        from app.schemas.hospital import PractitionerCreateInput

        doc_phone = f"+9196{secrets.randbelow(90000000) + 10000000}"
        doc_reg = f"TEST-REG-{secrets.token_hex(4).upper()}"
        doc_res = create_practitioner(PractitionerCreateInput(
            fullName="Dr. Alok Verma",
            registrationNumber=doc_reg,
            phone=doc_phone,
            password="DoctorSecurePass1!",
            specialization="Neurology"
        ))
        practitioner_id = doc_res["id"]

        del_res = delete_practitioner(practitioner_id=practitioner_id, current_user=self.admin_user)
        self.assertEqual(del_res["status"], "success")
        self.assertTrue(del_res["data"]["removed"])

        # Verify doctor is removed
        with get_db() as conn:
            check_p = conn.execute("SELECT id FROM practitioner_profiles WHERE registration_number = %s", (doc_reg,)).fetchone()
            self.assertIsNone(check_p)

    def test_admin_remove_organization(self):
        from app.services.hospital_service import create_organization
        from app.schemas.hospital import OrganizationCreateInput

        org_reg = f"TEST-HOSP-{secrets.token_hex(4).upper()}"
        org_res = create_organization(OrganizationCreateInput(
            name="Apex Specialty Clinic",
            organizationType="clinic",
            registrationNumber=org_reg,
            phone="+919500000001",
            address="123 Health Ave"
        ))
        org_id = org_res["publicId"]

        del_res = delete_organization(org_id=org_id, current_user=self.admin_user)
        self.assertEqual(del_res["status"], "success")
        self.assertTrue(del_res["data"]["removed"])

        # Verify organization is removed
        with get_db() as conn:
            check_o = conn.execute("SELECT id FROM healthcare_organizations WHERE registration_number = %s", (org_reg,)).fetchone()
            self.assertIsNone(check_o)


if __name__ == "__main__":
    unittest.main()
