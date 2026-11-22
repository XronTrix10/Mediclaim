# FHIR R4 Patient Profile Specification & Mediclaim Mapping

## 1. Executive Overview

This document specifies the HL7 FHIR Release 4 (R4) conformance profile for patient demographic resources within the Mediclaim Health Information Network. It establishes canonical data representations, conformance rules, vocabulary bindings, and mapping rules between Mediclaim database schemas and international interoperability standards.

### Conformance Target
- **FHIR Resource:** `Patient`
- **FHIR Version:** R4 (v4.0.1)
- **Profile URI:** `http://mediclaim.org/fhir/StructureDefinition/mediclaim-patient-profile`
- **Base Definition:** `http://hl7.org/fhir/StructureDefinition/Patient`
- **Maturity Level:** 3 (Validated across core ingestion pipeline)

---

## 2. Demographic Elements & Ingestion Mapping

The table below delineates the structural crosswalk between PostgreSQL `patients` / `users` tables and FHIR R4 `Patient` attributes:

| Mediclaim Database Field | PostgreSQL Type | FHIR R4 Path | Conformance | Search Modifier |
|:-------------------------|:----------------|:-------------|:------------|:----------------|
| `patients.id` | `UUID` | `Patient.id` | Mandatory (`1..1`) | `exact` |
| `patients.user_id` | `UUID` | `Patient.identifier[userId]` | Mandatory (`1..1`) | `token` |
| `patients.mediclaim_id` | `VARCHAR(32)` | `Patient.identifier[mediclaimId]` | Mandatory (`1..1`) | `token` |
| `patients.full_name` | `VARCHAR(255)` | `Patient.name.text` | Mandatory (`1..1`) | `contains`, `exact` |
| `patients.gender` | `VARCHAR(16)` | `Patient.gender` | Required (`1..1`) | `token` |
| `patients.date_of_birth` | `DATE` | `Patient.birthDate` | Required (`1..1`) | `date` |
| `patients.blood_group` | `VARCHAR(8)` | `Patient.extension[bloodGroup]` | Optional (`0..1`) | `token` |
| `patients.address` | `TEXT` | `Patient.address.line[0]` | Optional (`0..1`) | `contains` |
| `patients.emergency_contact_name` | `VARCHAR(255)` | `Patient.contact.name.text` | Optional (`0..1`) | `contains` |
| `patients.emergency_contact_phone` | `VARCHAR(32)` | `Patient.contact.telecom.value` | Optional (`0..1`) | `exact` |
| `patients.emergency_contact_relation`| `VARCHAR(64)` | `Patient.contact.relationship.coding` | Optional (`0..1`) | `token` |
| `users.email` | `VARCHAR(255)` | `Patient.telecom[system=email]` | Required (`1..1`) | `token`, `exact` |
| `users.phone` | `VARCHAR(32)` | `Patient.telecom[system=phone]` | Mandatory (`1..1`) | `token`, `exact` |

---

## 3. Identifier System Taxonomy

Mediclaim enforces distinct namespace identifiers to avoid collision with federated health registries:

```yaml
identifier_namespaces:
  mediclaim_system:
    system_uri: "http://mediclaim.org/identifiers/patient-id"
    description: "Unique 10-character alphanumeric assigned at registration"
    regex_format: "^MED-[A-Z0-9]{7}$"
    issuing_authority: "Mediclaim Credential Authority"
  abha_system:
    system_uri: "http://abdm.gov.in/identifiers/abha-number"
    description: "Ayushman Bharat Health Account 14-digit identifier"
    regex_format: "^[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4}$"
    issuing_authority: "National Health Authority (NHA)"
  aadhaar_token_system:
    system_uri: "http://uidai.gov.in/identifiers/masked-token"
    description: "SHA-256 zero-knowledge proof hash of Aadhaar reference"
    regex_format: "^[a-f0-9]{64}$"
    issuing_authority: "UIDAI eKYC Gateway"
```

---

## 4. Emergency Contact Modeling & Relationship Codes

Emergency contact records must adhere to HL7 v3 `PersonalRelationshipRoleType` vocabulary:

| Relation Code | Display Term | Definition | Required Notification Protocols |
|:--------------|:-------------|:-----------|:--------------------------------|
| `SPS` | Spouse | Legal partner / marital spouse | Tier 1 Automated SMS & Push |
| `PRN` | Parent | Biological or legal adoptive parent | Tier 1 Automated SMS & Push |
| `SIB` | Sibling | Brother or sister | Tier 2 Secondary Notification |
| `CHD` | Child | Offspring of legal adult age | Tier 1 Automated SMS & Push |
| `GRD` | Guardian | Court-appointed legal guardian | Tier 1 Priority Legal Dispatch |
| `FRND` | Friend | Non-relative personal contact | Tier 3 Fallback Escalation |

---

## 5. FHIR JSON Schema Representation

Below is the canonical JSON representation for an ingested patient payload:

```json
{
  "resourceType": "Patient",
  "id": "7f8b91a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2026-11-20T10:15:30Z",
    "profile": [
      "http://mediclaim.org/fhir/StructureDefinition/mediclaim-patient-profile"
    ]
  },
  "identifier": [
    {
      "use": "official",
      "system": "http://mediclaim.org/identifiers/patient-id",
      "value": "MED-7849201"
    },
    {
      "use": "secondary",
      "system": "http://abdm.gov.in/identifiers/abha-number",
      "value": "91-4458-1209-8831"
    }
  ],
  "active": true,
  "name": [
    {
      "use": "official",
      "family": "Sharma",
      "given": ["Rahul", "Kumar"],
      "text": "Rahul Kumar Sharma"
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "+919876543210",
      "use": "mobile"
    },
    {
      "system": "email",
      "value": "rahul.sharma@example.com",
      "use": "home"
    }
  ],
  "gender": "male",
  "birthDate": "1988-06-14",
  "address": [
    {
      "use": "home",
      "type": "physical",
      "line": ["Flat 402, Green Meadows, Sector 14"],
      "city": "Gurugram",
      "state": "Haryana",
      "postalCode": "122001",
      "country": "IND"
    }
  ],
  "contact": [
    {
      "relationship": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              "code": "SPS",
              "display": "Spouse"
            }
          ]
        }
      ],
      "name": {
        "text": "Pooja Sharma"
      },
      "telecom": [
        {
          "system": "phone",
          "value": "+919876543211",
          "use": "mobile"
        }
      ]
    }
  ]
}
```

---

## 6. Audit Trail & Data Validation Constraints

1. **Unique Identity Verification:** The `mediclaim_id` must pass Luhn-variant checksum validation before database persistence.
2. **Date of Birth Range:** Must be greater than `1900-01-01` and less than or equal to current UTC date.
3. **Address Sanitization:** All address strings are normalized using NFKC Unicode normalization and scrubbed of SQL meta-characters.
4. **Encryption at Rest:** Sensitive identifiers (`aadhaar_token`, phone number hashes) are encrypted with AES-256-GCM.
5. **Replication Safety:** Profile schemas maintain backward compatibility across minor FHIR version revisions.
