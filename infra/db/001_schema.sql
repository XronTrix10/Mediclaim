BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id varchar(12) NOT NULL UNIQUE CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
    mediclaim_id varchar(12) UNIQUE,
    full_name varchar(200) NOT NULL,
    email varchar(255) UNIQUE,
    phone varchar(20) NOT NULL UNIQUE,
    aadhaar_number varchar(12) UNIQUE,
    password_hash varchar(255) NOT NULL,
    admin_verified boolean NOT NULL DEFAULT false,
    profile_complete boolean NOT NULL DEFAULT false,
    otp_hash text,
    otp_expires_at bigint,
    otp_attempts integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role varchar(30) NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

CREATE TABLE patient_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id varchar(12) NOT NULL UNIQUE CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth date NOT NULL,
    blood_group varchar(5),
    gender varchar(30),
    emergency_contact_name varchar(200),
    emergency_contact_phone varchar(20),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE practitioner_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id varchar(12) NOT NULL UNIQUE CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    registration_number varchar(100) NOT NULL UNIQUE,
    specialization varchar(150),
    qualification varchar(200),
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE healthcare_organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id varchar(12) NOT NULL UNIQUE CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
    name varchar(255) NOT NULL,
    organization_type varchar(50) NOT NULL,
    registration_number varchar(100) UNIQUE,
    address text,
    phone varchar(20),
    email varchar(255),
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES healthcare_organizations(id),
    user_id uuid NOT NULL REFERENCES users(id),
    designation varchar(100),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (organization_id, user_id)
);

CREATE TABLE encounters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id varchar(12) NOT NULL UNIQUE CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    practitioner_id uuid NOT NULL REFERENCES practitioner_profiles(id),
    organization_id uuid REFERENCES healthcare_organizations(id),
    encounter_type varchar(50) NOT NULL,
    start_time timestamp NOT NULL,
    end_time timestamp,
    reason text,
    diagnosis_summary text,
    status varchar(30) NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    created_at timestamp NOT NULL DEFAULT now(),
    CHECK (end_time IS NULL OR end_time >= start_time)
);

CREATE UNIQUE INDEX ux_encounters_patient_id_id
ON encounters (patient_id, id);

CREATE UNIQUE INDEX ux_encounters_patient_id_id_practitioner_id
ON encounters (patient_id, id, practitioner_id);

CREATE UNIQUE INDEX ux_encounters_patient_id_id_organization_id
ON encounters (patient_id, id, organization_id);

CREATE TABLE clinical_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id varchar(12) NOT NULL UNIQUE CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    encounter_id uuid REFERENCES encounters(id),
    created_by uuid NOT NULL REFERENCES users(id),
    record_type varchar(50) NOT NULL,
    title varchar(255) NOT NULL,
    status varchar(30) NOT NULL CHECK (status IN ('draft', 'active', 'archived', 'deleted')),
    description text,
    recorded_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp,
    fhir_resource_type varchar(100),
    fhir_resource_id varchar(100),
    fhir_version_id varchar(100),
    CHECK (record_type <> ''),
    FOREIGN KEY (patient_id, encounter_id) REFERENCES encounters (patient_id, id)
);

CREATE UNIQUE INDEX ux_clinical_records_patient_id_id
ON clinical_records (patient_id, id);

CREATE TABLE conditions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    clinical_record_id uuid NOT NULL REFERENCES clinical_records(id),
    condition_name varchar(255) NOT NULL,
    clinical_code varchar(100),
    code_system varchar(100),
    severity varchar(30),
    status varchar(30) NOT NULL,
    onset_date date,
    resolved_date date,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    CHECK (resolved_date IS NULL OR onset_date IS NULL OR resolved_date >= onset_date),
    FOREIGN KEY (patient_id, clinical_record_id) REFERENCES clinical_records (patient_id, id)
);

CREATE TABLE allergies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    clinical_record_id uuid NOT NULL REFERENCES clinical_records(id),
    allergen varchar(255) NOT NULL,
    reaction text,
    severity varchar(30),
    status varchar(30) NOT NULL,
    identified_date date,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    FOREIGN KEY (patient_id, clinical_record_id) REFERENCES clinical_records (patient_id, id)
);

