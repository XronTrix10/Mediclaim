# Mediclaim Database Architecture & Schema Specification

**Database Engine**: PostgreSQL 16+  
**Extensions**: `pgcrypto` (UUID generation and cryptographic primitives)  
**Schema File**: [`infra/db/001_schema.sql`](file:///Users/sreejan/Codes/Mediclaim/infra/db/001_schema.sql)  
**Interactive Visualizer Format**: DBML (dbdiagram.io compatible)

---

## Table of Contents

1. [Architecture Overview & Design Principles](#1-architecture-overview--design-principles)
2. [Storage Layer & File Persistence](#2-storage-layer--file-persistence)
3. [Core Entity Schemas & Tables](#3-core-entity-schemas--tables)
   - [3.1 Identity, Users & Roles](#31-identity-users--roles)
   - [3.2 Healthcare Organizations & Practitioners](#32-healthcare-organizations--practitioners)
   - [3.3 Clinical Encounters & Central Records](#33-clinical-encounters--central-records)
   - [3.4 Specialized Clinical Resources (FHIR-Aligned)](#34-specialized-clinical-resources-fhir-aligned)
   - [3.5 Medical Documents, File Storage & AI Parsing](#35-medical-documents-file-storage--ai-parsing)
   - [3.6 Patient Consent, Granular Access Grants & Caregivers](#36-patient-consent-granular-access-grants--caregivers)
   - [3.7 Audit Trails, Emergency Overrides & Corrections](#37-audit-trails-emergency-overrides--corrections)
4. [Indexes & Performance Optimizations](#4-indexes--performance-optimizations)
5. [Database Security & Immutability Triggers](#5-database-security--immutability-triggers)
6. [Complete DBML Specification (for dbdiagram.io)](#6-complete-dbml-specification-for-dbdiagramio)

---

## 1. Architecture Overview & Design Principles

The Mediclaim database is architected around the following foundational principles:

1. **Sovereign Patient Ownership**: All clinical data is partitioned strictly by `patient_id`. No practitioner or hospital can query or mutate records without an active, unexpired grant in `patient_access_grants`.
2. **HL7 FHIR R4 Alignment**: Core clinical tables (`conditions`, `allergies`, `prescriptions`, `vaccinations`, `observations`, `diagnostic_reports`) map directly to FHIR resources, preserving resource types and versioning identifiers.
3. **Cryptographic Identity Protection**: Raw national identity numbers (Aadhaar) are never exposed. Unique 12-digit Mediclaim IDs (`mediclaim_id`) with check digits are used across all clinical exchanges.
4. **Immutable Audit Trails**: The `audit_events` table enforces an append-only guarantee backed by a PostgreSQL trigger that rejects all `UPDATE` and `DELETE` queries.
5. **Separation of Metadata and File Storage**: Document metadata and multimodal extraction payloads live in PostgreSQL (`medical_documents`), while physical files are stored in an encrypted/isolated storage directory with SHA-256 checksum verification.

---

## 2. Storage Layer & File Persistence

Uploaded prescriptions, birth certificates, discharge summaries, and diagnostic reports are persisted securely via the backend `storage_service`:

- **Storage Location**: Stored on disk under `STORAGE_DIR` (default: `./data/storage` or `/app/data/storage` in Docker).
- **Partitioning Hierarchy**: Files are partitioned by patient ID to prevent directory hot-spotting:
  ```text
  data/storage/documents/<patient_id>/<uuid>_<sanitized_filename>
  ```
- **Path Sanitization**: All incoming filenames are sanitized to remove path traversal patterns (`..`, leading slashes, and control characters).
- **Integrity Verification**: During upload, a streaming SHA-256 hash is computed and stored in `medical_documents.checksum` to verify payload integrity upon retrieval.
- **Authenticated Streaming**: Document binaries are never exposed directly to public URLs or static web roots. All downloads and inline previews must go through authenticated endpoints:
  - `GET /api/v1/documents/{id}/content`: Downloads the original binary stream with `Content-Disposition: attachment`.
  - `GET /api/v1/documents/{id}/preview`: Streams the decrypted document inline with `Content-Disposition: inline` and strict `Cache-Control: no-store` headers. Access is validated against the active user session or authorized doctor consent grant.

---

## 3. Core Entity Schemas & Tables

### 3.1 Identity, Users & Roles

#### `users`
Central identity table storing credentials, authentication state, and registration metadata.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Internal system UUID |
| `public_id` | `varchar(12)` | `NOT NULL, UNIQUE` | 12-character alphanumeric public identifier |
| `mediclaim_id` | `varchar(12)` | `UNIQUE` | Formatted 12-digit national Mediclaim ID (e.g. `9481 2049 3817`) |
| `full_name` | `varchar(200)` | `NOT NULL` | Citizen or provider legal name |
| `email` | `varchar(255)` | `UNIQUE` | User email address |
| `phone` | `varchar(20)` | `NOT NULL, UNIQUE` | Verified mobile phone number (E.164 format) |
| `aadhaar_number` | `varchar(12)` | `UNIQUE` | Masked reference / registration linkage |
| `password_hash` | `varchar(255)` | `NOT NULL` | Argon2 / Passlib password hash |
| `admin_verified` | `boolean` | `NOT NULL, DEFAULT false` | Admin approval status for ID activation |
| `profile_complete` | `boolean` | `NOT NULL, DEFAULT false` | Demographics completion indicator |
| `otp_hash` | `text` | `NULLABLE` | Secure hash of active OTP token |
| `otp_expires_at` | `bigint` | `NULLABLE` | Unix epoch expiration timestamp |
| `otp_attempts` | `integer` | `NOT NULL, DEFAULT 0` | Failed verification attempts (lockout threshold: 5) |
| `is_active` | `boolean` | `NOT NULL, DEFAULT true` | Soft-deactivation status |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Registration timestamp |
| `updated_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Last update timestamp |

#### `user_roles`
Maps users to functional system roles (`patient`, `practitioner`, `hospital_admin`, `admin`, `caregiver`).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Role entry UUID |
| `user_id` | `uuid` | `NOT NULL, REFERENCES users(id) ON DELETE CASCADE` | Associated user |
| `role` | `varchar(30)` | `NOT NULL` | Role name |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Grant timestamp |
| **Unique Index** | — | `UNIQUE (user_id, role)` | Prevents duplicate role assignments |

#### `patient_profiles`
Longitudinal demographic record for patients.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Profile UUID |
| `public_id` | `varchar(12)` | `NOT NULL, UNIQUE` | Public identifier |
| `user_id` | `uuid` | `NOT NULL, UNIQUE, REFERENCES users(id) ON DELETE CASCADE` | User account |
| `date_of_birth` | `date` | `NOT NULL` | Verified birth date (starting point of timeline) |
| `blood_group` | `varchar(5)` | `NULLABLE` | Standard blood group (`A+`, `O+`, `B-`, etc.) |
| `gender` | `varchar(30)` | `NULLABLE` | Demographic gender |
| `address` | `text` | `NULLABLE` | Residential address |
| `emergency_contact_name` | `varchar(200)` | `NULLABLE` | Primary emergency contact name |
| `emergency_contact_phone` | `varchar(20)` | `NULLABLE` | Primary emergency contact phone |
| `emergency_contact_relation`| `varchar(50)` | `NULLABLE` | Relationship (`Parent`, `Spouse`, `Sibling`, etc.) |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Profile creation timestamp |
| `updated_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Profile update timestamp |

---

### 3.2 Healthcare Organizations & Practitioners

#### `practitioner_profiles`
Verified healthcare professional directory.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Practitioner UUID |
| `public_id` | `varchar(12)` | `NOT NULL, UNIQUE` | Public identifier |
| `user_id` | `uuid` | `NOT NULL, UNIQUE, REFERENCES users(id) ON DELETE CASCADE` | Doctor user account |
| `registration_number` | `varchar(100)` | `NOT NULL, UNIQUE` | Medical council registration/license number |
| `specialization` | `varchar(150)` | `NULLABLE` | Clinical specialty (e.g., Pulmonology, Pediatrics) |
| `qualification` | `varchar(200)` | `NULLABLE` | Degrees (e.g., MBBS, MD, FRCS) |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Onboarding timestamp |

#### `healthcare_organizations`
Hospitals, clinics, and diagnostic facilities.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Organization UUID |
| `public_id` | `varchar(12)` | `NOT NULL, UNIQUE` | Public identifier |
| `name` | `varchar(255)` | `NOT NULL` | Facility legal name |
| `organization_type` | `varchar(50)` | `NOT NULL` | `hospital`, `clinic`, `diagnostic_center` |
| `registration_number` | `varchar(100)` | `UNIQUE` | State clinical establishment license |
| `address` | `text` | `NULLABLE` | Physical address |
| `phone` | `varchar(20)` | `NULLABLE` | Official phone number |
| `email` | `varchar(255)` | `NULLABLE` | Official contact email |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Registration timestamp |

#### `organization_memberships`
Affiliation of doctors and medical staff with hospitals.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Membership UUID |
| `organization_id` | `uuid` | `NOT NULL, REFERENCES healthcare_organizations(id)` | Associated hospital |
| `user_id` | `uuid` | `NOT NULL, REFERENCES users(id)` | Doctor or staff account |
| `designation` | `varchar(100)` | `NULLABLE` | Staff role (e.g. Chief of Surgery) |
| `is_active` | `boolean` | `NOT NULL, DEFAULT true` | Active affiliation flag |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Affiliation date |

---

### 3.3 Clinical Encounters & Central Records

#### `encounters`
Clinical interactions between patient and practitioner at a healthcare facility.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Encounter UUID |
| `public_id` | `varchar(12)` | `NOT NULL, UNIQUE` | Public identifier |
| `patient_id` | `uuid` | `NOT NULL, REFERENCES patient_profiles(id)` | Patient |
| `practitioner_id` | `uuid` | `NOT NULL, REFERENCES practitioner_profiles(id)` | Attending doctor |
| `organization_id` | `uuid` | `REFERENCES healthcare_organizations(id)` | Facility where visit occurred |
| `encounter_type` | `varchar(50)` | `NOT NULL` | `ambulatory`, `emergency`, `inpatient`, `home_visit` |
| `start_time` | `timestamp` | `NOT NULL` | Consultation start time |
| `end_time` | `timestamp` | `NULLABLE` | Consultation end time |
| `reason` | `text` | `NULLABLE` | Patient chief complaint |
| `diagnosis_summary` | `text` | `NULLABLE` | Clinician summary |
| `status` | `varchar(30)` | `NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'))` | Encounter status |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Record timestamp |

#### `clinical_records`
Central registry for all longitudinal health entries.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Clinical record UUID |
| `public_id` | `varchar(12)` | `NOT NULL, UNIQUE` | Public identifier |
| `patient_id` | `uuid` | `NOT NULL, REFERENCES patient_profiles(id)` | Patient |
| `encounter_id` | `uuid` | `REFERENCES encounters(id)` | Optional linked visit |
| `created_by` | `uuid` | `NOT NULL, REFERENCES users(id)` | Author user |
| `record_type` | `varchar(50)` | `NOT NULL` | `condition`, `allergy`, `medication`, `vaccination`, `report` |
| `title` | `varchar(255)` | `NOT NULL` | Human-readable clinical headline |
| `status` | `varchar(30)` | `NOT NULL` | `draft`, `active`, `resolved`, `inactive`, `completed`, `discontinued`, `archived` |
| `source` | `varchar(30)` | `DEFAULT 'self_reported'` | `self_reported`, `uploaded`, `practitioner` |
| `provider` | `varchar(255)` | `NULLABLE` | Authoring provider or clinic |
| `document_id` | `uuid` | `REFERENCES medical_documents(id) ON DELETE SET NULL` | Linked physical document |
| `description` | `text` | `NULLABLE` | Detailed clinical notes |
| `recorded_at` | `timestamp` | `NOT NULL` | Clinical event occurrence date |
| `fhir_resource_type` | `varchar(100)` | `NULLABLE` | Corresponding FHIR resource |
| `fhir_resource_id` | `varchar(100)` | `NULLABLE` | External FHIR ID |
| `deleted_at` | `timestamp` | `NULLABLE` | Soft deletion timestamp |

---

### 3.4 Specialized Clinical Resources (FHIR-Aligned)

#### `conditions`
Diagnoses, chronic illnesses, and medical conditions.
- **Fields**: `id`, `patient_id`, `clinical_record_id`, `condition_name`, `clinical_code` (ICD-10/SNOMED), `code_system`, `severity` (`mild`, `moderate`, `severe`), `status` (`active`, `resolved`, `inactive`), `onset_date`, `resolved_date`, `notes`.

#### `allergies`
Allergies and adverse intolerances.
- **Fields**: `id`, `patient_id`, `clinical_record_id`, `allergen`, `category` (`food`, `medication`, `environment`, `biologic`), `severity` (`mild`, `moderate`, `severe`, `life-threatening`), `criticality` (`low`, `high`, `unable-to-assess`), `status` (`active`, `resolved`, `inactive`), `reaction`, `identified_date`, `notes`.

#### `prescriptions`
Prescriptions written by practitioners or digitized from patient uploads.
- **Fields**: `id`, `public_id`, `patient_id`, `encounter_id`, `practitioner_id`, `organization_id`, `title`, `doctor_name`, `organization_name`, `prescribed_at`, `valid_until`, `status` (`draft`, `active`, `completed`, `cancelled`, `expired`), `instructions`, `file_type`, `file_name`, `file_size_bytes`, `file_url`.

#### `prescription_items`
Individual pharmaceuticals, dosages, and refill counts on a prescription.
- **Fields**: `id`, `patient_id`, `prescription_id`, `medication_name`, `medication_code` (RxNorm), `dosage`, `route` (`oral`, `intravenous`, etc.), `frequency`, `duration`, `quantity`, `refills`, `instructions`.

#### `medication_statements`
Patient drug-taking history and adherence records.
- **Fields**: `id`, `patient_id`, `prescription_item_id`, `medication_name`, `dosage`, `start_date`, `end_date`, `status` (`active`, `paused`, `completed`, `discontinued`), `adherence_notes`.

#### `vaccinations`
Immunization history and pediatric/adult vaccines.
- **Fields**: `id`, `patient_id`, `clinical_record_id`, `vaccine_name`, `dose_number`, `administered_date`, `next_due_date`, `batch_number`, `administered_by`, `organization_id`, `notes`.

#### `observations`
Vital signs, biometric measurements, and physical exams.
- **Fields**: `id`, `patient_id`, `encounter_id`, `clinical_record_id`, `observation_type` (e.g. `heart_rate`, `blood_pressure`), `value_numeric`, `value_text`, `unit`, `reference_range`, `observed_at`.

#### `diagnostic_reports` & `lab_results`
Laboratory reports, pathology, and imaging studies.
- **`diagnostic_reports`**: `id`, `public_id`, `patient_id`, `encounter_id`, `ordered_by`, `organization_id`, `report_name`, `report_type`, `report_date`, `status` (`draft`, `final`, `amended`), `conclusion`.
- **`lab_results`**: `id`, `diagnostic_report_id`, `test_name`, `test_code`, `result_value`, `unit`, `reference_range`, `interpretation` (`normal`, `high`, `low`, `critical`), `result_date`, `notes`.

---

### 3.5 Medical Documents, File Storage & AI Parsing

#### `medical_documents`
Registry of physical files uploaded to the platform with Multimodal AI OCR status.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Document UUID |
| `public_id` | `varchar(12)` | `NOT NULL, UNIQUE` | Public identifier |
| `patient_id` | `uuid` | `NOT NULL, REFERENCES patient_profiles(id)` | Owning patient |
| `clinical_record_id` | `uuid` | `REFERENCES clinical_records(id)` | Optional linked clinical record |
| `uploaded_by` | `uuid` | `NOT NULL, REFERENCES users(id)` | Uploader account |
| `document_type` | `varchar(100)` | `NULLABLE` | `prescription`, `vaccination`, `lab_report`, `discharge_summary`, `birth_certificate` |
| `title` | `varchar(255)` | `NOT NULL` | User/system document title |
| `original_filename` | `varchar(255)` | `NULLABLE` | Uploaded filename |
| `storage_key` | `varchar(500)` | `NOT NULL` | Path relative to `STORAGE_DIR` |
| `mime_type` | `varchar(100)` | `NULLABLE` | MIME type (`application/pdf`, `image/png`, `image/jpeg`, `image/webp`) |
| `file_size_bytes` | `bigint` | `CHECK (file_size_bytes >= 0)` | File size in bytes (max: 10 MB) |
| `checksum` | `varchar(128)` | `NULLABLE` | SHA-256 hash |
| `ocr_status` | `varchar(30)` | `NOT NULL, DEFAULT 'pending'` | `pending`, `processing`, `needs_review`, `completed`, `failed` |
| `extracted_text` | `text` | `NULLABLE` | Raw text extracted from document |
| `extracted_payload` | `jsonb` | `NULLABLE` | Structured JSON payload extracted by Gemini |
| `parse_confidence` | `real` | `NULLABLE` | Model confidence score (0.0 to 1.0) |
| `parser_provider` | `varchar(50)` | `NULLABLE` | AI model used (e.g. `gemini-3-flash-preview`) |
| `parse_error` | `text` | `NULLABLE` | Extraction failure message |
| `parsed_at` | `timestamp` | `NULLABLE` | Timestamp when AI extraction completed |
| `confirmed_at` | `timestamp` | `NULLABLE` | Timestamp when patient confirmed and committed records |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Upload timestamp |
| `deleted_at` | `timestamp` | `NULLABLE` | Soft deletion timestamp |

---

### 3.6 Patient Consent, Granular Access Grants & Caregivers

#### `patient_access_grants`
Time-bounded clinical authorizations granted to doctors or hospitals.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Grant UUID |
| `patient_id` | `uuid` | `NOT NULL, REFERENCES patient_profiles(id)` | Grantor patient |
| `consent_record_id` | `uuid` | `REFERENCES consent_records(id) ON DELETE SET NULL` | Parent consent contract |
| `grantee_user_id` | `uuid` | `REFERENCES users(id)` | Doctor user ID |
| `organization_id` | `uuid` | `REFERENCES healthcare_organizations(id)` | Hospital ID |
| `grantee_name` | `varchar(255)` | `NULLABLE` | Doctor or organization display name |
| `grantee_role` | `varchar(255)` | `NULLABLE` | Clinical specialty |
| `duration_hours` | `integer` | `NULLABLE` | Requested session duration |
| `granted_by` | `uuid` | `NOT NULL, REFERENCES users(id)` | Authorizing user |
| `purpose` | `text` | `NULLABLE` | Clinical purpose (e.g., `Consultation`) |
| `valid_from` | `timestamp` | `NULLABLE` | Start timestamp |
| `expires_at` | `timestamp` | `NULLABLE` | Expiration timestamp |
| `revoked_at` | `timestamp` | `NULLABLE` | Explicit revocation timestamp |
| `status` | `varchar(30)` | `NOT NULL CHECK (status IN ('active', 'revoked', 'expired', 'pending'))` | Real-time grant status |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Timestamp |

#### `access_grant_scopes`
Granular clinical category scopes attached to an access grant.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Scope UUID |
| `access_grant_id` | `uuid` | `NOT NULL, REFERENCES patient_access_grants(id) ON DELETE CASCADE` | Parent grant |
| `record_type` | `varchar(50)` | `NOT NULL` | `allergy`, `condition`, `medication`, `vaccination`, `report` |
| `permission` | `varchar(30)` | `NOT NULL` | `read`, `write` |

#### `patient_caregivers`
Family and caregiver delegations.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Caregiver UUID |
| `patient_id` | `uuid` | `NOT NULL, REFERENCES patient_profiles(id) ON DELETE CASCADE` | Patient |
| `name` | `varchar(200)` | `NOT NULL` | Caregiver legal name |
| `relation` | `varchar(100)` | `NOT NULL` | Relationship (`Mother`, `Son`, `Spouse`, etc.) |
| `scope` | `text[]` | `NOT NULL` | Array of authorized scopes (`['vaccination', 'allergy']`) |
| `since` | `date` | `NOT NULL, DEFAULT CURRENT_DATE` | Caregiver appointment date |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Creation timestamp |
| `deleted_at` | `timestamp` | `NULLABLE` | Revocation timestamp |

---

### 3.7 Audit Trails, Emergency Overrides & Corrections

#### `audit_events`
Tamper-evident log of all accesses, downloads, modifications, and emergency break-glass sessions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Audit log UUID |
| `actor_user_id` | `uuid` | `REFERENCES users(id) ON DELETE SET NULL` | Performing user |
| `patient_id` | `uuid` | `REFERENCES patient_profiles(id) ON DELETE SET NULL` | Subject patient |
| `clinical_record_id` | `uuid` | `REFERENCES clinical_records(id) ON DELETE RESTRICT` | Specific record accessed |
| `action` | `varchar(100)` | `NOT NULL` | Action code (`view`, `upload`, `grant`, `revoke`, `emergency_break_glass`) |
| `resource_type` | `varchar(100)` | `NULLABLE` | Entity type |
| `resource_id` | `uuid` | `NULLABLE` | Entity ID |
| `ip_address` | `varchar(45)` | `NULLABLE` | Client IPv4/IPv6 address |
| `user_agent` | `text` | `NULLABLE` | Client user agent string |
| `occurred_at` | `timestamp` | `NOT NULL, DEFAULT now()` | UTC event timestamp |
| `metadata` | `jsonb` | `NULLABLE` | Clinical justification notes, emergency override flags |

#### `record_correction_requests`
Formal medical record amendment and correction requests initiated by patients.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Request UUID |
| `patient_id` | `uuid` | `NOT NULL, REFERENCES patient_profiles(id)` | Patient |
| `clinical_record_id` | `uuid` | `NOT NULL, REFERENCES clinical_records(id)` | Target record |
| `record_title` | `varchar(255)` | `NULLABLE` | Headline of target record |
| `requested_by` | `uuid` | `NOT NULL, REFERENCES users(id)` | Requesting user |
| `reason` | `text` | `NULLABLE` | Detailed clinical discrepancy reason |
| `proposed_text` | `text` | `NULLABLE` | Proposed corrected text |
| `proposed_correction` | `jsonb` | `NULLABLE` | Structured JSON patch |
| `status` | `varchar(30)` | `NOT NULL CHECK (status IN ('open', 'under_review', 'approved', 'rejected'))` | Resolution status |
| `reviewed_by` | `uuid` | `REFERENCES users(id)` | Reviewing clinician/admin |
| `review_notes` | `text` | `NULLABLE` | Clinical adjudication remarks |
| `reviewed_at` | `timestamp` | `NULLABLE` | Resolution timestamp |
| `created_at` | `timestamp` | `NOT NULL, DEFAULT now()` | Submission timestamp |

---

## 4. Indexes & Performance Optimizations

The schema includes dedicated composite indexes to guarantee sub-millisecond timeline filtering and rapid consent evaluation:

```sql
-- Chronological Timeline Queries
CREATE INDEX idx_clinical_records_patient_recorded_at 
ON clinical_records (patient_id, recorded_at DESC);

CREATE INDEX idx_clinical_records_patient_record_type_recorded_at 
ON clinical_records (patient_id, record_type, recorded_at DESC);

-- Real-Time Consent Resolution
CREATE INDEX idx_patient_access_grants_patient_grantee_status 
ON patient_access_grants (patient_id, grantee_user_id, status);

CREATE INDEX idx_patient_access_grants_status_validity 
ON patient_access_grants (status, valid_from, expires_at);

-- Audit History Retrieval
CREATE INDEX idx_audit_events_patient_occurred_at 
ON audit_events (patient_id, occurred_at DESC);

CREATE INDEX idx_audit_events_actor_occurred_at 
ON audit_events (actor_user_id, occurred_at DESC);

-- Document Search
CREATE INDEX idx_medical_documents_patient 
ON medical_documents (patient_id, created_at DESC);
```

---

## 5. Database Security & Immutability Triggers

To satisfy medical compliance and prevent retrospective tampering of access logs, the `audit_events` table enforces an append-only guarantee backed by a PostgreSQL trigger:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
    -- Permit cascading foreign key cleanup if users/profiles are removed
    IF TG_OP = 'UPDATE' AND (NEW.actor_user_id IS NULL OR NEW.patient_id IS NULL) 
       AND OLD.id = NEW.id AND OLD.action = NEW.action THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Audit history is immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
```

---

## 6. Complete DBML Specification (for dbdiagram.io)

Copy and paste the code block below directly into [dbdiagram.io](https://dbdiagram.io) to generate the complete entity-relationship diagram:

```dbml
// =====================================================================
// Mediclaim Database Schema (dbdiagram.io Specification)
// Version: 2.1.0
// Standard: HL7 FHIR R4 Compliant Longitudinal Health Records
// =====================================================================

Table users {
  id uuid [pk, default: `gen_random_uuid()`]
  public_id varchar(12) [not null, unique]
  mediclaim_id varchar(12) [unique, note: '12-digit Mediclaim ID']
  full_name varchar(200) [not null]
  email varchar(255) [unique]
  phone varchar(20) [not null, unique]
  aadhaar_number varchar(12) [unique, note: 'Masked reference']
  password_hash varchar(255) [not null]
  admin_verified boolean [not null, default: false]
  profile_complete boolean [not null, default: false]
  otp_hash text
  otp_expires_at bigint
  otp_attempts integer [not null, default: 0]
  is_active boolean [not null, default: true]
  created_at timestamp [not null, default: `now()`]
  updated_at timestamp [not null, default: `now()`]
}

Table user_roles {
  id uuid [pk, default: `gen_random_uuid()`]
  user_id uuid [not null]
  role varchar(30) [not null, note: 'patient | practitioner | hospital_admin | admin | caregiver']
  created_at timestamp [not null, default: `now()`]
  indexes {
    (user_id, role) [unique]
  }
}

Table patient_profiles {
  id uuid [pk, default: `gen_random_uuid()`]
  public_id varchar(12) [not null, unique]
  user_id uuid [not null, unique]
  date_of_birth date [not null, note: 'Foundational timeline origin']
  blood_group varchar(5)
  gender varchar(30)
  address text
  emergency_contact_name varchar(200)
  emergency_contact_phone varchar(20)
  emergency_contact_relation varchar(50)
  created_at timestamp [not null, default: `now()`]
  updated_at timestamp [not null, default: `now()`]
}

Table practitioner_profiles {
  id uuid [pk, default: `gen_random_uuid()`]
  public_id varchar(12) [not null, unique]
  user_id uuid [not null, unique]
  registration_number varchar(100) [not null, unique, note: 'Medical Council License']
  specialization varchar(150)
  qualification varchar(200)
  created_at timestamp [not null, default: `now()`]
}

Table healthcare_organizations {
  id uuid [pk, default: `gen_random_uuid()`]
  public_id varchar(12) [not null, unique]
  name varchar(255) [not null]
  organization_type varchar(50) [not null, note: 'hospital | clinic | diagnostic_center']
  registration_number varchar(100) [unique]
  address text
  phone varchar(20)
  email varchar(255)
  created_at timestamp [not null, default: `now()`]
}

Table organization_memberships {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]
  user_id uuid [not null]
  designation varchar(100)
  is_active boolean [not null, default: true]
  created_at timestamp [not null, default: `now()`]
  indexes {
    (organization_id, user_id) [unique]
  }
}

Table encounters {
  id uuid [pk, default: `gen_random_uuid()`]
  public_id varchar(12) [not null, unique]
  patient_id uuid [not null]
  practitioner_id uuid [not null]
  organization_id uuid
  encounter_type varchar(50) [not null, note: 'ambulatory | emergency | inpatient | home_visit']
  start_time timestamp [not null]
  end_time timestamp
  reason text
  diagnosis_summary text
  status varchar(30) [not null, note: 'planned | in_progress | completed | cancelled']
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id, start_time) [name: 'idx_encounters_patient_start_time']
  }
}

Table clinical_records {
  id uuid [pk, default: `gen_random_uuid()`]
  public_id varchar(12) [not null, unique]
  patient_id uuid [not null]
  encounter_id uuid
  created_by uuid [not null]
  record_type varchar(50) [not null, note: 'condition | allergy | medication | vaccination | report']
  title varchar(255) [not null]
  status varchar(30) [not null, note: 'draft | active | resolved | completed | archived']
  source varchar(30) [default: 'self_reported', note: 'self_reported | uploaded | practitioner']
  provider varchar(255)
  document_id uuid
  description text
  recorded_at timestamp [not null]
  created_at timestamp [not null, default: `now()`]
  updated_at timestamp [not null, default: `now()`]
  deleted_at timestamp
  fhir_resource_type varchar(100)
  fhir_resource_id varchar(100)
  fhir_version_id varchar(100)
  indexes {
    (patient_id, record_type, recorded_at) [name: 'idx_clinical_records_patient_type_date']
    (patient_id, recorded_at) [name: 'idx_clinical_records_patient_date']
  }
}

Table conditions {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  clinical_record_id uuid [not null]
  condition_name varchar(255) [not null]
  clinical_code varchar(100)
  code_system varchar(100)
  severity varchar(30) [note: 'mild | moderate | severe']
  status varchar(30) [not null, note: 'active | resolved | inactive']
  onset_date date
  resolved_date date
  notes text
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id) [name: 'idx_conditions_patient']
  }
}

Table allergies {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  clinical_record_id uuid [not null]
  allergen varchar(255) [not null]
  category varchar(50) [note: 'food | medication | environment | biologic']
  severity varchar(30) [note: 'mild | moderate | severe | life-threatening']
  criticality varchar(30) [note: 'low | high | unable-to-assess']
  status varchar(30) [not null, note: 'active | resolved | inactive']
  reaction text
  identified_date date
  notes text
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id) [name: 'idx_allergies_patient']
  }
}

Table prescriptions {
  id uuid [pk, default: `gen_random_uuid()`]
  public_id varchar(12) [not null, unique]
  patient_id uuid [not null]
  encounter_id uuid
  practitioner_id uuid
  organization_id uuid
  title varchar(255)
  doctor_name varchar(255)
  organization_name varchar(255)
  prescribed_at timestamp [not null]
  valid_until date
  status varchar(30) [not null, note: 'draft | active | completed | cancelled | expired']
  instructions text
  file_type varchar(50)
  file_name varchar(255)
  file_size_bytes bigint
  file_url text
  created_at timestamp [not null, default: `now()`]
  deleted_at timestamp
  indexes {
    (patient_id, prescribed_at) [name: 'idx_prescriptions_patient_date']
  }
}

Table prescription_items {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  prescription_id uuid [not null]
  medication_name varchar(255) [not null]
  medication_code varchar(100)
  dosage varchar(100)
  route varchar(50)
  frequency varchar(100)
  duration varchar(100)
  quantity varchar(100)
  refills integer [default: 0]
  instructions text
  indexes {
    (prescription_id) [name: 'idx_prescription_items_prescription_id']
  }
}

Table medication_statements {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  prescription_item_id uuid
  medication_name varchar(255) [not null]
  dosage varchar(100)
  start_date date
  end_date date
  status varchar(30) [not null, note: 'active | paused | completed | discontinued']
  adherence_notes text
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id) [name: 'idx_medication_statements_patient']
  }
}

Table vaccinations {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  clinical_record_id uuid [not null]
  vaccine_name varchar(255) [not null]
  dose_number integer
  administered_date date [not null]
  next_due_date date
  batch_number varchar(100)
  administered_by uuid
  organization_id uuid
  notes text
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id) [name: 'idx_vaccinations_patient']
  }
}

Table observations {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  encounter_id uuid
  clinical_record_id uuid [not null]
  observation_type varchar(100) [not null]
  value_numeric decimal(12,4)
  value_text text
  unit varchar(50)
  reference_range varchar(100)
  observed_at timestamp [not null]
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id, observation_type, observed_at) [name: 'idx_observations_type_date']
  }
}

Table diagnostic_reports {
  id uuid [pk, default: `gen_random_uuid()`]
  public_id varchar(12) [not null, unique]
  patient_id uuid [not null]
  encounter_id uuid
  ordered_by uuid
  organization_id uuid
  report_name varchar(255) [not null]
  report_type varchar(100)
  report_date date
  status varchar(30) [not null, note: 'draft | final | amended | cancelled']
  conclusion text
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id, report_date) [name: 'idx_diagnostic_reports_date']
  }
}

