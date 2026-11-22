import unittest
from app.database import get_db

EXPECTED_TABLES = [
    "users", "user_roles", "patient_profiles", "practitioner_profiles",
    "healthcare_organizations", "organization_memberships", "encounters",
    "clinical_records", "conditions", "allergies", "prescriptions",
    "prescription_items", "medication_statements", "vaccinations",
    "observations", "diagnostic_reports", "lab_results", "procedures",
    "hospitalizations", "medical_documents", "document_versions",
    "consent_records", "patient_access_grants", "access_grant_scopes",
    "patient_caregivers", "audit_events", "clinical_record_versions",
    "record_correction_requests"
]

EXPECTED_COLUMNS = {
    "patient_profiles": ["address", "emergency_contact_relation"],
    "clinical_records": ["source", "provider", "document_id"],
    "allergies": ["category", "criticality"],
    "prescriptions": [
        "title", "doctor_name", "organization_name", "file_type",
        "file_name", "file_size_bytes", "file_url"
    ],
    "medical_documents": [
        "ocr_status", "extracted_text", "extracted_payload",
        "parse_confidence", "parser_provider", "parse_error",
        "parsed_at", "confirmed_at"
    ],
    "patient_access_grants": [
        "grantee_name", "grantee_role", "duration_hours"
    ],
    "record_correction_requests": [
        "record_title", "proposed_text", "review_notes"
    ],
    "patient_caregivers": [
        "id", "patient_id", "name", "relation", "scope", "since", "created_at"
    ]
}


class DatabaseSchemaValidationTestCase(unittest.TestCase):
    """PostgreSQL database schema alignment and integrity unit tests."""

    def test_all_expected_tables_exist(self):
        with get_db() as conn:
            rows = conn.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
            ).fetchall()
            existing = {r["table_name"] for r in rows}

        for tbl in EXPECTED_TABLES:
            self.assertIn(tbl, existing, f"Required table '{tbl}' is missing from database.")

    def test_runtime_alignment_columns_exist(self):
        with get_db() as conn:
            for tbl, cols in EXPECTED_COLUMNS.items():
                rows = conn.execute(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s;",
                    (tbl,)
                ).fetchall()
                existing_cols = {r["column_name"] for r in rows}
                for c in cols:
                    self.assertIn(c, existing_cols, f"Column '{c}' missing on table '{tbl}'.")

    def test_prescriptions_practitioner_nullable(self):
        with get_db() as conn:
            row = conn.execute("""
                SELECT is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                  AND table_name = 'prescriptions' 
                  AND column_name = 'practitioner_id';
            """).fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row["is_nullable"], "YES", "prescriptions.practitioner_id must be nullable.")

    def test_patient_access_grants_valid_from_nullable(self):
        with get_db() as conn:
            row = conn.execute("""
                SELECT is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                  AND table_name = 'patient_access_grants' 
                  AND column_name = 'valid_from';
            """).fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row["is_nullable"], "YES", "patient_access_grants.valid_from must be nullable.")

    def test_clinical_records_status_constraint_covers_all_statuses(self):
        with get_db() as conn:
            row = conn.execute("""
                SELECT pg_get_constraintdef(oid) AS def
                FROM pg_constraint
                WHERE conrelid = 'clinical_records'::regclass
                  AND conname = 'clinical_records_status_check';
            """).fetchone()
            self.assertIsNotNone(row)
            definition = row["def"]
            for st in ['draft', 'active', 'resolved', 'inactive', 'completed', 'discontinued', 'archived', 'deleted']:
                self.assertIn(st, definition, f"Status '{st}' missing from clinical_records_status_check constraint.")

    def test_patient_access_grants_constraint_supports_named_grants(self):
        with get_db() as conn:
            row = conn.execute("""
                SELECT pg_get_constraintdef(oid) AS def
                FROM pg_constraint
                WHERE conrelid = 'patient_access_grants'::regclass
                  AND conname IN ('patient_access_grants_grantee_check', 'patient_access_grants_check');
            """).fetchone()
            self.assertIsNotNone(row)
            self.assertIn("grantee_name", row["def"], "patient_access_grants constraint must permit direct named grants.")

    def test_incompatible_audit_constraint_removed(self):
        with get_db() as conn:
            row = conn.execute("""
                SELECT count(*) AS cnt
                FROM pg_constraint
                WHERE conrelid = 'audit_events'::regclass
                  AND conname = 'audit_events_check';
            """).fetchone()
            self.assertEqual(row["cnt"], 0, "Incompatible audit_events_check constraint must be dropped.")

    def test_audit_events_immutability_trigger_active(self):
        with get_db() as conn:
            row = conn.execute("""
                SELECT count(*) AS cnt
                FROM pg_trigger
                WHERE tgrelid = 'audit_events'::regclass
                  AND tgname = 'trg_audit_events_immutable';
            """).fetchone()
            self.assertGreater(row["cnt"], 0, "Audit events immutability trigger must be active.")


if __name__ == "__main__":
    unittest.main()
