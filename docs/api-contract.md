# Mediclaim Backend API Contract & Specification

**Base URL**: `http://localhost:8000/api/v1`  
**Healthcare Standard**: HL7 FHIR R4  
**Authentication**: Bearer JWT (`Authorization: Bearer <token>`)  
**Data Encryption**: Envelope encryption (AES-256-GCM per-patient data keys)

---

## Table of Contents
1. [Overview & Security Architecture](#1-overview--security-architecture)
2. [Authentication & Onboarding (`/auth`)](#2-authentication--onboarding-auth)
3. [Patient Profile Management (`/patients`)](#3-patient-profile-management-patients)
4. [Clinical Records & FHIR Resources (`/records`)](#4-clinical-records--fhir-resources-records)
5. [Document Ingestion & File Uploads (`/uploads`)](#5-document-ingestion--file-uploads-uploads)
6. [Lifelong Timeline & Health Graph (`/timeline`)](#6-lifelong-timeline--health-graph-timeline)
7. [Doctor Consent & Access Control (`/consent`)](#7-doctor-consent--access-control-consent)
8. [Emergency Break-Glass Access (`/emergency`)](#8-emergency-break-glass-access-emergency)
9. [Audit Logging & Corrections (`/audit` & `/corrections`)](#9-audit-logging--corrections-audit--corrections)
10. [Standard Error Responses](#10-standard-error-responses)

---

## 1. Overview & Security Architecture

### Core Principles
- **Unique Identification**: Patients authenticate with their 12-digit Mediclaim ID (linked to verified Aadhaar number).
- **Time-Bounded Doctor Access**: Doctor tokens carry an explicit `exp` claim matching patient consent duration (e.g., 2 hours). Tokens expire automatically.
- **Scoped Consent**: Doctor sessions are restricted to approved scopes (`allergy`, `medication`, `condition`, `vaccination`, `report`). Unauthorized scopes return `403 Forbidden`.
- **Break-Glass Emergency Protocol**: Authorized emergency hospitals can bypass standard consent using audited break-glass procedures with mandatory post-incident review.
- **Envelope Encryption**: Clinical records and documents are encrypted with unique per-patient data keys (DEK) wrapped by a Key Management Service (KMS).

---

## 2. Authentication & Onboarding (`/auth`)

### 2.1 Register New Account
`POST /api/v1/auth/register`

Registers a patient using Aadhaar verification and issues a permanent 12-digit Mediclaim ID.

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
    "userId": "usr-8f3a921b-640a-49c1-8d20-410a72ce1234",
    "phone": "+919876543210",
    "adminVerified": false,
    "otpSent": true,
    "otpExpiresInSeconds": 300
  }
}
```

---

### 2.2 Verify Aadhaar / Phone OTP
`POST /api/v1/auth/verify-otp`

#### Request Body
```json
{
  "userId": "usr-8f3a921b-640a-49c1-8d20-410a72ce1234",
  "otp": "492018"
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {
    "id": "usr-8f3a921b-640a-49c1-8d20-410a72ce1234",
    "fullName": "Ananya Rao",
    "role": "patient",
    "adminVerified": false,
    "isProfileComplete": false
  }
}
```

---

### 2.3 Sign In
`POST /api/v1/auth/login`

Supports authentication via Mediclaim ID + Password or SMS OTP.

#### Request Body
```json
{
  "mediclaimId": "4821 9306 1175",
  "password": "SecurePassword123!"
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {
    "id": "usr-8f3a921b-640a-49c1-8d20-410a72ce1234",
    "fullName": "Ananya Rao",
    "role": "patient",
    "mediclaimId": "4821 9306 1175",
    "isProfileComplete": true
  }
}
```

---

## 3. Patient Profile Management (`/patients`)

### 3.1 Get Current Patient Profile
`GET /api/v1/patients/me`

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": "pat-001",
    "userId": "usr-8f3a921b-640a-49c1-8d20-410a72ce1234",
    "mediclaimId": "4821 9306 1175",
    "aadhaarMasked": "XXXX-XXXX-1175",
    "fullName": "Ananya Rao",
    "firstName": "Ananya",
    "dateOfBirth": "1994-05-12",
    "gender": "Female",
    "bloodGroup": "O+",
    "phone": "+91 98765 43210",
    "address": "Flat 402, Sea View Apartments, Shivaji Park, Mumbai, Maharashtra – 400028",
    "emergencyContact": {
      "name": "Lakshmi Rao",
      "phone": "+91 98765 12345",
      "relation": "Mother"
    },
    "isProfileComplete": true,
    "createdAt": "2024-01-10T08:00:00Z",
    "updatedAt": "2026-09-02T10:30:00Z"
  }
}
```

---

### 3.2 Complete Profile (Mandatory on First Visit)
`POST /api/v1/patients/me/complete-profile`

Called when a user lands on the dashboard for the first time.

#### Request Body
```json
{
  "gender": "Female",
  "bloodGroup": "O+",
  "address": "Flat 402, Sea View Apartments, Shivaji Park, Mumbai – 400028",
  "emergencyName": "Lakshmi Rao",
  "emergencyPhone": "+91 98765 12345",
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
    "updatedAt": "2026-11-11T23:00:00Z"
  }
}
```

---

### 3.3 Update Permitted Personal Details
`PATCH /api/v1/patients/me/permitted-details`

Allows patients to edit permitted personal details (phone, address, emergency contact) without altering clinical history.

#### Request Body
```json
{
  "phone": "+91 98765 99999",
  "address": "Bungalow 12, Koregaon Park, Pune – 411001",
  "emergencyContact": {
    "name": "Lakshmi Rao",
    "phone": "+91 98765 88888",
    "relation": "Mother"
  }
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Permitted details updated.",
  "data": {
    "phone": "+91 98765 99999",
    "address": "Bungalow 12, Koregaon Park, Pune – 411001",
    "emergencyContact": {
      "name": "Lakshmi Rao",
      "phone": "+91 98765 88888",
      "relation": "Mother"
    },
    "updatedAt": "2026-11-11T23:10:00Z"
  }
}
```

---

## 4. Clinical Records & FHIR Resources (`/records`)

### 4.1 Get All Records (Aggregated)
`GET /api/v1/records?kind=medication&status=active`

**Query Parameters**:
- `kind`: `allergy` | `condition` | `medication` | `vaccination` | `report`
- `status`: `active` | `resolved` | `completed`
- `from`: `YYYY-MM-DD`
- `to`: `YYYY-MM-DD`

#### Response (`200 OK`)
```json
{
  "status": "success",
  "total": 2,
  "data": [
    {
      "id": "e05",
      "kind": "medication",
      "title": "Budesonide inhaler",
      "detail": "200 mcg, twice daily. Preventer for asthma.",
      "date": "2024-01-15",
      "provider": "Dr. Rohan Kulkarni, Lifeline Clinic",
      "status": "active",
      "fhirResource": {
        "resourceType": "MedicationStatement",
        "id": "med-stmt-05",
        "status": "active",
        "medicationCodeableConcept": {
          "coding": [{ "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "19839", "display": "Budesonide" }]
        }
      }
    }
  ]
}
```

---

### 4.2 Record an Allergy
`POST /api/v1/records/allergies`

Maps to FHIR `AllergyIntolerance` resource.

#### Request Body
```json
{
  "allergen": "Penicillin",
  "category": "medication",
  "severity": "severe",
  "criticality": "high",
  "reaction": "Skin rash, hives, and bronchospasm",
  "status": "active",
  "identifiedDate": "2003-08-21",
  "provider": "Dr. S. Nair, Family Clinic",
  "notes": "Strictly avoid penicillin and beta-lactam antibiotics."
}
```

#### Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Allergy recorded.",
  "data": {
    "id": "alg-001",
    "kind": "allergy",
    "title": "Penicillin",
    "category": "medication",
    "severity": "severe",
    "criticality": "high",
    "reaction": "Skin rash, hives, and bronchospasm",
    "status": "active",
    "identifiedDate": "2003-08-21",
    "provider": "Dr. S. Nair, Family Clinic",
    "fhirId": "AllergyIntolerance/ai-001"
  }
}
```

---

### 4.3 Get Saved Prescriptions (Time-Ordered)
`GET /api/v1/records/prescriptions`

Returns saved medical prescriptions ordered chronologically (newest first).

#### Response (`200 OK`)
```json
{
  "status": "success",
  "total": 2,
  "data": [
    {
      "id": "rx-01",
      "title": "Asthma Maintenance Prescription",
      "doctor": "Dr. Rohan Kulkarni",
      "organization": "Lifeline Pulmonology Clinic",
      "date": "2026-08-14",
      "status": "active",
      "fileType": "pdf",
      "fileName": "prescription_kulkarni_aug2026.pdf",
      "fileSize": "412 KB",
      "fileUrl": "https://storage.mediclaim.gov.in/prescriptions/rx-01.pdf",
      "instructions": "Take 2 puffs daily in the morning.",
      "medications": [
        { "name": "Budesonide Inhaler", "dosage": "200 mcg", "frequency": "Twice daily", "duration": "90 days" }
      ]
    }
  ]
}
```

---

## 5. Document Ingestion & File Uploads (`/uploads`)

### 5.1 Upload Prescription (PDF / Image)
`POST /api/v1/uploads/prescriptions`  
**Content-Type**: `multipart/form-data`

#### Form Data Parameters:
- `file`: Binary file (`application/pdf`, `image/png`, `image/jpeg`)
- `title`: string (e.g., "Consultation Prescription")
- `doctor`: string (e.g., "Dr. Rohan Kulkarni")
- `consultationDate`: `YYYY-MM-DD`
- `organization`: string (optional)

#### Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Prescription uploaded, encrypted, and queued for OCR processing.",
  "data": {
    "prescriptionId": "rx-20261111-001",
    "documentId": "doc-9a8b7c-01",
    "fileName": "chest_prescription.pdf",
    "fileType": "pdf",
    "fileSizeBytes": 421890,
    "fileUrl": "https://storage.mediclaim.gov.in/prescriptions/enc_rx_001.pdf",
    "ocrStatus": "processing",
    "date": "2026-11-11",
    "doctor": "Dr. Rohan Kulkarni"
  }
}
```

---

## 6. Lifelong Timeline & Health Graph (`/timeline`)

### 6.1 Get Lifelong Medical Timeline
`GET /api/v1/timeline`

Returns the complete chronological health history from birth to death.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "patientId": "pat-001",
  "dob": "1994-05-12",
  "totalEvents": 17,
  "data": [
    {
      "id": "e01",
      "kind": "vaccination",
      "title": "Tdap booster",
      "detail": "Tetanus, diphtheria and pertussis booster. One dose.",
      "date": "2026-09-02",
      "provider": "Dr. Meera Iyer, Shivaji Park Clinic",
      "ageAtEvent": "At 32 years",
      "status": "active"
    },
    {
      "id": "e17",
      "kind": "report",
      "title": "Birth record",
      "detail": "Birth weight 3.1 kg. No complications.",
      "date": "1994-05-12",
      "provider": "Government Maternity Hospital",
      "ageAtEvent": "At birth",
      "status": "resolved"
    }
  ]
}
```

---

### 6.2 Get Health Graph Network Structure
`GET /api/v1/timeline/graph?leaves=3`

Returns nodes and edges for rendering radial/tree graph visualizations.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "center": {
      "patientName": "Ananya",
      "birthYear": "1994"
    },
    "branches": [
      {
        "kind": "allergy",
        "categoryLabel": "Allergies",
        "nodes": [
          { "id": "e11", "label": "Dust mites", "status": "active" },
          { "id": "e14", "label": "Penicillin", "status": "active" }
        ]
      },
      {
        "kind": "condition",
        "categoryLabel": "Conditions",
        "nodes": [
          { "id": "e08", "label": "Asthma", "status": "active" },
          { "id": "e12", "label": "Appendicitis", "status": "resolved" }
        ]
      }
    ]
  }
}
```

---

## 7. Doctor Consent & Access Control (`/consent`)

### 7.1 Request Temporary Access (Doctor Initiated)
`POST /api/v1/consent/request`

#### Request Body
```json
{
  "patientMediclaimId": "4821 9306 1175",
  "doctorId": "doc-dr-kulkarni-401",
  "doctorName": "Dr. Farhan Ali",
  "role": "Dermatologist, Skin & Care Centre",
  "scope": ["allergy", "medication"],
  "durationHours": 2,
  "purpose": "Evaluation of acute allergic dermatitis"
}
```

#### Response (`202 Accepted`)
```json
{
  "status": "success",
  "requestId": "req-98210",
  "message": "Access request queued for patient authorization."
}
```

---

### 7.2 Patient Approves Request
`POST /api/v1/consent/requests/{request_id}/approve`

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
  "grantId": "g-req-98210",
  "validFrom": "2026-11-11T23:30:00Z",
  "expiresAt": "2026-11-12T01:30:00Z",
  "remaining": "2 h 0 min left",
  "status": "active"
}
```

---

### 7.3 Patient Revokes Access Immediately
`DELETE /api/v1/consent/grants/{grant_id}`

#### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Doctor access revoked immediately. Session terminated."
}
```

---

## 8. Emergency Break-Glass Access (`/emergency`)

`POST /api/v1/emergency/access`  
**Authorization**: Government & Accredited Hospital Admin Only.

Provides immediate full access during life-or-death emergencies without prior patient OTP, while creating an immutable audit trail.

#### Request Body
```json
{
  "patientMediclaimId": "4821 9306 1175",
  "hospitalId": "gov-hosp-sion-01",
  "attendingDoctorId": "doc-emergency-911",
  "emergencyType": "TRAUMA_RESUSCITATION",
  "clinicalJustification": "Patient unconscious in ER following motor vehicle collision. Immediate allergy and blood group verification required."
}
```

#### Response (`200 OK`)
```json
{
  "status": "emergency_granted",
  "auditTrackingId": "audit-emg-883921",
  "emergencyToken": "eyJhbGciOi...",
  "expiresInMinutes": 60,
  "reviewMandatoryBefore": "2026-11-12T23:30:00Z",
  "data": {
    "bloodGroup": "O+",
    "criticalAllergies": [
      { "allergen": "Penicillin", "severity": "severe", "reaction": "Bronchospasm & Angioedema" }
    ],
    "activeConditions": [
      { "conditionName": "Asthma", "status": "active" }
    ]
  }
}
```

---

## 9. Audit Logging & Corrections (`/audit` & `/corrections`)

### 9.1 View Access History
`GET /api/v1/audit/logs`

Returns a list of everyone who accessed, viewed, or uploaded records.

#### Response (`200 OK`)
```json
{
  "status": "success",
  "data": [
    {
      "id": "l1",
      "who": "Dr. Rohan Kulkarni",
      "actorRole": "Practitioner",
      "what": "viewed conditions and medicines",
      "when": "Today, 10:42",
      "action": "view"
    },
    {
      "id": "l2",
      "who": "Dr. Meera Iyer",
      "actorRole": "Practitioner",
      "what": "viewed allergies and vaccinations",
      "when": "Today, 09:15",
      "action": "view"
    }
  ]
}
```

---

### 9.2 Request a Record Correction
`POST /api/v1/corrections`

Patients can request corrections to medical records written by doctors.

#### Request Body
```json
{
  "recordId": "e08",
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
  "correctionRequestId": "corr-40291",
  "status": "under_review",
  "message": "Correction request routed to Dr. Rohan Kulkarni for clinical review."
}
```

---

## 10. Standard Error Responses

All error responses adhere to RFC 7807 (Problem Details for HTTP APIs).

```json
{
  "status": "error",
  "code": "CONSENT_EXPIRED",
  "message": "The doctor access session has expired. Request fresh authorization.",
  "details": {
    "expiredAt": "2026-11-11T21:45:00Z",
    "grantId": "g-req-98210"
  }
}
```

### Common Error Codes:
| HTTP Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Required fields missing or invalid format (e.g. invalid Aadhaar length) |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Invalid token, expired signature, or wrong password |
| `403 Forbidden` | `SCOPE_UNAUTHORIZED` | Doctor attempted to access records outside approved consent scope |
| `403 Forbidden` | `CONSENT_EXPIRED` | Time-bound consent window has ended |
| `404 Not Found` | `RECORD_NOT_FOUND` | Clinical record or document ID does not exist |
| `422 Unprocessable` | `PROFILE_INCOMPLETE` | User must complete profile before performing clinical operations |

