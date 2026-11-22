-- Migration: 002_runtime_alignment.sql
-- Description: Align database schema with backend runtime requirements
-- Safe, repeatable, and idempotent migration script.

BEGIN;

-- 1. Patient profiles extensions: address and emergency_contact_relation
ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS emergency_contact_relation varchar(50);

-- 2. Medical documents OCR & structured parsing extensions
ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS ocr_status varchar(30) NOT NULL DEFAULT 'pending';
ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS extracted_text text;
ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS extracted_payload jsonb;
ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS parse_confidence real;
ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS parser_provider varchar(50);
ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS parse_error text;
ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS parsed_at timestamp;
ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS confirmed_at timestamp;

-- 3. Clinical records extensions and status constraint synchronization
ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS source varchar(30) DEFAULT 'self_reported';
ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS provider varchar(255);
ALTER TABLE clinical_records ADD COLUMN IF NOT EXISTS document_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_clinical_records_document_id' 
          AND conrelid = 'clinical_records'::regclass
    ) THEN
        ALTER TABLE clinical_records 
            ADD CONSTRAINT fk_clinical_records_document_id 
            FOREIGN KEY (document_id) REFERENCES medical_documents(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE clinical_records DROP CONSTRAINT IF EXISTS clinical_records_status_check;
ALTER TABLE clinical_records ADD CONSTRAINT clinical_records_status_check 
    CHECK (status IN ('draft', 'active', 'resolved', 'inactive', 'completed', 'discontinued', 'archived', 'deleted'));

-- 4. Allergies extensions: category and criticality
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS category varchar(50);
ALTER TABLE allergies ADD COLUMN IF NOT EXISTS criticality varchar(30);

-- 5. Prescriptions extensions and nullable practitioner_id
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS title varchar(255);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS doctor_name varchar(255);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS organization_name varchar(255);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS file_type varchar(50);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS file_name varchar(255);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE prescriptions ALTER COLUMN practitioner_id DROP NOT NULL;

-- 6. Patient access grants extensions and multi-grant-type check constraint
ALTER TABLE patient_access_grants ADD COLUMN IF NOT EXISTS grantee_name varchar(255);
ALTER TABLE patient_access_grants ADD COLUMN IF NOT EXISTS grantee_role varchar(255);
ALTER TABLE patient_access_grants ADD COLUMN IF NOT EXISTS duration_hours integer;
ALTER TABLE patient_access_grants ALTER COLUMN valid_from DROP NOT NULL;

ALTER TABLE patient_access_grants DROP CONSTRAINT IF EXISTS patient_access_grants_check;
ALTER TABLE patient_access_grants DROP CONSTRAINT IF EXISTS patient_access_grants_grantee_check;
ALTER TABLE patient_access_grants ADD CONSTRAINT patient_access_grants_grantee_check 
    CHECK (grantee_user_id IS NOT NULL OR organization_id IS NOT NULL OR grantee_name IS NOT NULL);

-- 7. Record correction requests extensions: record_title, proposed_text, review_notes
ALTER TABLE record_correction_requests ADD COLUMN IF NOT EXISTS record_title varchar(255);
ALTER TABLE record_correction_requests ADD COLUMN IF NOT EXISTS proposed_text text;
ALTER TABLE record_correction_requests ADD COLUMN IF NOT EXISTS review_notes text;

-- 8. Patient caregivers table
CREATE TABLE IF NOT EXISTS patient_caregivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    name varchar(200) NOT NULL,
    relation varchar(100) NOT NULL,
    scope text[] NOT NULL,
    since date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_patient_caregivers_patient_id ON patient_caregivers (patient_id);

-- 9. Audit events: remove incompatible pairing constraint while retaining other constraints
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_check;

COMMIT;
