# HL7 Clinical Document Architecture (CDA) & CCD Template Specifications

## 1. Executive Summary

The HL7 Clinical Document Architecture Release 2 (CDA R2) defines the document markup standard for exchanging clinical documents (Discharge Summaries, Referral Letters, Diagnostic Imaging Reports). This document specifies header metadata, body section XML and JSON schema representations, and validation rules.

---

## 2. CDA Header Structural Model

Every CDA document contains a mandatory header establishing provenance and legal validity:

```
ClinicalDocument (Header)
├── id (Document UUID)
├── code (LOINC Document Type Code)
├── title (Document Title)
├── effectiveTime (Document Creation Timestamp)
├── confidentialityCode (Confidentiality Level)
├── recordTarget (Patient Demographics)
├── author (Clinician / Medical Device)
├── custodian (Hospital / Organization Entity)
└── legalAuthenticator (Physician Signature & Timestamp)
```

---

## 3. Standard LOINC Document Type Codes

| LOINC Code | Document Type Description | Conformance Tier | Mandatory Sections |
|:-----------|:--------------------------|:-----------------|:-------------------|
| `18842-5` | Discharge Summary | Core Tier 1 | Hospital Course, Discharge Medications, Follow-up |
| `34117-2` | History and Physical (H&P) Note | Core Tier 1 | Chief Complaint, HPI, Physical Exam, Assessment |
| `11488-4` | Consultation Note | Core Tier 1 | Reason for Consult, Specialist Assessment, Plan |
| `11506-3` | Provider-Unspecified Progress Note | Core Tier 2 | Subjective, Objective, Assessment, Plan (SOAP) |
| `28570-0` | Procedure / Operative Note | Core Tier 1 | Pre/Post-Op Diagnosis, Findings, Complications |

---

## 4. Structured Body Section Specifications

### Discharge Summary Template Sections

| Section Code | Section Title | Standard Template ID | Required Structured Entries |
|:-------------|:--------------|:---------------------|:----------------------------|
| `10154-3` | Chief Complaint & HPI | `2.16.840.1.113883.10.20.22.2.22` | Clinical statements |
| `8648-8` | Hospital Course | `2.16.840.1.113883.10.20.22.2.83` | Narrative + Timeline |
| `10183-2` | Discharge Diagnosis | `2.16.840.1.113883.10.20.22.4.33` | ICD-10 Problems |
| `10184-0` | Discharge Medications | `2.16.840.1.113883.10.20.22.4.35` | RxNorm Medication entries |
| `30954-2` | Relevant Diagnostic Tests | `2.16.840.1.113883.10.20.22.4.2` | LOINC Observation results |
| `11450-4` | Problem List | `2.16.840.1.113883.10.20.22.4.4` | SNOMED CT Findings |

---

## 5. Ingestion JSON Representation

For lightweight REST APIs, Mediclaim parses CDA XML into structured JSON:

```json
{
  "document_id": "cda-doc-78192-x",
  "document_type": {
    "loinc": "18842-5",
    "display": "Hospital Discharge Summary"
  },
  "patient_id": "7f8b91a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
  "custodian": {
    "hospital_name": "Metro General Hospital",
    "facility_id": "HOSP-IND-4091"
  },
  "legal_authenticator": {
    "name": "Dr. Siddhartha Mukherjee, MD",
    "signature_timestamp": "2026-11-20T14:30:00Z",
    "status": "digitally_signed"
  },
  "sections": [
    {
      "section_code": "10183-2",
      "title": "Discharge Diagnosis",
      "text": "1. Acute exacerbation of COPD. 2. Secondary hypertension.",
      "coded_entries": [
        {"system": "ICD-10", "code": "J44.1", "display": "COPD with acute exacerbation"},
        {"system": "ICD-10", "code": "I10", "display": "Essential hypertension"}
      ]
    }
  ]
}
```

---

## 6. Digital Signature & Provenance Verification

- All CDA documents ingested into Mediclaim must carry a valid SHA-256 digital signature from the certified authoring hospital.
- Modifications to finalized documents create a new document revision referencing the parent document UUID via `relatedDocument` tags.
