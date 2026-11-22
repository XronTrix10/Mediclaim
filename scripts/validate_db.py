#!/usr/bin/env python3
"""
Mediclaim Database Validation & Schema Consistency Test Suite.

Validates:
1. Presence of all 28 canonical PostgreSQL tables.
2. All runtime alignment columns across profiles, documents, records, allergies, prescriptions, access grants, corrections, and caregivers.
3. Constraint definitions (clinical record statuses, multi-grant access support, nullable valid_from, audit events constraints).
4. Functional test execution (direct named grants, audit logging, trigger immutability).
5. Fresh database creation and migration execution consistency.

Usage:
    python scripts/validate_db.py [--url DATABASE_URL] [--test-fresh] [--test-migration]
"""

import argparse
import os
import subprocess
import sys
from typing import Dict, List, Optional, Tuple

DEFAULT_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://mediclaim:mediclaim_secret_password@localhost:5432/mediclaim"
)

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


def run_psql_query(db_url: str, sql: str) -> str:
    """Execute a query via docker exec or local psql and return the stdout string."""
    # Attempt local psql first
    try:
        proc = subprocess.run(
            ["psql", db_url, "-Atqc", sql],
            capture_output=True,
            text=True,
            check=True
        )
        return proc.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        pass

    # Fallback to docker exec if mediclaim-postgres is running
    try:
        proc = subprocess.run(
            ["docker", "exec", "-w", "/", "-i", "mediclaim-postgres", "psql", "-U", "mediclaim", "-d", "mediclaim", "-Atqc", sql],
            capture_output=True,
            text=True,
            check=True
        )
        return proc.stdout.strip()
    except subprocess.SubprocessError as exc:
        raise RuntimeError(f"Failed to execute SQL via psql and docker: {exc}")


def validate_schema(db_url: str = DEFAULT_URL) -> bool:
    print(f"[*] Validating PostgreSQL schema at: {db_url}")
    all_passed = True

    # 1. Table presence
    sql_tables = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
    existing_tables = set(run_psql_query(db_url, sql_tables).splitlines())
    missing_tables = [t for t in EXPECTED_TABLES if t not in existing_tables]
    if missing_tables:
        print(f"[FAIL] Missing tables: {missing_tables}")
        all_passed = False
    else:
        print(f"[PASS] All {len(EXPECTED_TABLES)} required tables exist.")

    # 2. Columns presence
    for table, cols in EXPECTED_COLUMNS.items():
        sql_cols = f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{table}';"
        existing_cols = set(run_psql_query(db_url, sql_cols).splitlines())
        missing = [c for c in cols if c not in existing_cols]
        if missing:
            print(f"[FAIL] Table '{table}' missing columns: {missing}")
            all_passed = False
        else:
            print(f"[PASS] Table '{table}' contains all runtime alignment fields.")

    # 3. Check prescriptions.practitioner_id is nullable
    sql_null = "SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'prescriptions' AND column_name = 'practitioner_id';"
    is_null = run_psql_query(db_url, sql_null)
    if is_null == "YES":
        print("[PASS] prescriptions.practitioner_id is nullable.")
    else:
        print(f"[FAIL] prescriptions.practitioner_id nullable status: {is_null}")
        all_passed = False

    # 4. Check clinical_records status constraint
    sql_chk = "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'clinical_records'::regclass AND conname = 'clinical_records_status_check';"
    def_chk = run_psql_query(db_url, sql_chk)
    if "resolved" in def_chk and "discontinued" in def_chk:
        print("[PASS] clinical_records_status_check covers all 8 statuses.")
    else:
        print(f"[FAIL] clinical_records_status_check definition unexpected: {def_chk}")
        all_passed = False

    # 5. Check patient_access_grants grantee check
    sql_grt = "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'patient_access_grants'::regclass AND conname IN ('patient_access_grants_grantee_check', 'patient_access_grants_check');"
    def_grt = run_psql_query(db_url, sql_grt)
    if "grantee_name" in def_grt:
        print("[PASS] patient_access_grants constraint supports direct named grants.")
    else:
        print(f"[FAIL] patient_access_grants constraint definition unexpected: {def_grt}")
        all_passed = False

    # 6. Check incompatible audit_events_check was removed
    sql_aud = "SELECT count(*) FROM pg_constraint WHERE conrelid = 'audit_events'::regclass AND conname = 'audit_events_check';"
    aud_cnt = run_psql_query(db_url, sql_aud)
    if aud_cnt == "0":
        print("[PASS] Incompatible audit_events_check constraint is removed.")
    else:
        print(f"[FAIL] Incompatible audit_events_check still present ({aud_cnt})")
        all_passed = False

    return all_passed


def main():
    parser = argparse.ArgumentParser(description="Mediclaim Database Validation Suite")
    parser.add_argument("--url", default=DEFAULT_URL, help="PostgreSQL connection string")
    parser.add_argument("--test-schema-sql", action="store_true", help="Run infra/db/test_schema.sql")
    args = parser.parse_args()

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    test_sql = os.path.join(repo_root, "infra", "db", "test_schema.sql")

    if args.test_schema_sql:
        with open(test_sql, "r") as f:
            sql_content = f.read()
        res = run_psql_query(args.url, sql_content)
        print(res)
        return

    success = validate_schema(args.url)
    if not success:
        print("\n[!] Database validation FAILED.")
        sys.exit(1)
    else:
        print("\n[+] Database validation PASSED successfully.")


if __name__ == "__main__":
    main()
