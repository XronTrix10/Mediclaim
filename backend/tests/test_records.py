import unittest
from datetime import date
from app.schemas.auth import RegisterRequest, VerifyOTPRequest
from app.schemas.records import (
    NewAllergyInput, NewConditionInput, NewMedicationInput,
    NewVaccinationInput, NewReportInput, NewPrescriptionInput, MedicationItem
)
from app.routes.auth import register, verify_otp
from app.routes.records import (
    record_allergy, record_condition, record_medication, record_vaccination,
    record_report, add_prescription, get_records, get_record,
    get_prescriptions, delete_prescription
)
from app.security import hash_otp, AuthenticatedUser
from app.database import get_db, init_db

class TestRecordsService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        self.phone = "+919333344444"
        self.aadhaar = "334455667788"
        self.password = "SecurePassword123!"

        with get_db() as conn:
            conn.execute("DELETE FROM users WHERE phone = %s OR aadhaar_number = %s", (self.phone, self.aadhaar))

        reg_res = register(RegisterRequest(
            fullName="Patient Clinical Records",
            dateOfBirth=date(1992, 4, 15),
            phone=self.phone,
            aadhaarNumber=self.aadhaar,
            password=self.password
        ))
        self.user_id = reg_res["data"]["userId"]
        with get_db() as conn:
            row = conn.execute("SELECT mediclaim_id FROM users WHERE phone = %s", (self.phone,)).fetchone()
            self.mediclaim_id = row["mediclaim_id"]

        otp = "654321"
        with get_db() as conn:
            conn.execute("UPDATE users SET otp_hash = %s, otp_expires_at = 9999999999 WHERE phone = %s", (hash_otp(otp), self.phone))
        verify_res = verify_otp(VerifyOTPRequest(userId=self.user_id, otp=otp))

        with get_db() as conn:
            pat_row = conn.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (self.user_id.replace("usr_", ""),)).fetchone()
            self.pat_profile_id = str(pat_row["id"])

        self.auth_user = AuthenticatedUser(
            id=self.user_id,
            raw_uuid=self.user_id.replace("usr_", ""),
            public_id=self.mediclaim_id.replace(" ", ""),
            mediclaim_id=self.mediclaim_id,
            full_name="Patient Clinical Records",
            email=None,
            phone=self.phone,
            roles=["patient"],
            is_active=True,
            admin_verified=False,
            profile_complete=True,
            patient_profile_id=self.pat_profile_id
        )

    def tearDown(self):
        with get_db() as conn:
            conn.execute("DELETE FROM allergies WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM conditions WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM medication_statements WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM vaccinations WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM diagnostic_reports WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM prescription_items WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM prescriptions WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM clinical_records WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM users WHERE phone = %s", (self.phone,))

    def test_clinical_records_crud_and_fhir(self):
        # 1. Record Allergy
        allergy_res = record_allergy(NewAllergyInput(
            allergen="Penicillin",
            category="medication",
            severity="severe",
            criticality="high",
            reaction="Skin rash and bronchospasm",
            provider="Dr. S. Nair, Family Clinic",
            notes="Strictly avoid beta-lactams"
        ), current_user=self.auth_user)
        self.assertEqual(allergy_res["status"], "success")
        alg_id = allergy_res["data"]["id"]
        self.assertTrue(alg_id.startswith("rec_"))
        self.assertTrue("AllergyIntolerance" in allergy_res["data"]["fhirId"])

        # 2. Record Condition
        cond_res = record_condition(NewConditionInput(
            conditionName="Asthma",
            status="active",
            severity="mild",
            provider="Dr. Rohan Kulkarni",
            notes="Mild persistent asthma"
        ), current_user=self.auth_user)
        self.assertEqual(cond_res["status"], "success")
        cond_id = cond_res["data"]["id"]

        # 3. Record Medication
        med_res = record_medication(NewMedicationInput(
            medicationName="Budesonide inhaler",
            dosage="200 mcg twice daily",
            status="active",
            provider="Dr. Rohan Kulkarni",
            instructions="2 puffs in morning"
        ), current_user=self.auth_user)
        self.assertEqual(med_res["status"], "success")

        # 4. Record Vaccination
        vac_res = record_vaccination(NewVaccinationInput(
            vaccineName="Tdap booster",
            doseNumber=1,
            administeredDate=date(2026, 9, 2),
            provider="Shivaji Park Clinic",
            notes="Booster dose"
        ), current_user=self.auth_user)
        self.assertEqual(vac_res["status"], "success")

        # 5. Record Report
        rep_res = record_report(NewReportInput(
            reportName="HbA1c Blood Test",
            reportType="lab",
            reportDate=date(2026, 3, 11),
            conclusion="5.4%, normal",
            provider="Apex Diagnostics"
        ), current_user=self.auth_user)
        self.assertEqual(rep_res["status"], "success")

        # 6. List all records
        all_records = get_records(current_user=self.auth_user)
        self.assertEqual(all_records["status"], "success")
        self.assertGreaterEqual(len(all_records["data"]), 5)

        # 7. Filter by kind
        allergy_records = get_records(kind="allergy", current_user=self.auth_user)
        self.assertEqual(len(allergy_records["data"]), 1)
        self.assertEqual(allergy_records["data"][0]["title"], "Penicillin")

        # 8. Filter by search query
        search_res = get_records(q="Asthma", current_user=self.auth_user)
        self.assertEqual(len(search_res["data"]), 1)
        self.assertEqual(search_res["data"][0]["title"], "Asthma")

        # 9. Get detailed record with FHIR
        detail_res = get_record(id=alg_id, current_user=self.auth_user)
        self.assertEqual(detail_res["status"], "success")
        fhir = detail_res["data"]["fhirResource"]
        self.assertEqual(fhir["resourceType"], "AllergyIntolerance")
        self.assertEqual(fhir["code"]["text"], "Penicillin")

        # 10. Prescription lifecycle
        rx_res = add_prescription(NewPrescriptionInput(
            title="Asthma Maintenance Prescription",
            doctor="Dr. Rohan Kulkarni",
            organization="Lifeline Pulmonology Clinic",
            date=date(2026, 8, 14),
            instructions="Take 2 puffs daily",
            medications=[MedicationItem(
                name="Budesonide Inhaler",
                dosage="200 mcg",
                frequency="Twice daily",
                duration="90 days"
            )]
        ), current_user=self.auth_user)
        self.assertEqual(rx_res["status"], "success")
        rx_id = rx_res["data"]["id"]

        # List prescriptions
        rx_list = get_prescriptions(current_user=self.auth_user)
        self.assertGreaterEqual(len(rx_list["data"]), 1)
        self.assertEqual(rx_list["data"][0]["title"], "Asthma Maintenance Prescription")

        # Retract prescription
        del_res = delete_prescription(id=rx_id, current_user=self.auth_user)
        self.assertEqual(del_res["status"], "success")

        # Verify prescription retracted
        rx_list_after = get_prescriptions(current_user=self.auth_user)
        self.assertEqual(len(rx_list_after["data"]), 0)

if __name__ == "__main__":
    unittest.main()