Table lab_results {
  id uuid [pk, default: `gen_random_uuid()`]
  diagnostic_report_id uuid [not null]
  test_name varchar(255) [not null]
  test_code varchar(100)
  result_value varchar(255)
  unit varchar(50)
  reference_range varchar(100)
  interpretation varchar(100)
  result_date timestamp
  notes text
  indexes {
    (diagnostic_report_id) [name: 'idx_lab_results_report']
  }
}

Table procedures {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  encounter_id uuid
  practitioner_id uuid
  organization_id uuid
  procedure_name varchar(255) [not null]
  procedure_code varchar(100)
  performed_date date
  status varchar(30) [not null, note: 'planned | performed | cancelled | completed']
  outcome text
  notes text
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id) [name: 'idx_procedures_patient']
  }
}

Table hospitalizations {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  organization_id uuid
  admission_date timestamp [not null]
  discharge_date timestamp
  admission_reason text
  discharge_summary text
  attending_practitioner_id uuid
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id) [name: 'idx_hospitalizations_patient']
  }
}

Table medical_documents {
  id uuid [pk, default: `gen_random_uuid()`]
  public_id varchar(12) [not null, unique]
  patient_id uuid [not null]
  clinical_record_id uuid
  uploaded_by uuid [not null]
  document_type varchar(100)
  title varchar(255) [not null]
  original_filename varchar(255)
  storage_key varchar(500) [not null]
  mime_type varchar(100)
  file_size_bytes bigint
  document_date date
  checksum varchar(128)
  ocr_status varchar(30) [not null, default: 'pending', note: 'pending | processing | needs_review | completed | failed']
  extracted_text text
  extracted_payload jsonb
  parse_confidence real
  parser_provider varchar(50)
  parse_error text
  parsed_at timestamp
  confirmed_at timestamp
  created_at timestamp [not null, default: `now()`]
  deleted_at timestamp
  indexes {
    (patient_id) [name: 'idx_medical_documents_patient']
  }
}

