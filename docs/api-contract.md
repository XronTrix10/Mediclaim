# Mediclaim Backend API Contract & Specification

**Version**: 2.0.0  
**Base URL**: `http://localhost:8000/api/v1`  
**Healthcare Standard**: HL7 FHIR R4  
**Authentication**: Bearer JWT (`Authorization: Bearer <token>`)  
**Data Encryption**: Envelope encryption (AES-256-GCM per-patient data keys)  
**Error Standard**: RFC 9457 / RFC 7807 Problem Details (`application/problem+json`)

---

## Table of Contents
1. [Overview & Architectural Principles](#1-overview--architectural-principles)
2. [Data Types, Enums & Formatting Conventions](#2-data-types-enums--formatting-conventions)
3. [Authentication & Account Lifecycle (`/auth`)](#3-authentication--account-lifecycle-auth)
4. [Patient Profile Management (`/patients`)](#4-patient-profile-management-patients)
5. [Clinical Records & FHIR Resources (`/records`)](#5-clinical-records--fhir-resources-records)
6. [Document Ingestion & File Storage (`/uploads` & `/documents`)](#6-document-ingestion--file-storage-uploads--documents)
7. [Lifelong Timeline & Health Graph (`/timeline`)](#7-lifelong-timeline--health-graph-timeline)
8. [Doctor Consent & Access Control (`/consent`)](#8-doctor-consent--access-control-consent)
9. [Emergency Break-Glass Protocol (`/emergency`)](#9-emergency-break-glass-protocol-emergency)
10. [Audit Logging & Clinical Corrections (`/audit` & `/corrections`)](#10-audit-logging--clinical-corrections-audit--corrections)
11. [Administrator Portal & Verifications (`/admin`)](#11-administrator-portal--verifications-admin)
12. [Doctor & Hospital Portal Access (`/doctor` & `/hospital`)](#12-doctor--hospital-portal-access-doctor--hospital)
13. [Standard Error Responses & Status Codes](#13-standard-error-responses--status-codes)

---

## 1. Overview & Architectural Principles

### 1.1 Core Principles
- **Distinct Mediclaim ID**: Patients receive a unique 12-digit Mediclaim ID (e.g. `9481 2049 3817`), generated randomly with a Verhoeff/Luhn check digit, completely separate from any national ID.
- **Privacy & Aadhaar Protection**: In compliance with UIDAI regulations and the Aadhaar Act, raw 12-digit Aadhaar numbers are never stored in plaintext. Identity verification is conducted via simulated/authorized e-KYC or Virtual ID (VID). Only a secure verification token and masked reference (e.g., `XXXX-XXXX-8921`) are retained. Compatible with ABHA (Ayushman Bharat Health Account) ABDM standards.
- **Time-Bounded Doctor Access & Instant Revocation**: Doctor access tokens contain the grant identifier (`grt` claim) in addition to an expiration (`exp`). Every clinical request strictly validates in real time that the underlying grant is in `active` state. If a patient revokes access, subsequent requests immediately return `403 CONSENT_REVOKED`.
- **Scoped Clinical Consent**: Patient records are partitioned into scopes (`allergy`, `medication`, `condition`, `vaccination`, `report`). Doctors may only access data matching approved scopes; out-of-scope requests return `403 SCOPE_UNAUTHORIZED`. Sensitive categories (`mental_health`, `reproductive_health`, `substance_use`) require explicit opt-in.
- **Break-Glass Emergency Protocol**: Authorized emergency personnel can bypass consent for critical care, creating an immutable, tamper-evident audit record, alerting the patient/caregivers, and triggering mandatory clinical review.
- **Envelope Response Format**: All successful responses follow a uniform envelope:
  ```json
  {
    "status": "success",
    "data": { ... },
    "meta": {
      "requestId": "req_01J...",
      "serverTime": "2026-11-16T22:30:00Z"
    }
  }
  ```
  List endpoints include pagination metadata (`total`, `limit`, `nextCursor`).

---

## 2. Data Types, Enums & Formatting Conventions

### 2.1 Identifiers
All database and API identifiers use opaque, typed prefixes:
- User: `usr_<uuid>`
- Patient Profile: `pat_<uuid>`
- Practitioner Profile: `doc_<uuid>`
- Healthcare Organization: `org_<uuid>`
- Clinical Record: `rec_<uuid>`
- Prescription: `rx_<uuid>`
- Access Request: `req_<uuid>`
- Access Grant: `grt_<uuid>`
- Document / Upload: `doc_<uuid>` or `upl_<uuid>`
- Correction Request: `corr_<uuid>`
- Audit Event: `aud_<uuid>`

### 2.2 Date and Time
- All dates use `YYYY-MM-DD` (ISO 8601).
- All timestamps use ISO 8601 UTC with explicit `Z` indicator: `YYYY-MM-DDTHH:MM:SSZ`.
- Client interfaces calculate relative times ("2 hours left", "10 minutes ago") from UTC timestamps and `serverTime`.

### 2.3 Enumerations
- **UserRole**: `patient` | `practitioner` | `hospital_admin` | `caregiver` | `admin`
- **Gender**: `Male` | `Female` | `Non-binary` | `Other` | `Prefer not to say`  
  *(Mapped to FHIR `male` | `female` | `other` | `unknown` with original value preserved in extension)*
- **BloodGroup**: `A+` | `A-` | `B+` | `B-` | `AB+` | `AB-` | `O+` | `O-` | `Unknown` *(always ASCII hyphen-minus)*
- **EmergencyRelation**: `Parent` | `Spouse` | `Sibling` | `Child` | `Friend` | `Guardian` | `Other`
- **Kind (Record Category)**: `allergy` | `condition` | `medication` | `vaccination` | `report`
- **RecordStatus**: `active` | `resolved` | `inactive` | `completed` | `discontinued`
- **RecordSource**: `self_reported` | `uploaded` | `practitioner`
- **AllergyCategory**: `food` | `medication` | `environment` | `biologic`
- **AllergySeverity**: `mild` | `moderate` | `severe` | `life-threatening`
- **AllergyCriticality**: `low` | `high` | `unable-to-assess`
- **EmergencyType**: `TRAUMA_RESUSCITATION` | `ACUTE_CORONARY` | `STROKE_THROMBOLYSIS` | `MASS_CASUALTY` | `OTHER_LIFE_THREATENING`

---

## 3. Authentication & Account Lifecycle (`/auth`)

### 3.1 Register New Patient Account
`POST /api/v1/auth/register`

Initiates patient registration and sends an SMS verification OTP. The 12-digit Mediclaim ID is generated internally but **not revealed** until administrator approval.

#### Request Body
```json
{
  "fullName": "Ananya Rao",
  "dateOfBirth": "1994-05-12",
  "phone": "+919876543210",
  "aadhaarNumber": "482193061175",
  "password": "SecurePassword123!"
}
```

#### Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Account created. Verification OTP dispatched.",
  "data": {
    "userId": "usr_8f3a921b-640a-49c1-8d20-410a72ce1234",
    "phone": "+919876543210",
    "accountStatus": "pending_otp",
    "otpSent": true,
    "otpExpiresInSeconds": 300
  },
  "meta": {
    "requestId": "req_01J0A1B2C3",
    "serverTime": "2026-11-16T22:30:00Z"
  }
}
```

---

### 3.2 Verify Phone / Registration OTP
`POST /api/v1/auth/verify-otp`

Validates the one-time password and marks the phone as verified. The account enters `pending_admin_approval` status. The Mediclaim ID is **not returned** and the user cannot sign in until an administrator verifies the account. Upon approval, the Mediclaim ID is dispatched via SMS/email. Rate-limited to 5 incorrect attempts before lockout.

#### Request Body
```json
{
  "userId": "usr_8f3a921b-640a-49c1-8d20-410a72ce1234",
  "otp": "492018"
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Phone number verified successfully. Account is pending admin verification.",
  "data": {
    "userId": "usr_8f3a921b-640a-49c1-8d20-410a72ce1234",
    "phone": "+919876543210",
    "accountStatus": "pending_admin_approval",
    "phoneVerified": true,
    "adminVerified": false,
    "message": "Phone number verified successfully. Your account is pending admin verification."
  },
  "meta": {
    "requestId": "req_01J0A1B2C4",
    "serverTime": "2026-11-16T22:31:00Z"
  }
}
```

---

### 3.3 Sign In (Password or SMS OTP)
`POST /api/v1/auth/login`

Accepts 12-digit Mediclaim ID (digits or spaced) with password or verified OTP.

#### Request Body
```json
{
  "mediclaimId": "9481 2049 3817",
  "password": "SecurePassword123!"
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "usr_8f3a921b-640a-49c1-8d20-410a72ce1234",
      "fullName": "Ananya Rao",
      "email": "ananya.rao@example.com",
      "phone": "+919876543210",
      "role": "patient",
      "mediclaimId": "9481 2049 3817",
      "isActive": true,
      "adminVerified": false,
      "isProfileComplete": true
    }
  },
  "meta": {
    "requestId": "req_01J0A1B2C5",
    "serverTime": "2026-11-16T22:32:00Z"
  }
}
```

---

### 3.4 Request Login SMS OTP
`POST /api/v1/auth/otp/request`

#### Request Body
```json
{
  "mediclaimId": "9481 2049 3817"
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Login OTP dispatched to registered mobile number.",
  "data": {
    "maskedPhone": "+91 XXXXX 43210",
    "otpExpiresInSeconds": 300
  }
}
```

---

### 3.5 Resend OTP
`POST /api/v1/auth/resend-otp`

Dispatches a new OTP with exponential back-off rules.

#### Request Body
```json
{
  "userId": "usr_8f3a921b-640a-49c1-8d20-410a72ce1234"
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "New OTP dispatched successfully.",
  "data": {
    "otpExpiresInSeconds": 300
  }
}
```

---

### 3.6 Refresh Token & Logout
- `POST /api/v1/auth/refresh`: Issues a refreshed short-lived access token.
- `POST /api/v1/auth/logout`: Invalidates the active session and tokens.

---

## 4. Patient Profile Management (`/patients`)

### 4.1 Get Current Patient Profile
`GET /api/v1/patients/me`

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": "pat_001",
    "userId": "usr_8f3a921b-640a-49c1-8d20-410a72ce1234",
    "mediclaimId": "9481 2049 3817",
    "aadhaarMasked": "XXXX-XXXX-8921",
    "fullName": "Ananya Rao",
    "firstName": "Ananya",
    "dateOfBirth": "1994-05-12",
    "gender": "Female",
    "bloodGroup": "O+",
    "phone": "+919876543210",
    "address": "Flat 402, Sea View Apartments, Shivaji Park, Mumbai, Maharashtra – 400028",
    "emergencyContact": {
      "name": "Lakshmi Rao",
      "phone": "+919876512345",
      "relation": "Mother"
    },
    "isProfileComplete": true,
    "createdAt": "2024-01-10T08:00:00Z",
    "updatedAt": "2026-09-02T10:30:00Z"
  }
}
```

---

### 4.2 Complete Profile (Mandatory on First Login)
`POST /api/v1/patients/me/complete-profile`

#### Request Body
```json
{
  "gender": "Female",
  "bloodGroup": "O+",
  "address": "Flat 402, Sea View Apartments, Shivaji Park, Mumbai – 400028",
  "emergencyName": "Lakshmi Rao",
  "emergencyPhone": "+919876512345",
  "emergencyRelation": "Mother"
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Patient profile completed successfully.",
  "data": {
    "isProfileComplete": true,
    "updatedAt": "2026-11-16T22:33:00Z"
  }
}
```

---

### 4.3 Update Permitted Personal Details
`PATCH /api/v1/patients/me/permitted-details`

Allows editing contact details and emergency contacts without altering clinical records.

#### Request Body
```json
{
  "phone": "+919876599999",
  "address": "Bungalow 12, Koregaon Park, Pune – 411001",
  "emergencyContact": {
    "name": "Lakshmi Rao",
    "phone": "+919876588888",
    "relation": "Mother"
  }
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Permitted details updated successfully.",
  "data": {
    "phone": "+919876599999",
    "address": "Bungalow 12, Koregaon Park, Pune – 411001",
    "emergencyContact": {
      "name": "Lakshmi Rao",
      "phone": "+919876588888",
      "relation": "Mother"
    },
    "updatedAt": "2026-11-16T22:34:00Z"
  }
}
```

---

## 5. Clinical Records & FHIR Resources (`/records`)

### 5.1 Get All Records (Aggregated & Filterable)
`GET /api/v1/records?kind=medication&status=active&limit=20`

**Query Parameters**:
- `kind`: `allergy` | `condition` | `medication` | `vaccination` | `report`
- `status`: `active` | `resolved` | `inactive` | `completed` | `discontinued`
- `q`: Free-text search matching title, provider, or medication/condition name
- `from`: `YYYY-MM-DD`
- `to`: `YYYY-MM-DD`
- `limit`: integer (default 20, max 100)
- `cursor`: string for cursor-based pagination
- `include`: `fhir` (optional, to include raw FHIR resources)

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "rec_05",
      "kind": "medication",
      "title": "Budesonide inhaler",
      "short": "Budesonide",
      "detail": "200 mcg, twice daily. Preventer for asthma.",
      "date": "2024-01-15",
      "provider": "Dr. Rohan Kulkarni, Lifeline Clinic",
      "status": "active",
      "source": "practitioner"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "nextCursor": null,
    "requestId": "req_01J0A1B2C6"
  }
}
```

---

### 5.2 Get Record Details by ID
`GET /api/v1/records/{id}`

Returns the full clinical event and its complete FHIR R4 representation.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": "rec_05",
    "kind": "medication",
    "title": "Budesonide inhaler",
    "short": "Budesonide",
    "detail": "200 mcg, twice daily. Preventer for asthma.",
    "date": "2024-01-15",
    "provider": "Dr. Rohan Kulkarni, Lifeline Clinic",
    "status": "active",
    "source": "practitioner",
    "fhirResource": {
      "resourceType": "MedicationStatement",
      "id": "med-stmt-05",
      "status": "active",
      "medicationCodeableConcept": {
        "coding": [{
          "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
          "code": "19839",
          "display": "Budesonide"
        }]
      },
      "dosage": [{
        "text": "200 mcg, twice daily"
      }]
    }
  }
}
```

---

### 5.3 Record an Allergy
`POST /api/v1/records/allergies`

Allows patient self-reporting (`source: self_reported`) or practitioner entry.

#### Request Body
```json
{
  "allergen": "Penicillin",
  "category": "medication",
  "severity": "severe",
  "criticality": "high",
  "reaction": "Skin rash, hives, and bronchospasm",
  "provider": "Dr. S. Nair, Family Clinic",
  "notes": "Strictly avoid penicillin and beta-lactam antibiotics."
}
```

#### Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Allergy recorded successfully.",
  "data": {
    "id": "rec_alg_001",
    "kind": "allergy",
    "title": "Penicillin",
    "category": "medication",
    "severity": "severe",
    "criticality": "high",
    "reaction": "Skin rash, hives, and bronchospasm",
    "status": "active",
    "source": "self_reported",
    "date": "2026-11-16",
    "provider": "Dr. S. Nair, Family Clinic",
    "notes": "Strictly avoid penicillin and beta-lactam antibiotics.",
    "fhirId": "AllergyIntolerance/ai-001"
  }
}
```

---

### 5.4 Get Saved Prescriptions
`GET /api/v1/records/prescriptions`

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "rx_01",
      "kind": "medication",
      "title": "Asthma Maintenance Prescription",
      "doctor": "Dr. Rohan Kulkarni",
      "organization": "Lifeline Pulmonology Clinic",
      "date": "2026-08-14",
      "status": "active",
      "fileType": "pdf",
      "fileName": "prescription_kulkarni_aug2026.pdf",
      "fileSizeBytes": 421888,
      "instructions": "Take 2 puffs daily in the morning.",
      "medications": [
        { "name": "Budesonide Inhaler", "dosage": "200 mcg", "frequency": "Twice daily", "duration": "90 days" }
      ]
    }
  ],
  "meta": {
    "total": 1
  }
}
```

---

### 5.5 Retract / Remove Prescription
`DELETE /api/v1/records/prescriptions/{id}`

Performs clinical retraction (`status: entered-in-error` / soft-delete) preserving full audit history.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Prescription retracted successfully."
}
```

---

### 5.6 Create Clinical Records (Practitioner Endpoints)
- `POST /api/v1/records/conditions` (Condition / Diagnosis)
- `POST /api/v1/records/medications` (Prescribed Medication)
- `POST /api/v1/records/vaccinations` (Immunization entry)
- `POST /api/v1/records/reports` (Diagnostic & Lab report entry)

---

## 6. Document Ingestion & File Storage (`/uploads` & `/documents`)

### 6.1 Upload Prescription / Medical Document
`POST /api/v1/uploads`  
**Content-Type**: `multipart/form-data`  
**Max File Size**: 10 MB  
**Allowed Types**: `application/pdf`, `image/png`, `image/jpeg`

#### Form Parameters:
- `file`: Binary file data
- `title`: string
- `doctor`: string
- `consultationDate`: `YYYY-MM-DD`
- `organization`: string (optional)
- `documentType`: `prescription` | `lab_report` | `discharge_summary`

#### Response (`202 Accepted` or `201 Created`)
```json
{
  "status": "success",
  "message": "Document uploaded and queued for processing.",
  "data": {
    "uploadId": "upl_20261116_001",
    "documentId": "doc_9a8b7c01",
    "fileName": "chest_prescription.pdf",
    "fileType": "pdf",
    "fileSizeBytes": 421890,
    "ocrStatus": "processing",
    "date": "2026-11-16",
    "doctor": "Dr. Rohan Kulkarni"
  }
}
```

---

### 6.2 Stream / Download Authenticated Document Content
`GET /api/v1/documents/{id}/content`

Streams decrypted document binary with `Cache-Control: no-store` and `Content-Disposition: inline`. Requires active session or authorized doctor grant.

---

## 7. Lifelong Timeline & Health Graph (`/timeline`)

### 7.1 Get Chronological Timeline
`GET /api/v1/timeline?kind=vaccination&from=2020-01-01`

Returns chronological health events from birth to present.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "patientId": "pat_001",
    "dob": "1994-05-12",
    "totalEvents": 2,
    "events": [
      {
        "id": "rec_01",
        "kind": "vaccination",
        "title": "Tdap booster",
        "detail": "Tetanus, diphtheria and pertussis booster. One dose.",
        "date": "2026-09-02",
        "provider": "Dr. Meera Iyer, Shivaji Park Clinic",
        "ageAtEventMonths": 387,
        "status": "active"
      }
    ]
  }
}
```

---

### 7.2 Get Health Graph Network Structure
`GET /api/v1/timeline/graph`

Returns a normalized graph structure with nodes, categorical branches, and cross-resource clinical edges (e.g. condition treated by medication).

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "center": {
      "patientName": "Ananya",
      "birthYear": "1994"
    },
    "nodes": [
      { "id": "rec_08", "kind": "condition", "label": "Asthma", "status": "active" },
      { "id": "rec_05", "kind": "medication", "label": "Budesonide", "status": "active" }
    ],
    "edges": [
      { "source": "rec_05", "target": "rec_08", "relation": "treats" }
    ],
    "branches": [
      { "kind": "allergy", "categoryLabel": "Allergies", "total": 2 },
      { "kind": "condition", "categoryLabel": "Conditions", "total": 3 }
    ]
  }
}
```

---

## 8. Doctor Consent & Access Control (`/consent`)

### 8.1 Request Temporary Access (Doctor Initiated)
`POST /api/v1/consent/requests`

The doctor's identity and organization are extracted securely from their JWT.

#### Request Body
```json
{
  "patientMediclaimId": "9481 2049 3817",
  "scope": ["allergy", "medication"],
  "durationHours": 2,
  "purpose": "Evaluation of acute allergic dermatitis"
}
```

#### Response (`202 Accepted`)
```json
{
  "status": "success",
  "message": "Access request queued for patient authorization.",
  "data": {
    "requestId": "req_98210",
    "patientMediclaimId": "9481 2049 3817",
    "expiresAt": "2026-11-17T22:30:00Z"
  }
}
```

---

### 8.2 List Access Requests (Patient View)
`GET /api/v1/consent/requests?status=pending`

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "req_98210",
      "name": "Dr. Farhan Ali",
      "role": "Dermatologist, Skin & Care Centre",
      "scope": ["allergy", "medication"],
      "durationHours": 2,
      "purpose": "Evaluation of acute allergic dermatitis",
      "status": "pending",
      "requestedAt": "2026-11-16T22:35:00Z"
    }
  ]
}
```

---

### 8.3 Patient Approves Access Request
`POST /api/v1/consent/requests/{id}/approve`

#### Request Body
```json
{
  "approvedScope": ["allergy", "medication"],
  "durationHours": 2
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Doctor access approved.",
  "data": {
    "grantId": "grt_98210",
    "grantStatus": "active",
    "name": "Dr. Farhan Ali",
    "role": "Dermatologist, Skin & Care Centre",
    "scope": ["allergy", "medication"],
    "validFrom": "2026-11-16T22:36:00Z",
    "expiresAt": "2026-11-17T00:36:00Z"
  }
}
```

---

### 8.4 Patient Declines Access Request
`POST /api/v1/consent/requests/{id}/decline`

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Access request declined."
}
```

---

### 8.5 List Active and Past Grants
`GET /api/v1/consent/grants`

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "grt_98210",
      "name": "Dr. Farhan Ali",
      "role": "Dermatologist, Skin & Care Centre",
      "scope": ["allergy", "medication"],
      "validFrom": "2026-11-16T22:36:00Z",
      "expiresAt": "2026-11-17T00:36:00Z",
      "grantStatus": "active"
    }
  ]
}
```

---

### 8.6 Directly Give Access to Doctor
`POST /api/v1/consent/grants`

Patients can grant instant time-bounded access using a doctor's identifier.

#### Request Body
```json
{
  "practitionerId": "doc_dr_kulkarni_401",
  "name": "Dr. Rohan Kulkarni",
  "role": "Pulmonologist",
  "scope": ["allergy", "medication", "condition"],
  "durationHours": 2
}
```

#### Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Access granted.",
  "data": {
    "id": "grt_direct_01",
    "name": "Dr. Rohan Kulkarni",
    "role": "Pulmonologist",
    "scope": ["allergy", "medication", "condition"],
    "grantStatus": "active",
    "validFrom": "2026-11-16T22:37:00Z",
    "expiresAt": "2026-11-17T00:37:00Z"
  }
}
```

---

### 8.7 Revoke Access Immediately
`DELETE /api/v1/consent/grants/{id}`

Terminates the grant immediately. All subsequent requests using the doctor token return `403 CONSENT_REVOKED`.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Doctor access revoked immediately. Session terminated."
}
```

---

### 8.8 Caregiver Management
- `GET /api/v1/consent/caregivers`: Lists assigned family caregivers.
- `POST /api/v1/consent/caregivers`: Assigns a new caregiver with scoped permissions.
- `DELETE /api/v1/consent/caregivers/{id}`: Revokes caregiver access.

---

## 9. Emergency Break-Glass Protocol (`/emergency`)

`POST /api/v1/emergency/access`  
**Authorization**: Accredited Emergency Practitioners & Hospital Admins.

Bypasses patient consent during life-or-death emergencies. Generates an immediate audit event, triggers SMS alert to patient & emergency contacts, and schedules mandatory review.

#### Request Body
```json
{
  "patientMediclaimId": "9481 2049 3817",
  "emergencyType": "TRAUMA_RESUSCITATION",
  "clinicalJustification": "Patient unconscious in ER following motor vehicle collision. Immediate allergy and blood group verification required."
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Emergency access authorized under break-glass protocol.",
  "data": {
    "emergencyStatus": "emergency_granted",
    "auditTrackingId": "aud_emg_883921",
    "expiresAt": "2026-11-16T23:37:00Z",
    "reviewMandatoryBefore": "2026-11-17T23:37:00Z",
    "criticalSummary": {
      "bloodGroup": "O+",
      "criticalAllergies": [
        { "allergen": "Penicillin", "severity": "severe", "reaction": "Bronchospasm & Angioedema" }
      ],
      "activeConditions": [
        { "conditionName": "Asthma", "status": "active" }
      ]
    }
  }
}
```

---

## 10. Audit Logging & Clinical Corrections (`/audit` & `/corrections`)

### 10.1 View Audit Logs
`GET /api/v1/audit/logs?limit=50`

Returns immutable audit events of who accessed or modified patient data.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "aud_01",
      "actorId": "usr_doc_01",
      "who": "Dr. Rohan Kulkarni",
      "actorRole": "Practitioner",
      "action": "view",
      "what": "viewed conditions and medicines",
      "resourceKinds": ["condition", "medication"],
      "occurredAt": "2026-11-16T10:42:00Z",
      "outcome": "success"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

---

### 10.2 Request Clinical Correction
`POST /api/v1/corrections`

Patients request corrections to erroneous entries made by clinicians.

#### Request Body
```json
{
  "recordId": "rec_08",
  "recordTitle": "Asthma",
  "reason": "Date of onset was recorded as 2022, but symptoms first appeared in 2020.",
  "proposedCorrection": {
    "onsetDate": "2020-10-09"
  }
}
```

#### Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Correction request submitted for clinical review.",
  "data": {
    "id": "corr_40291",
    "recordId": "rec_08",
    "recordTitle": "Asthma",
    "correctionStatus": "under_review",
    "createdAt": "2026-11-16T22:38:00Z"
  }
}
```

---

### 10.3 List and Review Corrections
- `GET /api/v1/corrections`: Lists patient's submitted correction requests.
- `GET /api/v1/corrections/{id}`: Details of a correction request.
- `PATCH /api/v1/corrections/{id}`: Doctor approves/rejects the correction request.
- `DELETE /api/v1/corrections/{id}`: Patient withdraws their correction request.

---

## 11. Administrator Portal & Verifications (`/admin`)

Authorized hospital and government administrators use these endpoints to review patient onboarding, audit emergency accesses, and inspect high-level healthcare metrics.

### 11.1 List Pending Patient Verifications
`GET /api/v1/admin/verifications`

Lists patient registrations awaiting identity verification. Supports query searching by full name, mobile number, or Aadhaar number.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "userId": "usr_8f3a921b-640a-49c1-8d20-410a72ce1234",
      "fullName": "Ananya Rao",
      "dateOfBirth": "1994-05-12",
      "phone": "+919876543210",
      "aadhaarMasked": "XXXX-XXXX-8921",
      "accountStatus": "pending_admin_approval",
      "phoneVerified": true,
      "adminVerified": false,
      "registeredAt": "2026-11-16T22:30:00Z"
    }
  ],
  "meta": {
    "requestId": "req_01J0A1B2C8",
    "serverTime": "2026-11-16T22:40:00Z",
    "total": 1
  }
}
```

### 11.2 Get Verification Detail
`GET /api/v1/admin/verifications/{user_id}`

Retrieves complete submitted identity and emergency contact details for review.

### 11.3 Approve Patient Verification
`POST /api/v1/admin/verifications/{user_id}/approve`

Approves the patient registration, sets `admin_verified = true`, dispatches the 12-digit Mediclaim ID via simulated SMS/email notification, and records an immutable audit log entry.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Patient verification approved. Mediclaim ID dispatched to user.",
  "data": {
    "userId": "usr_8f3a921b-640a-49c1-8d20-410a72ce1234",
    "fullName": "Ananya Rao",
    "phone": "+919876543210",
    "mediclaimId": "9481 2049 3817",
    "adminVerified": true,
    "notificationSent": true
  }
}
```

### 11.4 Reject Patient Verification
`POST /api/v1/admin/verifications/{user_id}/reject`

Rejects a fraudulent or mismatched registration, deactivating the account and logging the reason.

#### Request Body
```json
{
  "reason": "Aadhaar demographic mismatch with official registry."
}
```

### 11.5 Administrator System Statistics
`GET /api/v1/admin/stats`

Returns aggregated healthcare network metrics.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "totalPatients": 1420,
    "pendingVerifications": 18,
    "approvedPatients": 1402,
    "totalPractitioners": 84,
    "totalHealthcareOrganizations": 6,
    "emergencyBreakGlassEvents": 12,
    "totalClinicalRecords": 9520
  },
  "meta": {
    "requestId": "req_01J0A1B2C9",
    "serverTime": "2026-11-16T22:42:00Z"
  }
}
```

