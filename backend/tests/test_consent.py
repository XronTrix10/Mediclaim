import unittest
import secrets
from datetime import date
from app.schemas.auth import RegisterRequest, VerifyOTPRequest
from app.schemas.records import NewAllergyInput, NewConditionInput
from app.schemas.consent import (
    AccessRequestInput, ApproveRequestInput, GiveAccessInput, NewCaregiverInput
)
from app.routes.auth import register, verify_otp
from app.routes.records import record_allergy, record_condition
from app.routes.consent import (
    request_access, get_requests, approve_request, get_grants,
    give_access, revoke_grant, get_caregivers, create_caregiver, delete_caregiver
)
from app.routes.doctor import get_authorized_patient, get_authorized_records
from app.security import hash_otp, AuthenticatedUser
from app.database import get_db, init_db
from app.exceptions import APIProblemException

class TestConsentAndDoctorAccess(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        self.patient_phone = "+919777788888"
        self.patient_aadhaar = "778899001122"
        self.doctor_phone = "+919777799999"
        self.doctor_aadhaar = "778899001133"
        self.password = "SecurePassword123!"

        with get_db() as conn:
            conn.execute("DELETE FROM users WHERE phone IN (%s, %s)", (self.patient_phone, self.doctor_phone))

        # 1. Register Patient
        pat_reg = register(RegisterRequest(
            fullName="Patient Consent Test",
            email=f"pat_consent_{secrets.token_hex(4)}@example.com",
            dateOfBirth=date(1995, 6, 20),
            phone=self.patient_phone,
            aadhaarNumber=self.patient_aadhaar,
            password=self.password
        ))
        self.patient_user_id = pat_reg["data"]["userId"]
        with get_db() as conn:
            row = conn.execute("SELECT mediclaim_id FROM users WHERE phone = %s", (self.patient_phone,)).fetchone()
            self.patient_med_id = row["mediclaim_id"]

        otp = "123123"
        with get_db() as conn:
            conn.execute("UPDATE users SET otp_hash = %s, otp_expires_at = 9999999999 WHERE phone = %s", (hash_otp(otp), self.patient_phone))
        verify_otp(VerifyOTPRequest(userId=self.patient_user_id, otp=otp))

        with get_db() as conn:
            pat_row = conn.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (self.patient_user_id.replace("usr_", ""),)).fetchone()
            self.patient_profile_id = str(pat_row["id"])

        self.patient_user = AuthenticatedUser(
            id=self.patient_user_id,
            raw_uuid=self.patient_user_id.replace("usr_", ""),
            public_id=self.patient_med_id.replace(" ", ""),
            mediclaim_id=self.patient_med_id,
            full_name="Patient Consent Test",
            email=None,
            phone=self.patient_phone,
            roles=["patient"],
            is_active=True,
            admin_verified=False,
            profile_complete=True,
            patient_profile_id=self.patient_profile_id
        )

        # 2. Register Doctor User
        doc_reg = register(RegisterRequest(
            fullName="Dr. Farhan Ali",
            email=f"dr_farhan_{secrets.token_hex(4)}@example.com",
            dateOfBirth=date(1985, 3, 10),
            phone=self.doctor_phone,
            aadhaarNumber=self.doctor_aadhaar,
            password=self.password
        ))
        self.doctor_user_id = doc_reg["data"]["userId"]
        with get_db() as conn:
            row = conn.execute("SELECT mediclaim_id FROM users WHERE phone = %s", (self.doctor_phone,)).fetchone()
            self.doctor_med_id = row["mediclaim_id"]

        with get_db() as conn:
            conn.execute("UPDATE users SET otp_hash = %s, otp_expires_at = 9999999999 WHERE phone = %s", (hash_otp(otp), self.doctor_phone))
        verify_otp(VerifyOTPRequest(userId=self.doctor_user_id, otp=otp))

        with get_db() as conn:
            # Add doctor role and practitioner profile
            doc_raw_uuid = self.doctor_user_id.replace("usr_", "")
            conn.execute("INSERT INTO user_roles (user_id, role) VALUES (%s, 'practitioner') ON CONFLICT DO NOTHING", (doc_raw_uuid,))
            conn.execute("""
                INSERT INTO practitioner_profiles (id, public_id, user_id, registration_number, specialization)
                VALUES (gen_random_uuid(), 'doc123456789', %s, 'REG-123456', 'Dermatologist')
                ON CONFLICT (user_id) DO NOTHING
            """, (doc_raw_uuid,))
            doc_prof = conn.execute("SELECT id FROM practitioner_profiles WHERE user_id = %s", (doc_raw_uuid,)).fetchone()
            self.doc_prof_id = str(doc_prof["id"])

        self.doctor_user = AuthenticatedUser(
            id=self.doctor_user_id,
            raw_uuid=self.doctor_user_id.replace("usr_", ""),
            public_id="doc123456789",
            mediclaim_id=self.doctor_med_id,
            full_name="Dr. Farhan Ali",
            email=None,
            phone=self.doctor_phone,
            roles=["practitioner"],
            is_active=True,
            admin_verified=True,
            profile_complete=True,
            practitioner_profile_id=self.doc_prof_id
        )

        # Seed records for patient: Allergy and Condition
        record_allergy(NewAllergyInput(
            allergen="Penicillin",
            category="medication",
            severity="severe",
            criticality="high",
            reaction="Hives",
            provider="Clinic A"
        ), current_user=self.patient_user)

        record_condition(NewConditionInput(
            conditionName="Hypertension",
            status="active",
            provider="Clinic B"
        ), current_user=self.patient_user)

    def tearDown(self):
        with get_db() as conn:
            conn.execute("DELETE FROM patient_caregivers WHERE patient_id = %s", (self.patient_profile_id,))
            conn.execute("DELETE FROM access_grant_scopes WHERE access_grant_id IN (SELECT id FROM patient_access_grants WHERE patient_id = %s)", (self.patient_profile_id,))
            conn.execute("DELETE FROM patient_access_grants WHERE patient_id = %s", (self.patient_profile_id,))
            conn.execute("DELETE FROM allergies WHERE patient_id = %s", (self.patient_profile_id,))
            conn.execute("DELETE FROM conditions WHERE patient_id = %s", (self.patient_profile_id,))
            conn.execute("DELETE FROM clinical_records WHERE patient_id = %s", (self.patient_profile_id,))
            conn.execute("DELETE FROM practitioner_profiles WHERE user_id = %s", (self.doctor_user_id.replace("usr_", ""),))
            conn.execute("DELETE FROM users WHERE phone IN (%s, %s)", (self.patient_phone, self.doctor_phone))

    def test_consent_request_and_scoped_access_flow(self):
        # 1. Doctor requests access to patient
        req_res = request_access(AccessRequestInput(
            patientMediclaimId=self.patient_med_id,
            scope=["allergy"],
            durationHours=2,
            purpose="Skin rash evaluation"
        ), current_user=self.doctor_user)
        self.assertEqual(req_res["status"], "success")
        req_id = req_res["data"]["requestId"]
        self.assertTrue(req_id.startswith("req_"))

        # 2. Patient lists pending requests
        list_req = get_requests(status="pending", current_user=self.patient_user)
        self.assertEqual(len(list_req["data"]), 1)
        self.assertEqual(list_req["data"][0]["name"], "Dr. Farhan Ali")

        # 3. Patient approves request
        app_res = approve_request(
            id=req_id,
            payload=ApproveRequestInput(approvedScope=["allergy"], durationHours=2),
            current_user=self.patient_user
        )
        self.assertEqual(app_res["status"], "success")
        grant_id = app_res["data"]["grantId"]

        # 4. Doctor reads patient profile and records under approved scope
        doc_view = get_authorized_patient(mediclaim_id=self.patient_med_id, current_user=self.doctor_user)
        self.assertEqual(doc_view["status"], "success")
        self.assertEqual(doc_view["data"]["fullName"], "Patient Consent Test")

        records_view = get_authorized_records(mediclaim_id=self.patient_med_id, current_user=self.doctor_user)
        self.assertEqual(records_view["status"], "success")
        # Should only have allergy records (1 record), NOT condition
        self.assertEqual(len(records_view["data"]["records"]), 1)
        self.assertEqual(records_view["data"]["records"][0]["kind"], "allergy")

        # 5. Doctor tries to access out-of-scope kind (condition)
        with self.assertRaises(APIProblemException) as ctx:
            get_authorized_records(mediclaim_id=self.patient_med_id, kind="condition", current_user=self.doctor_user)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(ctx.exception.code, "SCOPE_UNAUTHORIZED")

        # 6. Patient revokes access
        rev_res = revoke_grant(id=grant_id, current_user=self.patient_user)
        self.assertEqual(rev_res["status"], "success")

        # 7. Doctor tries to access after revocation
        with self.assertRaises(APIProblemException) as ctx2:
            get_authorized_records(mediclaim_id=self.patient_med_id, current_user=self.doctor_user)
        self.assertEqual(ctx2.exception.status_code, 403)
        self.assertEqual(ctx2.exception.code, "CONSENT_EXPIRED")

    def test_caregiver_lifecycle(self):
        # 1. Add Caregiver
        cg_res = create_caregiver(NewCaregiverInput(
            name="Lakshmi Rao",
            relation="Mother",
            scope=["allergy", "medication"]
        ), current_user=self.patient_user)
        self.assertEqual(cg_res["status"], "success")
        cg_id = cg_res["data"]["id"]

        # 2. List Caregivers
        cg_list = get_caregivers(current_user=self.patient_user)
        self.assertEqual(len(cg_list["data"]), 1)
        self.assertEqual(cg_list["data"][0]["name"], "Lakshmi Rao")

        # 3. Remove Caregiver
        del_res = delete_caregiver(id=cg_id, current_user=self.patient_user)
        self.assertEqual(del_res["status"], "success")

        # 4. Verify Removed
        cg_list2 = get_caregivers(current_user=self.patient_user)
        self.assertEqual(len(cg_list2["data"]), 0)

if __name__ == "__main__":
    unittest.main()