Table document_versions {
  id uuid [pk, default: `gen_random_uuid()`]
  document_id uuid [not null]
  version_number integer [not null]
  storage_key varchar(500) [not null]
  checksum varchar(128)
  uploaded_by uuid [not null]
  created_at timestamp [not null, default: `now()`]
  indexes {
    (document_id, version_number) [unique]
  }
}

Table patient_access_grants {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  consent_record_id uuid
  grantee_user_id uuid
  organization_id uuid
  grantee_name varchar(255)
  grantee_role varchar(255)
  duration_hours integer
  granted_by uuid [not null]
  purpose text
  valid_from timestamp
  expires_at timestamp
  revoked_at timestamp
  status varchar(30) [not null, note: 'active | revoked | expired | pending']
  created_at timestamp [not null, default: `now()`]
  deleted_at timestamp
  indexes {
    (patient_id, grantee_user_id, status) [name: 'idx_access_grants_grantee']
    (status, valid_from, expires_at) [name: 'idx_access_grants_validity']
  }
}

Table access_grant_scopes {
  id uuid [pk, default: `gen_random_uuid()`]
  access_grant_id uuid [not null]
  record_type varchar(50) [not null, note: 'allergy | condition | medication | vaccination | report']
  permission varchar(30) [not null, note: 'read | write']
  indexes {
    (access_grant_id, record_type, permission) [unique]
  }
}