### 11.6 Patient Directory & Global Emergency Audits
- `GET /api/v1/admin/patients`: Paginated patient directory with search.
- `GET /api/v1/admin/emergency-events`: System-wide log of emergency break-glass accesses for clinical governance.

---

## 12. Doctor & Hospital Portal Access (`/doctor` & `/hospital`)

The Doctor & Hospital Portal APIs enable licensed medical practitioners and hospital administrators to manage clinical records, submit and monitor access requests, record encounters, conditions, prescriptions, diagnostic reports, and immunizations under active patient consent, and manage healthcare organizations and practitioner affiliations.

### Doctor Portal Endpoints (`/api/v1/doctor`)

All endpoints in this group require authentication with the `doctor` or `practitioner` role (or `admin`).

#### 1. List Authorized Patients
- **Method / Path**: `GET /api/v1/doctor/patients`
- **Description**: Returns all patients who currently have an active, non-expired access grant permitted to this practitioner.
- **Success Status**: `200 OK`
- **Response**:
```json
{
  "status": "success",
  "data": [
    {
      "patientProfileId": "pat_8c9aeeae-...",
      "mediclaimId": "1234 5678 9012",
      "fullName": "Rohan Das",
      "gender": "male",
      "dateOfBirth": "1991-07-14",
      "bloodGroup": "O+",
      "grantId": "grt_e5f6a1b2-...",
      "approvedScopes": ["condition", "medication"],
      "expiresAt": "2026-11-17T08:00:00Z"
    }
  ],
  "meta": { "requestId": "req_01J0A1B2C8", "serverTime": "2026-11-17T00:30:00Z", "total": 1 }
}
```

