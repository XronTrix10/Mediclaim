import unittest
import secrets
from datetime import date
from app.schemas.auth import RegisterRequest, VerifyOTPRequest
from app.schemas.records import NewAllergyInput, NewConditionInput, NewMedicationInput
from app.routes.auth import register, verify_otp
from app.routes.records import record_allergy, record_condition, record_medication
from app.routes.timeline import get_patient_timeline, get_graph
from app.security import hash_otp, AuthenticatedUser
from app.database import get_db, init_db

class TestTimelineAndGraph(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def setUp(self):
        self.phone = "+919555566666"
        self.aadhaar = "556677889900"
        self.password = "SecurePassword123!"

        with get_db() as conn:
            conn.execute("DELETE FROM users WHERE phone = %s OR aadhaar_number = %s", (self.phone, self.aadhaar))

        # Register user born on 1994-05-12
        reg_res = register(RegisterRequest(
            fullName="Ananya Timeline",
            email=f"timeline_{secrets.token_hex(4)}@example.com",
            dateOfBirth=date(1994, 5, 12),
            phone=self.phone,
            aadhaarNumber=self.aadhaar,
            password=self.password
        ))
        self.user_id = reg_res["data"]["userId"]
        with get_db() as conn:
            row = conn.execute("SELECT mediclaim_id FROM users WHERE phone = %s", (self.phone,)).fetchone()
            self.mediclaim_id = row["mediclaim_id"]

        otp = "112233"
        with get_db() as conn:
            conn.execute("UPDATE users SET otp_hash = %s, otp_expires_at = 9999999999 WHERE phone = %s", (hash_otp(otp), self.phone))
        verify_otp(VerifyOTPRequest(userId=self.user_id, otp=otp))

        with get_db() as conn:
            pat_row = conn.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (self.user_id.replace("usr_", ""),)).fetchone()
            self.pat_profile_id = str(pat_row["id"])

        self.auth_user = AuthenticatedUser(
            id=self.user_id,
            raw_uuid=self.user_id.replace("usr_", ""),
            public_id=self.mediclaim_id.replace(" ", ""),
            mediclaim_id=self.mediclaim_id,
            full_name="Ananya Timeline",
            email=None,
            phone=self.phone,
            roles=["patient"],
            is_active=True,
            admin_verified=False,
            profile_complete=True,
            patient_profile_id=self.pat_profile_id
        )

        # Seed records: Condition (Asthma), Medication (Budesonide inhaler), Allergy (Dust mites)
        record_condition(NewConditionInput(
            conditionName="Asthma",
            onsetDate=date(2022, 10, 9),
            provider="Dr. Rohan Kulkarni"
        ), current_user=self.auth_user)

        record_medication(NewMedicationInput(
            medicationName="Budesonide inhaler",
            startDate=date(2024, 1, 15),
            dosage="200 mcg twice daily",
            provider="Dr. Rohan Kulkarni"
        ), current_user=self.auth_user)

        record_allergy(NewAllergyInput(
            allergen="Dust mites",
            category="environment",
            severity="mild",
            criticality="low",
            reaction="Sneezing",
            provider="Dr. Meera Iyer",
            identifiedDate=date(2018, 2, 17)
        ), current_user=self.auth_user)

    def tearDown(self):
        with get_db() as conn:
            conn.execute("DELETE FROM allergies WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM conditions WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM medication_statements WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM clinical_records WHERE patient_id = %s", (self.pat_profile_id,))
            conn.execute("DELETE FROM users WHERE phone = %s", (self.phone,))

    def test_timeline_age_calculation_and_graph(self):
        # 1. Test Timeline
        timeline_res = get_patient_timeline(current_user=self.auth_user)
        self.assertEqual(timeline_res["status"], "success")
        data = timeline_res["data"]
        self.assertEqual(data["dob"], "1994-05-12")
        self.assertEqual(data["totalEvents"], 3)

        events = data["events"]
        # Newest first: 2024 Budesonide, 2022 Asthma, 2018 Dust mites
        self.assertEqual(events[0]["title"], "Budesonide inhaler")
        # Age at 2024-01-15 for 1994-05-12: (2024 - 1994)*12 + (1 - 5) - 0 = 356 months
        self.assertIsNotNone(events[0]["ageAtEventMonths"])
        self.assertGreaterEqual(events[0]["ageAtEventMonths"], 350)

        # 2. Test Timeline Graph
        graph_res = get_graph(current_user=self.auth_user)
        self.assertEqual(graph_res["status"], "success")
        gdata = graph_res["data"]
        self.assertEqual(gdata["center"]["patientName"], "Ananya")
        self.assertEqual(gdata["center"]["birthYear"], "1994")
        self.assertEqual(len(gdata["nodes"]), 3)

        # Verify edge relation treats between Budesonide and Asthma
        self.assertGreaterEqual(len(gdata["edges"]), 1)
        edge = gdata["edges"][0]
        self.assertEqual(edge["relation"], "treats")

if __name__ == "__main__":
    unittest.main()