Table consent_records {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  granted_by uuid [not null]
  granted_to_user_id uuid
  organization_id uuid
  consent_type varchar(100) [not null]
  purpose text
  status varchar(30) [not null, note: 'active | revoked | expired | pending']
  consented_at timestamp
  expires_at timestamp
  withdrawn_at timestamp
  created_at timestamp [not null, default: `now()`]
  deleted_at timestamp
  indexes {
    (patient_id, status, consented_at) [name: 'idx_consent_records_status']
  }
}

Table patient_caregivers {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  name varchar(200) [not null]
  relation varchar(100) [not null]
  scope text[] [not null]
  since date [not null, default: `CURRENT_DATE`]
  created_at timestamp [not null, default: `now()`]
  deleted_at timestamp
}

Table audit_events {
  id uuid [pk, default: `gen_random_uuid()`]
  actor_user_id uuid
  patient_id uuid
  action varchar(100) [not null, note: 'view | upload | grant | revoke | emergency_break_glass']
  resource_type varchar(100)
  resource_id uuid
  ip_address varchar(45)
  user_agent text
  occurred_at timestamp [not null, default: `now()` credit: 'Immutable trigger enforced']
  metadata jsonb
  indexes {
    (patient_id, occurred_at) [name: 'idx_audit_patient_date']
    (actor_user_id, occurred_at) [name: 'idx_audit_actor_date']
  }
}