#### 2. Get Authorized Patient Summary
- **Method / Path**: `GET /api/v1/doctor/patients/{mediclaim_id}`
- **Description**: Retrieves demographic summary for an authorized patient. Requires active consent grant.
- **Success Status**: `200 OK`

#### 3. Get Patient Clinical Records (Scoped)
- **Method / Path**: `GET /api/v1/doctor/patients/{mediclaim_id}/records?kind={kind}`
- **Description**: Retrieves clinical records filtered strictly by the patient's approved scopes. Querying an unapproved scope returns `403 SCOPE_UNAUTHORIZED`.
- **Success Status**: `200 OK`

#### 4. Submit Access Request
- **Method / Path**: `POST /api/v1/doctor/requests`
- **Description**: Submits an access request to a patient by 12-digit Mediclaim ID.
- **Success Status**: `202 Accepted`
- **Request Body**:
```json
{
  "patientMediclaimId": "1234 5678 9012",
  "scope": ["condition", "medication"],
  "durationHours": 8,
  "purpose": "Cardiology consultation and prescription review."
}
```

#### 5. List Doctor's Access Requests
- **Method / Path**: `GET /api/v1/doctor/requests?status={all|pending|active|revoked}`
- **Description**: Queries access requests initiated by this doctor.
- **Success Status**: `200 OK`