-- Standalone prescriptions without an encounter are allowed; when encounter_id is null,
-- practitioner/organization must be validated in backend business logic before activation.
CREATE TABLE prescriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id varchar(12) NOT NULL UNIQUE CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    encounter_id uuid REFERENCES encounters(id),
    practitioner_id uuid NOT NULL REFERENCES practitioner_profiles(id),
    organization_id uuid REFERENCES healthcare_organizations(id),
    prescribed_at timestamp NOT NULL,
    valid_until date,
    status varchar(30) NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'expired')),
    instructions text,
    created_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp,
    CHECK (valid_until IS NULL OR valid_until >= prescribed_at::date),
    FOREIGN KEY (patient_id, encounter_id) REFERENCES encounters (patient_id, id)
);

CREATE UNIQUE INDEX ux_prescriptions_patient_id_id
ON prescriptions (patient_id, id);

CREATE TABLE prescription_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_name varchar(255) NOT NULL,
    medication_code varchar(100),
    dosage varchar(100),
    route varchar(50),
    frequency varchar(100),
    duration varchar(100),
    quantity varchar(100),
    refills integer DEFAULT 0 CHECK (refills >= 0),
    instructions text,
    FOREIGN KEY (patient_id, prescription_id) REFERENCES prescriptions (patient_id, id)
);

CREATE UNIQUE INDEX ux_prescription_items_patient_id_id
ON prescription_items (patient_id, id);

-- Medication statements may be manually entered without a prescription_item; when linked,
-- the owning patient must match the prescription item owner.
CREATE TABLE medication_statements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    prescription_item_id uuid REFERENCES prescription_items(id),
    medication_name varchar(255) NOT NULL,
    dosage varchar(100),
    start_date date,
    end_date date,
    status varchar(30) NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'discontinued')),
    adherence_notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    FOREIGN KEY (patient_id, prescription_item_id) REFERENCES prescription_items (patient_id, id)
);

CREATE TABLE vaccinations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    clinical_record_id uuid NOT NULL REFERENCES clinical_records(id),
    vaccine_name varchar(255) NOT NULL,
    dose_number integer,
    administered_date date NOT NULL,
    next_due_date date,
    batch_number varchar(100),
    administered_by uuid REFERENCES users(id),
    organization_id uuid REFERENCES healthcare_organizations(id),
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    CHECK (next_due_date IS NULL OR next_due_date >= administered_date),
    FOREIGN KEY (patient_id, clinical_record_id) REFERENCES clinical_records (patient_id, id)
);

CREATE TABLE observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    encounter_id uuid REFERENCES encounters(id),
    clinical_record_id uuid NOT NULL REFERENCES clinical_records(id),
    observation_type varchar(100) NOT NULL,
    value_numeric decimal(12,4),
    value_text text,
    unit varchar(50),
    reference_range varchar(100),
    observed_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    FOREIGN KEY (patient_id, encounter_id) REFERENCES encounters (patient_id, id),
    FOREIGN KEY (patient_id, clinical_record_id) REFERENCES clinical_records (patient_id, id)
);

CREATE TABLE diagnostic_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id varchar(12) NOT NULL UNIQUE CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    encounter_id uuid REFERENCES encounters(id),
    ordered_by uuid REFERENCES practitioner_profiles(id),
    organization_id uuid REFERENCES healthcare_organizations(id),
    report_name varchar(255) NOT NULL,
    report_type varchar(100),
    report_date date,
    status varchar(30) NOT NULL CHECK (status IN ('draft', 'final', 'amended', 'cancelled')),
    conclusion text,
    created_at timestamp NOT NULL DEFAULT now(),
    FOREIGN KEY (patient_id, encounter_id) REFERENCES encounters (patient_id, id)
);

CREATE TABLE lab_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnostic_report_id uuid NOT NULL REFERENCES diagnostic_reports(id) ON DELETE CASCADE,
    test_name varchar(255) NOT NULL,
    test_code varchar(100),
    result_value varchar(255),
    unit varchar(50),
    reference_range varchar(100),
    interpretation varchar(100),
    result_date timestamp,
    notes text
);

