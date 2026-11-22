# Compliance: Health Privacy & Regulatory Safeguards

## 1. Compliance Architecture Overview
Mediclaim is architected to conform to global and national regulatory standards for Protected Health Information (PHI) and Sensitive Personal Data (SPD), specifically:
- **HIPAA** (Health Insurance Portability and Accountability Act - Privacy & Security Rules)
- **GDPR** (General Data Protection Regulation - Articles 9 & 17)
- **ABDM / NDHM** (Ayushman Bharat Digital Mission Health Data Management Policy)

```
+-----------------------------------------------------------------------------+
|                      COMPLIANCE GOVERNANCE PILLARS                          |
+----------------------+------------------------------------------------------+
| Pillar               | Technical Implementation                             |
+----------------------+------------------------------------------------------+
| Patient Consent      | Dynamic granular scopes, time-bound TTL grants       |
| Data Minimization    | Scoped query filters, birth certificate isolation    |
| Right to Portability | Tabular PDF health history and JSON export           |
| Right to Erasure     | Hard delete cascade for DB rows and storage files    |
| Non-Repudiation      | Immutable audit trail with actor role logging        |
| Storage Safeguards   | Encrypted volumes, isolated docker bridges           |
+----------------------+------------------------------------------------------+
```

## 2. Right to Erasure & Data Deletion
Under GDPR Article 17 ("Right to be Forgotten") and ABDM data sovereignty clauses, patient data must be permanently purgeable upon verified request:
1. **Database Purge**: Administrative patient removal triggers relational cascade deletion across all associated clinical tables, prescriptions, documents, and access grants.
2. **Physical Storage Purge**: The file storage service identifies all files residing under `/data/uploads/documents/<patient_id>/` and permanently deletes the directory tree from disk, preventing remnant orphaned records.
3. **Audit Retainment**: To satisfy legal and medical malpractice statutory requirements, an anonymized administrative deletion audit event is recorded.

## 3. Data Portability (Article 20)
Patients have the fundamental right to export their complete health record in standard formats:
- **Human-Readable**: Formatted A4 PDF document containing patient demographics, summary metrics, and a chronological tabular breakdown of all clinical encounters, medications, allergies, and diagnoses.
- **Machine-Readable**: HL7 FHIR R4 JSON bundle suitable for ingestion by external electronic medical record (EMR) systems.

## 4. Minimum Necessary Standard (HIPAA 45 CFR 164.502(b))
Healthcare providers only receive access to the specific categories of data necessary for the clinical encounter:
- Doctors requesting access to "Medications" receive zero access to diagnostic reports or uploaded documents unless explicitly requested and approved.
- Document scope approval explicitly excludes birth identity documents to safeguard against identity theft and unauthorized disclosure.