#### 6. Record Clinical Encounter
- **Method / Path**: `POST /api/v1/doctor/patients/{mediclaim_id}/encounters`
- **Description**: Records consultation note/encounter with patient.
- **Success Status**: `201 Created`
- **Request Body**:
```json
{
  "encounterType": "outpatient",
  "reason": "Routine hypertensive follow-up consultation",
  "diagnosisSummary": "Controlled Essential Hypertension",
  "startTime": "2026-11-17T10:00:00Z",
  "endTime": "2026-11-17T10:30:00Z",
  "status": "completed"
}
```

#### 7. Diagnose Condition (Scoped)
- **Method / Path**: `POST /api/v1/doctor/patients/{mediclaim_id}/conditions`
- **Description**: Records a diagnosed medical condition. Requires `'condition'` in approved scope.
- **Success Status**: `201 Created`

#### 8. Issue Prescription (Scoped)
- **Method / Path**: `POST /api/v1/doctor/patients/{mediclaim_id}/prescriptions`
- **Description**: Issues official prescription with items, dosages, and schedules. Requires `'medication'` in approved scope.
- **Success Status**: `201 Created`

#### 9. Order Diagnostic Report (Scoped)
- **Method / Path**: `POST /api/v1/doctor/patients/{mediclaim_id}/reports`
- **Description**: Records diagnostic test report. Requires `'report'` in approved scope.
- **Success Status**: `201 Created`

