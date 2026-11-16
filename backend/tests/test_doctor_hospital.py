from datetime import date, datetime, timezone, timedelta
import secrets
import unittest
import uuid
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import AuthenticatedUser
from app.schemas.auth import RegisterRequest
from app.schemas.hospital import OrganizationCreateInput, PractitionerCreateInput
from app.schemas.doctor import (
    DoctorAccessRequestInput, DoctorEncounterInput, DoctorConditionInput,
    DoctorPrescriptionInput, DoctorReportInput, DoctorVaccinationInput,
)
from app.schemas.records import MedicationItem
from app.schemas.consent import ApproveRequestInput
from app.routes.auth import register
from app.routes.hospital import (
    get_organizations, register_organization, get_organization_detail,
    get_practitioners, onboard_practitioner, get_practitioner_detail,
)
from app.routes.doctor import (
    get_authorized_patients, get_authorized_patient, get_authorized_records,
    submit_access_request, get_doctor_access_requests,
    create_encounter, create_condition, create_prescription,
    create_report, create_vaccination,
)
from app.routes.consent import approve_request, revoke_grant
from app.routes.admin import approve_patient_verification


class TestDoctorHospitalSuite(unittest.TestCase):
    def setUp(self):
        # 1. Admin user
        self.admin_phone = f"+9198{secrets.randbelow(90000000) + 10000000}"
        self.admin_uuid = str(uuid.uuid4())
        self.admin_pub = f"adm{secrets.randbelow(900000000) + 100000000}"
        self.admin_email = f"hosp_admin_{secrets.token_hex(4)}@mediclaim.gov.in"
        self.admin_user = AuthenticatedUser(
            id=f"usr_{self.admin_uuid}",
            raw_uuid=self.admin_uuid,
            public_id=self.admin_pub,
            mediclaim_id=self.admin_pub,
            full_name="Hospital Administrator",
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
                VALUES (%s, %s, %s, 'Hospital Administrator', %s, %s, 'hash', true, true, true)
                ON CONFLICT (id) DO NOTHING
            """, (self.admin_uuid, self.admin_pub, self.admin_pub, self.admin_email, self.admin_phone))
            conn.execute("""
                INSERT INTO user_roles (user_id, role) VALUES (%s, 'admin') ON CONFLICT DO NOTHING
            """, (self.admin_uuid,))

        # 2. Registered Patient
        self.patient_phone = f"+9197{secrets.randbelow(90000000) + 10000000}"
        self.patient_aadhaar = str(secrets.randbelow(900000000000) + 100000000000)
        reg_res = register(RegisterRequest(
            fullName="Rohan Das",
            dateOfBirth=date(1991, 7, 14),
            phone=self.patient_phone,
            aadhaarNumber=self.patient_aadhaar,
            password="SecurePassword123!"
        ))
        self.patient_user_id = reg_res["data"]["userId"]
        self.patient_raw_id = self.patient_user_id.replace("usr_", "").replace("usr-", "")
        # Admin approves patient
        app_res = approve_patient_verification(self.patient_raw_id, self.admin_user)
        self.patient_mediclaim_id = app_res["data"]["mediclaimId"]

        # Fetch patient profile ID
        with get_db() as conn:
            pat_row = conn.execute(
                "SELECT id FROM patient_profiles WHERE user_id = %s",
                (self.patient_raw_id,)
            ).fetchone()
            self.patient_profile_id = str(pat_row["id"])

        self.patient_user = AuthenticatedUser(
            id=f"usr_{self.patient_raw_id}",
            raw_uuid=self.patient_raw_id,
            public_id=f"usr{secrets.token_hex(4)[:9]}",
            mediclaim_id=self.patient_mediclaim_id,
            full_name="Rohan Das",
            email=None,
            phone=self.patient_phone,
            roles=["patient"],
            is_active=True,
            admin_verified=True,
            profile_complete=True,
            patient_profile_id=self.patient_profile_id,
        )

        # 3. Doctor user
        self.doc_phone = f"+9196{secrets.randbelow(90000000) + 10000000}"
        self.doc_uuid = str(uuid.uuid4())
        self.doc_pub = f"doc{secrets.randbelow(900000000) + 100000000}"
        self.doc_email = f"dr_{secrets.token_hex(4)}@apollo.com"
        self.doc_reg_no = f"MCI-{secrets.randbelow(900000) + 100000}"

        with get_db() as conn:
            conn.execute("""
                INSERT INTO users (id, public_id, mediclaim_id, full_name, email, phone, password_hash, admin_verified, profile_complete, is_active)
                VALUES (%s, %s, %s, 'Dr. Aris Thorne', %s, %s, 'hash', true, true, true)
                ON CONFLICT (id) DO NOTHING
            """, (self.doc_uuid, self.doc_pub, self.doc_pub, self.doc_email, self.doc_phone))
            conn.execute("""
                INSERT INTO user_roles (user_id, role) VALUES (%s, 'doctor') ON CONFLICT DO NOTHING
            """, (self.doc_uuid,))
            doc_p_uuid = uuid.uuid4()
            conn.execute("""
                INSERT INTO practitioner_profiles (id, public_id, user_id, registration_number, specialization, qualification)
                VALUES (%s, %s, %s, %s, 'Cardiology', 'MBBS, MD')
            """, (str(doc_p_uuid), secrets.token_hex(6)[:12], self.doc_uuid, self.doc_reg_no))
            self.doc_practitioner_id = str(doc_p_uuid)

        self.doctor_user = AuthenticatedUser(
            id=f"usr_{self.doc_uuid}",
            raw_uuid=self.doc_uuid,
            public_id=self.doc_pub,
            mediclaim_id=self.doc_pub,
            full_name="Dr. Aris Thorne",
            email=self.doc_email,
            phone=self.doc_phone,
            roles=["doctor"],
            is_active=True,
            admin_verified=True,
            profile_complete=True,
            practitioner_profile_id=self.doc_practitioner_id,
        )

    def test_hospital_management_lifecycle(self):
        # 1. Admin registers healthcare organization
        reg_num = f"HOSP-REG-{secrets.randbelow(900000) + 100000}"
        org_res = register_organization(
            OrganizationCreateInput(
                name="Apex Super Specialty Hospital",
                organizationType="hospital",
                registrationNumber=reg_num,
                address="Sector 62, Noida, Uttar Pradesh",
                phone="+911204000100",
                email="contact@apexhospital.in"
            ),
            current_user=self.admin_user
        )
        self.assertEqual(org_res["status"], "success")
        org_id = org_res["data"]["id"]
        self.assertEqual(org_res["data"]["name"], "Apex Super Specialty Hospital")

        # Duplicate conflict test
        with self.assertRaises(APIProblemException) as cm:
            register_organization(
                OrganizationCreateInput(
                    name="Apex Super Specialty Hospital Duplicate",
                    organizationType="hospital",
                    registrationNumber=reg_num,
                ),
                current_user=self.admin_user
            )
        self.assertEqual(cm.exception.status_code, 409)

        # 2. List organizations
        list_res = get_organizations(q="Apex", current_user=self.admin_user)
        self.assertEqual(list_res["status"], "success")
        self.assertTrue(any(o["id"] == org_id for o in list_res["data"]))

        # 3. Get organization details
        detail_res = get_organization_detail(org_id=org_id, current_user=self.admin_user)
        self.assertEqual(detail_res["status"], "success")
        self.assertEqual(detail_res["data"]["name"], "Apex Super Specialty Hospital")

        # 4. Onboard practitioner linked to organization
        new_doc_phone = f"+9195{secrets.randbelow(90000000) + 10000000}"
        new_doc_lic = f"MCI-NEW-{secrets.randbelow(900000) + 100000}"
        doc_onboard_res = onboard_practitioner(
            PractitionerCreateInput(
                fullName="Dr. Maya Sen",
                phone=new_doc_phone,
                email=f"maya_{secrets.token_hex(3)}@apexhospital.in",
                password="SecurePassword123!",
                registrationNumber=new_doc_lic,
                specialization="Neurology",
                qualification="MBBS, DM Neurology",
                organizationId=org_id,
                designation="Senior Neurologist",
            ),
            current_user=self.admin_user
        )
        self.assertEqual(doc_onboard_res["status"], "success")
        new_doc_id = doc_onboard_res["data"]["id"]
        self.assertEqual(doc_onboard_res["data"]["fullName"], "Dr. Maya Sen")

        # 5. List practitioners
        practitioners_res = get_practitioners(specialization="Neurology", current_user=self.admin_user)
        self.assertEqual(practitioners_res["status"], "success")
        self.assertTrue(any(p["id"] == new_doc_id for p in practitioners_res["data"]))

        # 6. Get practitioner detail
        doc_detail = get_practitioner_detail(practitioner_id=new_doc_id, current_user=self.admin_user)
        self.assertEqual(doc_detail["status"], "success")
        self.assertEqual(doc_detail["data"]["specialization"], "Neurology")
        self.assertIsNotNone(doc_detail["data"]["organization"])

        # 7. Non-admin forbidden from registering org or onboarding
        with self.assertRaises(APIProblemException) as cm_perm:
            onboard_practitioner(
                PractitionerCreateInput(
                    fullName="Dr. Unauthorized",
                    phone=f"+9194{secrets.randbelow(90000000) + 10000000}",
                    password="Password123!",
                    registrationNumber="MCI-UNAUTH-01",
                ),
                current_user=self.patient_user
            )
        self.assertEqual(cm_perm.exception.status_code, 403)

    def test_doctor_scoped_consent_and_clinical_writes(self):
        # 1. Doctor submits access request for Condition and Medication only
        req_res = submit_access_request(
            DoctorAccessRequestInput(
                patientMediclaimId=self.patient_mediclaim_id,
                scope=["condition", "medication"],
                durationHours=8,
                purpose="Cardiology assessment and prescription renewal."
            ),
            current_user=self.doctor_user
        )
        self.assertEqual(req_res["status"], "success")
        request_id = req_res["data"]["requestId"]

        # Doctor checks their requests
        my_reqs = get_doctor_access_requests(current_user=self.doctor_user)
        self.assertTrue(any(r["id"] == request_id for r in my_reqs["data"]))

        # Before approval: doctor access denied
        with self.assertRaises(APIProblemException) as cm_denied:
            get_authorized_patient(self.patient_mediclaim_id, current_user=self.doctor_user)
        self.assertEqual(cm_denied.exception.status_code, 403)

        # 2. Patient approves request with scopes: ["condition", "medication"]
        raw_req_id = request_id.replace("req_", "").replace("req-", "")
        appr_res = approve_request(
            id=raw_req_id,
            payload=ApproveRequestInput(approvedScope=["condition", "medication"], durationHours=8),
            current_user=self.patient_user
        )
        self.assertEqual(appr_res["status"], "success")
        grant_id = appr_res["data"]["grantId"]

        # 3. Doctor lists authorized patients
        pat_list = get_authorized_patients(current_user=self.doctor_user)
        self.assertEqual(pat_list["status"], "success")
        self.assertTrue(any(p["mediclaimId"].replace(" ", "") == self.patient_mediclaim_id.replace(" ", "") for p in pat_list["data"]))

        # 4. Doctor reads authorized patient summary
        doc_pat = get_authorized_patient(self.patient_mediclaim_id, current_user=self.doctor_user)
        self.assertEqual(doc_pat["status"], "success")
        self.assertEqual(doc_pat["data"]["fullName"], "Rohan Das")

        # 5. Doctor reads records in approved scope (empty initially)
        rec_res = get_authorized_records(self.patient_mediclaim_id, current_user=self.doctor_user)
        self.assertEqual(rec_res["status"], "success")
        self.assertEqual(rec_res["data"]["approvedScopes"], ["condition", "medication"])

        # 6. Doctor writes Encounter
        enc_res = create_encounter(
            mediclaim_id=self.patient_mediclaim_id,
            payload=DoctorEncounterInput(
                encounterType="outpatient",
                reason="Routine hypertensive follow-up consultation",
                diagnosisSummary="Controlled Essential Hypertension",
                status="completed"
            ),
            current_user=self.doctor_user
        )
        self.assertEqual(enc_res["status"], "success")
        self.assertEqual(enc_res["data"]["encounterType"], "outpatient")

        # 7. Doctor writes Condition (within approved scope "condition")
        cond_res = create_condition(
            mediclaim_id=self.patient_mediclaim_id,
            payload=DoctorConditionInput(
                conditionName="Essential Hypertension",
                severity="moderate",
                status="active",
                notes="Target BP < 130/80 mmHg"
            ),
            current_user=self.doctor_user
        )
        self.assertEqual(cond_res["status"], "success")
        self.assertEqual(cond_res["data"]["kind"], "condition")

        # 8. Doctor writes Prescription (within approved scope "medication")
        rx_res = create_prescription(
            mediclaim_id=self.patient_mediclaim_id,
            payload=DoctorPrescriptionInput(
                title="Antihypertensive Medication Regimen",
                instructions="Take once daily in the morning with water",
                medications=[
                    MedicationItem(
                        name="Telmisartan 40mg",
                        dosage="40mg",
                        frequency="Once daily",
                        duration="30 days",
                        instructions="After breakfast"
                    )
                ]
            ),
            current_user=self.doctor_user
        )
        self.assertEqual(rx_res["status"], "success")
        self.assertEqual(rx_res["data"]["title"], "Antihypertensive Medication Regimen")

        # 9. Doctor attempts out-of-scope write: Diagnostic Report (scope "report" NOT approved)
        with self.assertRaises(APIProblemException) as cm_scope:
            create_report(
                mediclaim_id=self.patient_mediclaim_id,
                payload=DoctorReportInput(
                    reportName="Echocardiogram 2D",
                    reportType="Cardiology",
                    conclusion="Normal LV systolic function, EF 60%"
                ),
                current_user=self.doctor_user
            )
        self.assertEqual(cm_scope.exception.status_code, 403)
        self.assertEqual(cm_scope.exception.code, "SCOPE_UNAUTHORIZED")

        # 10. Patient revokes consent grant
        raw_grant_id = grant_id.replace("grt_", "").replace("grt-", "")
        revoke_res = revoke_grant(raw_grant_id, current_user=self.patient_user)
        self.assertEqual(revoke_res["status"], "success")

        # 11. Doctor attempts write after revocation -> Expect 403 CONSENT_REVOKED
        with self.assertRaises(APIProblemException) as cm_revoked:
            create_condition(
                mediclaim_id=self.patient_mediclaim_id,
                payload=DoctorConditionInput(
                    conditionName="Secondary Arrhythmia",
                    status="active"
                ),
                current_user=self.doctor_user
            )
        self.assertEqual(cm_revoked.exception.status_code, 403)
        self.assertEqual(cm_revoked.exception.code, "CONSENT_REVOKED")