CREATE TABLE procedures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    encounter_id uuid REFERENCES encounters(id),
    practitioner_id uuid REFERENCES practitioner_profiles(id),
    organization_id uuid REFERENCES healthcare_organizations(id),
    procedure_name varchar(255) NOT NULL,
    procedure_code varchar(100),
    performed_date date,
    status varchar(30) NOT NULL CHECK (status IN ('planned', 'performed', 'cancelled', 'completed')),
    outcome text,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    FOREIGN KEY (patient_id, encounter_id) REFERENCES encounters (patient_id, id)
);

CREATE TABLE hospitalizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    organization_id uuid REFERENCES healthcare_organizations(id),
    admission_date timestamp NOT NULL,
    discharge_date timestamp,
    admission_reason text,
    discharge_summary text,
    attending_practitioner_id uuid REFERENCES practitioner_profiles(id),
    created_at timestamp NOT NULL DEFAULT now(),
    CHECK (discharge_date IS NULL OR discharge_date >= admission_date)
);

CREATE TABLE medical_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id varchar(12) NOT NULL UNIQUE CHECK (public_id ~ '^[A-Za-z0-9]{12}$'),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    clinical_record_id uuid REFERENCES clinical_records(id),
    uploaded_by uuid NOT NULL REFERENCES users(id),
    document_type varchar(100),
    title varchar(255) NOT NULL,
    original_filename varchar(255),
    storage_key varchar(500) NOT NULL,
    mime_type varchar(100),
    file_size_bytes bigint CHECK (file_size_bytes >= 0),
    document_date date,
    checksum varchar(128),
    created_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp,
    FOREIGN KEY (patient_id, clinical_record_id) REFERENCES clinical_records (patient_id, id)
);

CREATE TABLE document_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES medical_documents(id) ON DELETE CASCADE,
    version_number integer NOT NULL CHECK (version_number > 0),
    storage_key varchar(500) NOT NULL,
    checksum varchar(128),
    uploaded_by uuid NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (document_id, version_number)
);

CREATE TABLE consent_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    granted_by uuid NOT NULL REFERENCES users(id),
    granted_to_user_id uuid REFERENCES users(id),
    organization_id uuid REFERENCES healthcare_organizations(id),
    consent_type varchar(100) NOT NULL,
    purpose text,
    status varchar(30) NOT NULL,
    consented_at timestamp,
    expires_at timestamp,
    withdrawn_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp,
    CHECK ((granted_to_user_id IS NOT NULL) <> (organization_id IS NOT NULL)),
    CHECK (expires_at IS NULL OR consented_at IS NULL OR expires_at >= consented_at),
    CHECK (status IN ('active', 'revoked', 'expired', 'pending'))
);

CREATE UNIQUE INDEX ux_consent_records_patient_id_id
ON consent_records(patient_id, id);

CREATE TABLE patient_access_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    consent_record_id uuid REFERENCES consent_records(id) ON DELETE SET NULL,
    grantee_user_id uuid REFERENCES users(id),
    organization_id uuid REFERENCES healthcare_organizations(id),
    granted_by uuid NOT NULL REFERENCES users(id),
    purpose text,
    valid_from timestamp NOT NULL,
    expires_at timestamp,
    revoked_at timestamp,
    status varchar(30) NOT NULL CHECK (status IN ('active', 'revoked', 'expired', 'pending')),
    created_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp,
    CHECK ((grantee_user_id IS NOT NULL) <> (organization_id IS NOT NULL)),
    CHECK (expires_at IS NULL OR expires_at >= valid_from),
    CHECK (revoked_at IS NULL OR revoked_at >= valid_from),
    FOREIGN KEY (patient_id, consent_record_id) REFERENCES consent_records (patient_id, id)
);

CREATE TABLE access_grant_scopes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    access_grant_id uuid NOT NULL REFERENCES patient_access_grants(id) ON DELETE CASCADE,
    record_type varchar(50) NOT NULL,
    permission varchar(30) NOT NULL,
    UNIQUE (access_grant_id, record_type, permission)
);

