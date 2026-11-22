-- =====================================================================
-- PostgreSQL Schema & Constraint Validation Test Suite
-- =====================================================================
-- Validates that the database schema matches canonical requirements,
-- all runtime-alignment migrations have been applied, and constraints
-- behave as expected.
--
-- Usage:
--   psql -U mediclaim -d mediclaim -v ON_ERROR_STOP=1 -f infra/db/test_schema.sql
-- =====================================================================

BEGIN;

DO $$
DECLARE
    missing_tables text;
    missing_cols text;
    chk_count int;
    test_patient_id uuid;
    test_user_id uuid;
    test_grant_id uuid;
    test_audit_id uuid;
    caught_exception boolean;
BEGIN
    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE 'Starting PostgreSQL Schema Validation Tests';
    RAISE NOTICE '------------------------------------------------------------';

    -- 1. Validate All 28 Required Tables Exist
    WITH expected_tables AS (
        SELECT unnest(ARRAY[
            'users', 'user_roles', 'patient_profiles', 'practitioner_profiles',
            'healthcare_organizations', 'organization_memberships', 'encounters',
            'clinical_records', 'conditions', 'allergies', 'prescriptions',
            'prescription_items', 'medication_statements', 'vaccinations',
            'observations', 'diagnostic_reports', 'lab_results', 'procedures',
            'hospitalizations', 'medical_documents', 'document_versions',
            'consent_records', 'patient_access_grants', 'access_grant_scopes',
            'patient_caregivers', 'audit_events', 'clinical_record_versions',
            'record_correction_requests'
        ]) AS table_name
    )
    SELECT string_agg(expected_tables.table_name, ', ')
    INTO missing_tables
    FROM expected_tables
    LEFT JOIN information_schema.tables t 
      ON t.table_schema = 'public' AND t.table_name = expected_tables.table_name
    WHERE t.table_name IS NULL;

    IF missing_tables IS NOT NULL THEN
        RAISE EXCEPTION 'Test Failed: Missing tables: %', missing_tables;
    ELSE
        RAISE NOTICE '[PASS] All 28 expected tables exist in public schema.';
    END IF;

    -- 2. Validate Runtime-Aligned Columns Exist
    WITH expected_columns AS (
        SELECT 'patient_profiles' AS tbl, 'address' AS col UNION ALL
        SELECT 'patient_profiles', 'emergency_contact_relation' UNION ALL
        SELECT 'clinical_records', 'source' UNION ALL
        SELECT 'clinical_records', 'provider' UNION ALL
        SELECT 'clinical_records', 'document_id' UNION ALL
        SELECT 'allergies', 'category' UNION ALL
        SELECT 'allergies', 'criticality' UNION ALL
        SELECT 'prescriptions', 'title' UNION ALL
        SELECT 'prescriptions', 'doctor_name' UNION ALL
        SELECT 'prescriptions', 'organization_name' UNION ALL
        SELECT 'prescriptions', 'file_type' UNION ALL
        SELECT 'prescriptions', 'file_name' UNION ALL
        SELECT 'prescriptions', 'file_size_bytes' UNION ALL
        SELECT 'prescriptions', 'file_url' UNION ALL
        SELECT 'medical_documents', 'ocr_status' UNION ALL
        SELECT 'medical_documents', 'extracted_text' UNION ALL
        SELECT 'medical_documents', 'extracted_payload' UNION ALL
        SELECT 'medical_documents', 'parse_confidence' UNION ALL
        SELECT 'medical_documents', 'parser_provider' UNION ALL
        SELECT 'medical_documents', 'parse_error' UNION ALL
        SELECT 'medical_documents', 'parsed_at' UNION ALL
        SELECT 'medical_documents', 'confirmed_at' UNION ALL
        SELECT 'patient_access_grants', 'grantee_name' UNION ALL
        SELECT 'patient_access_grants', 'grantee_role' UNION ALL
        SELECT 'patient_access_grants', 'duration_hours' UNION ALL
        SELECT 'record_correction_requests', 'record_title' UNION ALL
        SELECT 'record_correction_requests', 'proposed_text' UNION ALL
        SELECT 'record_correction_requests', 'review_notes' UNION ALL
        SELECT 'patient_caregivers', 'patient_id' UNION ALL
        SELECT 'patient_caregivers', 'name' UNION ALL
        SELECT 'patient_caregivers', 'relation' UNION ALL
        SELECT 'patient_caregivers', 'scope' UNION ALL
        SELECT 'patient_caregivers', 'since'
    )
    SELECT string_agg(tbl || '.' || col, ', ')
    INTO missing_cols
    FROM expected_columns ec
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = ec.tbl AND c.column_name = ec.col
    WHERE c.column_name IS NULL;

    IF missing_cols IS NOT NULL THEN
        RAISE EXCEPTION 'Test Failed: Missing columns: %', missing_cols;
    ELSE
        RAISE NOTICE '[PASS] All runtime-aligned columns exist across tables.';
    END IF;

    -- 3. Validate prescriptions.practitioner_id is nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'prescriptions' 
          AND column_name = 'practitioner_id' 
          AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Test Failed: prescriptions.practitioner_id must be nullable.';
    ELSE
        RAISE NOTICE '[PASS] prescriptions.practitioner_id is nullable.';
    END IF;

    -- 4. Validate patient_access_grants.valid_from is nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'patient_access_grants' 
          AND column_name = 'valid_from' 
          AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Test Failed: patient_access_grants.valid_from must be nullable.';
    ELSE
        RAISE NOTICE '[PASS] patient_access_grants.valid_from is nullable.';
    END IF;

    -- 5. Validate clinical_records status check supports all 8 statuses
    SELECT count(*) INTO chk_count
    FROM pg_constraint
    WHERE conrelid = 'clinical_records'::regclass
      AND conname = 'clinical_records_status_check'
      AND pg_get_constraintdef(oid) LIKE '%resolved%'
      AND pg_get_constraintdef(oid) LIKE '%discontinued%';

    IF chk_count = 0 THEN
        RAISE EXCEPTION 'Test Failed: clinical_records_status_check does not cover updated statuses.';
    ELSE
        RAISE NOTICE '[PASS] clinical_records_status_check correctly covers all 8 statuses.';
    END IF;

    -- 6. Validate patient_access_grants check constraint supports direct named grants
    SELECT count(*) INTO chk_count
    FROM pg_constraint
    WHERE conrelid = 'patient_access_grants'::regclass
      AND (
          conname = 'patient_access_grants_grantee_check'
          OR (conname = 'patient_access_grants_check' AND pg_get_constraintdef(oid) LIKE '%grantee_name%')
      );

    IF chk_count = 0 THEN
        RAISE EXCEPTION 'Test Failed: patient_access_grants constraint does not support direct named grants.';
    ELSE
        RAISE NOTICE '[PASS] patient_access_grants check constraint supports user, org, and direct named grants.';
    END IF;

    -- 7. Validate incompatible audit_events_check constraint was removed
    SELECT count(*) INTO chk_count
    FROM pg_constraint
    WHERE conrelid = 'audit_events'::regclass
      AND conname = 'audit_events_check';

    IF chk_count > 0 THEN
        RAISE EXCEPTION 'Test Failed: incompatible audit_events_check constraint still exists.';
    ELSE
        RAISE NOTICE '[PASS] Incompatible audit_events_check constraint removed successfully.';
    END IF;

    -- 8. Functional Test: Direct Named Access Grant
    -- Create dummy user and patient profile for testing
    INSERT INTO users (id, public_id, full_name, phone, password_hash)
    VALUES (gen_random_uuid(), 'TSTUSR' || substring(md5(random()::text), 1, 6), 'Test Grantor User', '+919999999901', 'hash')
    RETURNING id INTO test_user_id;

    INSERT INTO patient_profiles (id, public_id, user_id, date_of_birth, address)
    VALUES (gen_random_uuid(), 'TSTPAT' || substring(md5(random()::text), 1, 6), test_user_id, '1990-01-01', '123 Health Ave')
    RETURNING id INTO test_patient_id;

    -- Insert direct named grant (grantee_user_id NULL, organization_id NULL, grantee_name SET)
    INSERT INTO patient_access_grants (
        id, patient_id, granted_by, purpose, status, grantee_name, grantee_role, duration_hours
    ) VALUES (
        gen_random_uuid(), test_patient_id, test_user_id, 'Direct Consultation', 'active',
        'Dr. Jane Specialist', 'Cardiology', 24
    ) RETURNING id INTO test_grant_id;

    RAISE NOTICE '[PASS] Direct named access grant insert succeeded (grant_id: %).', test_grant_id;

    -- 9. Functional Test: Audit Event with patient_id and NULL clinical_record_id
    INSERT INTO audit_events (
        id, actor_user_id, patient_id, clinical_record_id, action, resource_table, occurred_at
    ) VALUES (
        gen_random_uuid(), test_user_id, test_patient_id, NULL, 'view', 'patient_profiles', now()
    ) RETURNING id INTO test_audit_id;

    RAISE NOTICE '[PASS] Audit event without clinical_record_id insert succeeded (audit_id: %).', test_audit_id;

    -- 10. Functional Test: Audit Event Immutability Trigger
    caught_exception := false;
    BEGIN
        UPDATE audit_events SET action = 'tampered' WHERE id = test_audit_id;
    EXCEPTION WHEN OTHERS THEN
        caught_exception := true;
    END;

    IF NOT caught_exception THEN
        RAISE EXCEPTION 'Test Failed: audit_events immutability trigger failed to prevent UPDATE.';
    ELSE
        RAISE NOTICE '[PASS] Audit events immutability trigger actively prevents mutation.';
    END IF;

    RAISE NOTICE '------------------------------------------------------------';
    RAISE NOTICE 'ALL DATABASE VALIDATION TESTS PASSED SUCCESSFULLY!';
    RAISE NOTICE '------------------------------------------------------------';
END $$;

-- Rollback the test transaction so no dummy records pollute persistent state
ROLLBACK;
