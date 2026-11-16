import unittest
import secrets
from datetime import date
from app.schemas.auth import RegisterRequest, VerifyOTPRequest
from app.schemas.records import NewAllergyInput, NewConditionInput
from app.schemas.emergency import EmergencyAccessInput
from app.schemas.corrections import CorrectionRequestInput, CorrectionReviewInput
from app.routes.auth import register, verify_otp
from app.routes.records import record_allergy, record_condition
from app.routes.emergency import emergency_access, get_emergency_events
from app.routes.audit import get_audit_logs
from app.routes.corrections import (
    request_correction, get_my_corrections, review_patient_correction, record_history
)
from app.routes.uploads import upload_document, download_document_content
from app.services.audit_service import record_audit
from app.security import hash_otp, AuthenticatedUser
from app.database import get_db, init_db

class TestEmergencyAuditCorrections(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        rand_suffix = secrets.token_hex(4)
        self.patient_phone = f"+9198{secrets.randbelow(90000000) + 10000000}"
        self.doctor_phone = f"+9199{secrets.randbelow(90000000) + 10000000}"
        self.patient_aadhaar = str(secrets.randbelow(900000000000) + 100000000000)
        self.doctor_aadhaar = str(secrets.randbelow(900000000000) + 100000000000)
        self.password = "SecurePassword123!"

        # Register Patient
        pat_reg = register(RegisterRequest(
            fullName="Patient Emergency Test",
            dateOfBirth=date(1993, 8, 25),
            phone=self.patient_phone,
            aadhaarNumber=self.patient_aadhaar,
            password=self.password
        ))
        self.patient_user_id = pat_reg["data"]["userId"]
        with get_db() as conn:
            row = conn.execute("SELECT mediclaim_id FROM users WHERE phone = %s", (self.patient_phone,)).fetchone()
            self.patient_med_id = row["mediclaim_id"]

        otp = "334455"
        with get_db() as conn:
            conn.execute("UPDATE users SET otp_hash = %s, otp_expires_at = 9999999999 WHERE phone = %s", (hash_otp(otp), self.patient_phone))
        verify_otp(VerifyOTPRequest(userId=self.patient_user_id, otp=otp))

        with get_db() as conn:
            pat_row = conn.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (self.patient_user_id.replace("usr_", ""),)).fetchone()
            self.patient_profile_id = str(pat_row["id"])
            # Set blood group
            conn.execute("UPDATE patient_profiles SET blood_group = 'O+' WHERE id = %s", (self.patient_profile_id,))

        self.patient_user = AuthenticatedUser(
            id=self.patient_user_id,
            raw_uuid=self.patient_user_id.replace("usr_", ""),
            public_id=self.patient_med_id.replace(" ", ""),
            mediclaim_id=self.patient_med_id,
            full_name="Patient Emergency Test",
            email=None,
            phone=self.patient_phone,
            roles=["patient"],
            is_active=True,
            admin_verified=False,
            profile_complete=True,
            patient_profile_id=self.patient_profile_id
        )

        # Register ER Doctor
        doc_reg = register(RegisterRequest(
            fullName="Dr. Rohan Kulkarni",
            dateOfBirth=date(1982, 11, 5),
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

        self.doctor_user = AuthenticatedUser(
            id=self.doctor_user_id,
            raw_uuid=self.doctor_user_id.replace("usr_", ""),
            public_id="docER12345678",
            mediclaim_id=self.doctor_med_id,
            full_name="Dr. Rohan Kulkarni",
            email=None,
            phone=self.doctor_phone,
            roles=["practitioner"],
            is_active=True,
            admin_verified=True,
            profile_complete=True
        )

        # Seed severe allergy and active condition
        self.alg = record_allergy(NewAllergyInput(
            allergen="Penicillin",
            category="medication",
            severity="severe",
            criticality="high",
            reaction="Bronchospasm",
            provider="ER Unit"
        ), current_user=self.patient_user)["data"]

        self.cond = record_condition(NewConditionInput(
            conditionName="Asthma",
            status="active",
            provider="ER Unit"
        ), current_user=self.patient_user)["data"]

    def tearDown(self):
        with get_db() as conn:
            conn.execute("DELETE FROM record_correction_requests WHERE patient_id = %s", (self.patient_profile_id,))
            conn.execute("DELETE FROM clinical_record_versions WHERE clinical_record_id IN (SELECT id FROM clinical_records WHERE patient_id = %s)", (self.patient_profile_id,))
            conn.execute("DELETE FROM medical_documents WHERE patient_id = %s", (self.patient_profile_id,))
            conn.execute("DELETE FROM allergies WHERE patient_id = %s", (self.patient_profile_id,))
            conn.execute("DELETE FROM conditions WHERE patient_id = %s", (self.patient_profile_id,))
            conn.execute("DELETE FROM clinical_records WHERE patient_id = %s", (self.patient_profile_id,))

    def test_emergency_protocol(self):
        # 1. ER Doctor invokes break-glass access
        emg_res = emergency_access(EmergencyAccessInput(
            patientMediclaimId=self.patient_med_id,
            emergencyType="TRAUMA_RESUSCITATION",
            clinicalJustification="Patient unconscious in ER following motor vehicle accident. Immediate verification required."
        ), current_user=self.doctor_user)

        self.assertEqual(emg_res["status"], "success")
        data = emg_res["data"]
        self.assertEqual(data["emergencyStatus"], "emergency_granted")
        self.assertEqual(data["criticalSummary"]["bloodGroup"], "O+")
        self.assertEqual(len(data["criticalSummary"]["criticalAllergies"]), 1)
        self.assertEqual(data["criticalSummary"]["criticalAllergies"][0]["allergen"], "Penicillin")

        # 2. Patient can view emergency break-glass event
        events_res = get_emergency_events(current_user=self.patient_user)
        self.assertEqual(len(events_res["data"]), 1)
        self.assertEqual(events_res["data"][0]["emergencyType"], "TRAUMA_RESUSCITATION")

    def test_audit_and_corrections_flow(self):
        # 1. Record an audit event
        record_audit(
            actor_user_id=self.doctor_user.id,
            patient_id=self.patient_profile_id,
            action="view",
            what="viewed clinical history",
            actor_name="Dr. Rohan Kulkarni",
            actor_role="Practitioner",
            resource_kinds=["allergy", "condition"]
        )

        logs_res = get_audit_logs(current_user=self.patient_user)
        self.assertEqual(logs_res["status"], "success")
        self.assertGreaterEqual(len(logs_res["data"]), 1)
        self.assertEqual(logs_res["data"][0]["who"], "Dr. Rohan Kulkarni")

        # 2. Patient submits a correction request
        corr_res = request_correction(CorrectionRequestInput(
            recordId=self.cond["id"],
            recordTitle="Asthma",
            reason="Date of onset was recorded as 2022, but symptoms first appeared in 2020.",
            proposed="2020-10-09"
        ), current_user=self.patient_user)
        self.assertEqual(corr_res["status"], "success")
        corr_id = corr_res["data"]["id"]

        # 3. List corrections
        corr_list = get_my_corrections(current_user=self.patient_user)
        self.assertEqual(len(corr_list["data"]), 1)
        self.assertEqual(corr_list["data"][0]["recordTitle"], "Asthma")

        # 4. Doctor reviews and approves correction
        review_res = review_patient_correction(
            id=corr_id,
            payload=CorrectionReviewInput(status="approved", reviewNotes="Onset verified with previous records"),
            current_user=self.doctor_user
        )
        self.assertEqual(review_res["status"], "success")
        self.assertEqual(review_res["data"]["correctionStatus"], "approved")

        # 5. Check version history of the record
        history_res = record_history(record_id=self.cond["id"], current_user=self.patient_user)
        self.assertEqual(history_res["status"], "success")
        self.assertEqual(len(history_res["data"]), 1)
        self.assertEqual(history_res["data"][0]["versionNumber"], 1)

    def test_document_upload_and_download(self):
        import asyncio
        upload_res = asyncio.run(upload_document(
            title="Hospital Discharge Summary",
            doctor="Dr. Rohan Kulkarni",
            documentType="discharge_summary",
            current_user=self.patient_user
        ))
        self.assertEqual(upload_res["status"], "success")
        doc_id = upload_res["data"]["documentId"]

        # Download content
        content_res = download_document_content(id=doc_id, current_user=self.patient_user)
        self.assertEqual(content_res.status_code, 200)
        self.assertTrue(b"PDF" in content_res.body)

if __name__ == "__main__":
    unittest.main()