CREATE TABLE audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    patient_id uuid REFERENCES patient_profiles(id) ON DELETE SET NULL,
    clinical_record_id uuid REFERENCES clinical_records(id) ON DELETE RESTRICT,
    action varchar(100) NOT NULL,
    resource_table varchar(100),
    resource_id uuid,
    ip_address varchar(45),
    user_agent text,
    occurred_at timestamp NOT NULL DEFAULT now(),
    metadata jsonb,
    CHECK ((patient_id IS NULL AND clinical_record_id IS NULL) OR (patient_id IS NOT NULL AND clinical_record_id IS NOT NULL)),
    CHECK (resource_id IS NULL OR resource_table IS NOT NULL),
    FOREIGN KEY (patient_id, clinical_record_id) REFERENCES clinical_records (patient_id, id)
);

CREATE TABLE clinical_record_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    clinical_record_id uuid NOT NULL REFERENCES clinical_records(id),
    version_number integer NOT NULL CHECK (version_number > 0),
    changed_by uuid NOT NULL REFERENCES users(id),
    previous_data jsonb,
    change_summary text,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (clinical_record_id, version_number)
);

CREATE TABLE record_correction_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patient_profiles(id),
    clinical_record_id uuid NOT NULL REFERENCES clinical_records(id),
    requested_by uuid NOT NULL REFERENCES users(id),
    reason text,
    proposed_correction jsonb,
    status varchar(30) NOT NULL CHECK (status IN ('open', 'under_review', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES users(id),
    reviewed_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    CHECK (reviewed_at IS NULL OR reviewed_at >= created_at),
    FOREIGN KEY (patient_id, clinical_record_id) REFERENCES clinical_records (patient_id, id)
);

CREATE INDEX idx_encounters_patient_start_time ON encounters (patient_id, start_time);
CREATE INDEX idx_clinical_records_patient_recorded_at ON clinical_records (patient_id, recorded_at);
CREATE INDEX idx_clinical_records_patient_record_type_recorded_at ON clinical_records (patient_id, record_type, recorded_at);
CREATE INDEX idx_clinical_records_fhir_resource ON clinical_records (fhir_resource_type, fhir_resource_id);
CREATE INDEX idx_conditions_patient ON conditions (patient_id);
CREATE INDEX idx_allergies_patient ON allergies (patient_id);
CREATE INDEX idx_prescriptions_patient_prescribed_at ON prescriptions (patient_id, prescribed_at);
CREATE INDEX idx_prescription_items_prescription_id ON prescription_items (prescription_id);
CREATE INDEX idx_medication_statements_patient ON medication_statements (patient_id);
CREATE INDEX idx_vaccinations_patient ON vaccinations (patient_id);
CREATE INDEX idx_observations_patient_type_observed_at ON observations (patient_id, observation_type, observed_at);
CREATE INDEX idx_diagnostic_reports_patient_report_date ON diagnostic_reports (patient_id, report_date);
CREATE INDEX idx_lab_results_diagnostic_report ON lab_results (diagnostic_report_id);
CREATE INDEX idx_procedures_patient ON procedures (patient_id);
CREATE INDEX idx_hospitalizations_patient ON hospitalizations (patient_id);
CREATE INDEX idx_medical_documents_patient ON medical_documents (patient_id);
CREATE INDEX idx_patient_access_grants_patient_grantee_status ON patient_access_grants (patient_id, grantee_user_id, status);
CREATE INDEX idx_patient_access_grants_status_validity ON patient_access_grants (status, valid_from, expires_at);
CREATE INDEX idx_consent_records_patient_status ON consent_records (patient_id, status, consented_at);
CREATE INDEX idx_audit_events_patient_occurred_at ON audit_events (patient_id, occurred_at);
CREATE INDEX idx_audit_events_actor_occurred_at ON audit_events (actor_user_id, occurred_at);
CREATE INDEX idx_record_correction_requests_patient ON record_correction_requests (patient_id);

CREATE UNIQUE INDEX ux_consent_records_patient_granted_to_user
ON consent_records (patient_id, granted_to_user_id)
WHERE granted_to_user_id IS NOT NULL;

CREATE UNIQUE INDEX ux_consent_records_patient_organization
ON consent_records (patient_id, organization_id)
WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX ux_patient_access_grants_patient_id_id
ON patient_access_grants (patient_id, id);

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Audit history is immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

REVOKE ALL ON TABLE audit_events FROM PUBLIC;
REVOKE UPDATE, DELETE ON TABLE audit_events FROM PUBLIC;

COMMIT;