#### 10. Record Vaccination (Scoped)
- **Method / Path**: `POST /api/v1/doctor/patients/{mediclaim_id}/vaccinations`
- **Description**: Records administered immunization. Requires `'vaccination'` in approved scope.
- **Success Status**: `201 Created`

---

### Hospital & Organization Management Endpoints (`/api/v1/hospital`)

Endpoints for managing medical facilities, clinics, and affiliated medical personnel.

#### 1. List Healthcare Organizations
- **Method / Path**: `GET /api/v1/hospital/organizations?q={name}&page=1&limit=20`
- **Description**: Paginated list of registered healthcare organizations with affiliated doctor counts.
- **Success Status**: `200 OK`

#### 2. Register Healthcare Organization
- **Method / Path**: `POST /api/v1/hospital/organizations`
- **Description**: Registers a hospital, clinic, pharmacy, or diagnostic lab. Requires `admin` or `hospital_admin`.
- **Success Status**: `201 Created`
- **Request Body**:
```json
{
  "name": "Apex Super Specialty Hospital",
  "organizationType": "hospital",
  "registrationNumber": "HOSP-REG-489201",
  "address": "Sector 62, Noida, Uttar Pradesh",
  "phone": "+911204000100",
  "email": "contact@apexhospital.in"
}
```