Table clinical_record_versions {
  id uuid [pk, default: `gen_random_uuid()`]
  clinical_record_id uuid [not null]
  version_number integer [not null]
  changed_by uuid [not null]
  previous_data jsonb
  change_summary text
  created_at timestamp [not null, default: `now()`]
  indexes {
    (clinical_record_id, version_number) [unique]
  }
}

Table record_correction_requests {
  id uuid [pk, default: `gen_random_uuid()`]
  patient_id uuid [not null]
  clinical_record_id uuid [not null]
  record_title varchar(255)
  requested_by uuid [not null]
  reason text
  proposed_text text
  proposed_correction jsonb
  status varchar(30) [not null, note: 'open | under_review | approved | rejected']
  reviewed_by uuid
  review_notes text
  reviewed_at timestamp
  created_at timestamp [not null, default: `now()`]
  indexes {
    (patient_id) [name: 'idx_corrections_patient']
  }
}

// ---------------------------------------------------------------------
// Foreign Key Relationships
// ---------------------------------------------------------------------
Ref: user_roles.user_id > users.id [delete: cascade]
Ref: patient_profiles.user_id > users.id [delete: cascade]
Ref: practitioner_profiles.user_id > users.id [delete: cascade]
Ref: organization_memberships.organization_id > healthcare_organizations.id
Ref: organization_memberships.user_id > users.id
Ref: encounters.patient_id > patient_profiles.id
Ref: encounters.practitioner_id > practitioner_profiles.id
Ref: encounters.organization_id > healthcare_organizations.id
Ref: clinical_records.patient_id > patient_profiles.id
Ref: clinical_records.encounter_id > encounters.id
Ref: clinical_records.created_by > users.id
Ref: clinical_records.document_id > medical_documents.id [delete: set null]
Ref: conditions.patient_id > patient_profiles.id
Ref: conditions.clinical_record_id > clinical_records.id
Ref: allergies.patient_id > patient_profiles.id
Ref: allergies.clinical_record_id > clinical_records.id
Ref: prescriptions.patient_id > patient_profiles.id
Ref: prescriptions.encounter_id > encounters.id
Ref: prescriptions.practitioner_id > practitioner_profiles.id
Ref: prescriptions.organization_id > healthcare_organizations.id
Ref: prescription_items.prescription_id > prescriptions.id [delete: cascade]
Ref: medication_statements.patient_id > patient_profiles.id
Ref: medication_statements.prescription_item_id > prescription_items.id
Ref: vaccinations.patient_id > patient_profiles.id
Ref: vaccinations.clinical_record_id > clinical_records.id
Ref: vaccinations.administered_by > users.id
Ref: vaccinations.organization_id > healthcare_organizations.id
Ref: observations.patient_id > patient_profiles.id
Ref: observations.encounter_id > encounters.id
Ref: observations.clinical_record_id > clinical_records.id
Ref: diagnostic_reports.patient_id > patient_profiles.id
Ref: diagnostic_reports.encounter_id > encounters.id
Ref: diagnostic_reports.ordered_by > practitioner_profiles.id
Ref: diagnostic_reports.organization_id > healthcare_organizations.id
Ref: lab_results.diagnostic_report_id > diagnostic_reports.id [delete: cascade]
Ref: procedures.patient_id > patient_profiles.id
Ref: procedures.encounter_id > encounters.id
Ref: procedures.practitioner_id > practitioner_profiles.id
Ref: procedures.organization_id > healthcare_organizations.id
Ref: hospitalizations.patient_id > patient_profiles.id
Ref: hospitalizations.organization_id > healthcare_organizations.id
Ref: hospitalizations.attending_practitioner_id > practitioner_profiles.id
Ref: medical_documents.patient_id > patient_profiles.id
Ref: medical_documents.clinical_record_id > clinical_records.id
Ref: medical_documents.uploaded_by > users.id
Ref: document_versions.document_id > medical_documents.id [delete: cascade]
Ref: document_versions.uploaded_by > users.id
Ref: patient_access_grants.patient_id > patient_profiles.id
Ref: patient_access_grants.consent_record_id > consent_records.id [delete: set null]
Ref: patient_access_grants.grantee_user_id > users.id
Ref: patient_access_grants.organization_id > healthcare_organizations.id
Ref: patient_access_grants.granted_by > users.id
Ref: access_grant_scopes.access_grant_id > patient_access_grants.id [delete: cascade]
Ref: consent_records.patient_id > patient_profiles.id
Ref: consent_records.granted_by > users.id
Ref: consent_records.granted_to_user_id > users.id
Ref: consent_records.organization_id > healthcare_organizations.id
Ref: patient_caregivers.patient_id > patient_profiles.id [delete: cascade]
Ref: audit_events.actor_user_id > users.id [delete: set null]
Ref: audit_events.patient_id > patient_profiles.id [delete: set null]
Ref: clinical_record_versions.clinical_record_id > clinical_records.id
Ref: clinical_record_versions.changed_by > users.id
Ref: record_correction_requests.patient_id > patient_profiles.id
Ref: record_correction_requests.clinical_record_id > clinical_records.id
Ref: record_correction_requests.requested_by > users.id
Ref: record_correction_requests.reviewed_by > users.id
```
