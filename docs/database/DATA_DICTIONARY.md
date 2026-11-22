# Database Architecture: Data Dictionary & Entity Catalog

## 1. Overview
This document serves as the authoritative data dictionary for the Mediclaim PostgreSQL relational database schema.

## 2. Core Entities

### 2.1 Table: `users`
Represents authentication credentials and core identity for all platform participants.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | Unique user account identifier |
| `phone` | VARCHAR(20) | UNIQUE, NOT NULL | Primary mobile number used for 2FA OTP |
| `email` | VARCHAR(255)| UNIQUE, NULLABLE | Optional contact / notification email |
| `password_hash` | VARCHAR(255)| NOT NULL | Argon2id cryptographic password hash |
| `role` | VARCHAR(20) | NOT NULL | `patient`, `doctor`, `hospital`, `admin` |
| `is_active` | BOOLEAN | DEFAULT TRUE | Account operational status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Registration timestamp |

### 2.2 Table: `patient_profiles`
Stores sovereign demographic records for registered patients.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | Unique profile identifier |
| `user_id` | UUID | REFERENCES users(id) ON DELETE CASCADE | Associated user account |
| `mediclaim_id` | VARCHAR(20) | UNIQUE, NOT NULL | 12-digit permanent health identifier |
| `aadhaar_masked`| VARCHAR(20) | NULLABLE | Display-safe masked Aadhaar (`XXXX-XXXX-1234`) |
| `full_name` | VARCHAR(255)| NOT NULL | Legal full name |
| `date_of_birth` | DATE | NOT NULL | Birth date |
| `gender` | VARCHAR(20) | NOT NULL | Gender identity |
| `blood_group` | VARCHAR(10) | NOT NULL | ABO / Rh blood group |
| `phone` | VARCHAR(20) | NOT NULL | Contact telephone |
| `address` | TEXT | NULLABLE | Residential street address |
| `is_profile_complete` | BOOLEAN | DEFAULT FALSE | Completion status flag |

### 2.3 Table: `clinical_records`
Polymorphic longitudinal health records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | Record UUID |
| `patient_id` | UUID | REFERENCES patient_profiles(id) ON DELETE CASCADE | Patient owner |
| `kind` | VARCHAR(30) | NOT NULL | `allergy`, `condition`, `medication`, etc. |
| `title` | VARCHAR(255)| NOT NULL | Clinical summary title |
| `detail` | TEXT | NULLABLE | Clinical narrative notes |
| `date` | DATE | NOT NULL | Clinical encounter date |
| `provider` | VARCHAR(255)| NULLABLE | Clinician or hospital name |
| `status` | VARCHAR(30) | DEFAULT 'active' | Clinical state |
| `source` | VARCHAR(30) | DEFAULT 'self_reported' | `self_reported`, `uploaded`, `practitioner` |

### 2.4 Table: `patient_access_grants`
Active and historical consent grants authorizing clinician access.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY | Grant UUID |
| `patient_id` | UUID | REFERENCES patient_profiles(id) ON DELETE CASCADE | Authorizing patient |
| `grantee_user_id`| UUID | REFERENCES users(id) ON DELETE CASCADE | Authorized practitioner |
| `scope` | VARCHAR(255)| NOT NULL | Space/comma-delimited approved scopes |
| `valid_from` | TIMESTAMPTZ | DEFAULT NOW() | Grant start timestamp |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Absolute grant expiry timestamp |
| `status` | VARCHAR(20) | DEFAULT 'active' | `active`, `expired`, `revoked` |