#### 3. Get Organization Profile
- **Method / Path**: `GET /api/v1/hospital/organizations/{org_id}`
- **Description**: Organization details and list of affiliated practitioners.
- **Success Status**: `200 OK`

#### 4. List Practitioners
- **Method / Path**: `GET /api/v1/hospital/practitioners?organizationId={id}&specialization={spec}&q={query}`
- **Description**: Paginated list of registered doctors with specialty and hospital affiliation.
- **Success Status**: `200 OK`

#### 5. Onboard Practitioner
- **Method / Path**: `POST /api/v1/hospital/practitioners`
- **Description**: Registers a new practitioner with medical council registration number and creates their doctor account. Requires `admin` or `hospital_admin`.
- **Success Status**: `201 Created`
- **Request Body**:
```json
{
  "fullName": "Dr. Maya Sen",
  "phone": "+919500011122",
  "email": "maya@apexhospital.in",
  "password": "SecurePassword123!",
  "registrationNumber": "MCI-789456",
  "specialization": "Neurology",
  "qualification": "MBBS, DM Neurology",
  "organizationId": "org_...",
  "designation": "Senior Neurologist"
}
```

#### 6. Get Practitioner Profile
- **Method / Path**: `GET /api/v1/hospital/practitioners/{practitioner_id}`
- **Description**: Retrieves full credentials, registration number, and hospital memberships.
- **Success Status**: `200 OK`

---

## 13. Standard Error Responses & Status Codes

All error responses adhere to **RFC 9457 / RFC 7807** Problem Details served as `application/problem+json`:

```json
{
  "type": "https://api.mediclaim.gov.in/problems/consent-expired",
  "title": "Consent Expired",
  "status": 403,
  "detail": "The doctor access session has expired. Request fresh authorization.",
  "instance": "/api/v1/records",
  "code": "CONSENT_EXPIRED",
  "requestId": "req_01J0A1B2C7",
  "errors": []
}
```

### Standard Error Codes & HTTP Status:
| HTTP Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `BAD_REQUEST` | Malformed syntax or missing required parameters |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Invalid or missing token, wrong password, or expired signature |
| `403 Forbidden` | `SCOPE_UNAUTHORIZED` | Attempted access to clinical record outside approved consent scope |
| `403 Forbidden` | `CONSENT_EXPIRED` | Time-bound doctor grant duration has elapsed |
| `403 Forbidden` | `CONSENT_REVOKED` | Grant was explicitly revoked by the patient |
| `403 Forbidden` | `PROFILE_INCOMPLETE` | Patient must complete mandatory profile before accessing clinical data |
| `404 Not Found` | `RECORD_NOT_FOUND` | Clinical record, document, or patient ID does not exist |
| `409 Conflict` | `ACCOUNT_ALREADY_EXISTS` | Phone number or Aadhaar already registered |
| `413 Payload Too Large` | `FILE_TOO_LARGE` | Document file exceeds maximum 10 MB limit |
| `415 Unsupported Media` | `UNSUPPORTED_MEDIA_TYPE`| File format not permitted (must be PDF, PNG, or JPEG) |
| `422 Unprocessable` | `VALIDATION_ERROR` | Request body validation failure (e.g. invalid date or phone format) |
| `429 Too Many Requests` | `RATE_LIMIT_EXCEEDED` | Too many OTP or login attempts; back-off required |
| `500 Server Error` | `INTERNAL_SERVER_ERROR` | An unexpected server error occurred |
