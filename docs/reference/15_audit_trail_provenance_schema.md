# ATNA Audit Trail Provenance Schema & Tamper-Evident Architecture

## 1. Overview & Conformance Standards

Healthcare information systems require exhaustive, tamper-evident audit trails to comply with IHE Audit Trail and Node Authentication (ATNA) profile, HIPAA § 164.312(b), and ISO 27799. This document outlines event schemas, hashing algorithms, and provenance models.

---

## 2. Audit Event Classification

| Event ID | Event Name | Severity | Description | Trigger Location |
|:---------|:-----------|:---------|:------------|:-----------------|
| `AUTH_LOGIN_SUCCESS` | Successful Authentication | Info | User signed in with password/MFA | `auth_service.py` |
| `AUTH_LOGIN_FAILED` | Failed Authentication | Warning | Incorrect password or invalid token | `auth_service.py` |
| `RECORD_VIEW` | Patient Record Inspected | Info | Doctor/Patient opened record details | `records_service.py`|
| `RECORD_EXPORT` | Bulk Records Downloaded | Warning | PDF / CSV clinical history export | `reports_service.py`|
| `RECORD_MODIFY` | Clinical Record Updated | Warning | Diagnosis / note amendment | `records_service.py`|
| `BREAK_GLASS_ACCESS`| Emergency Override Invoked | Critical | Doctor invoked emergency privilege | `access_service.py` |
| `CONSENT_REVOKE` | Consent Revocation | Warning | Patient terminated doctor access | `consent_service.py`|
| `OCR_INGESTION` | Document OCR Processed | Info | Scanned report parsed into DB | `ocr_worker.py` |

---

## 3. Provenance Data Model & ATNA Schema

```sql
-- Canonical Audit Event Table
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    actor_id UUID NULL REFERENCES users(id),
    actor_role VARCHAR(32) NOT NULL,
    actor_ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,
    patient_id UUID NULL REFERENCES patients(id),
    resource_type VARCHAR(64) NOT NULL,
    resource_id UUID NULL,
    action_taken VARCHAR(16) NOT NULL CHECK (action_taken IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXECUTE')),
    status_code INTEGER NOT NULL DEFAULT 200,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    prev_event_hash VARCHAR(64) NULL,
    event_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_events_patient_created
    ON audit_events(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created
    ON audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type
    ON audit_events(event_type);
```

---

## 4. Cryptographic Chaining & Tamper Detection

Mediclaim implements cryptographic hash chaining (Merkle sequence) to guarantee log immutability:

```python
import hashlib
import json

def calculate_event_hash(prev_hash: str, event_data: dict) -> str:
    canonical_repr = f"{prev_hash}|{event_data['event_type']}|{event_data['actor_id']}|{event_data['created_at']}|{json.dumps(event_data['metadata'], sort_keys=True)}"
    return hashlib.sha256(canonical_repr.encode('utf-8')).hexdigest()
```

If any historical record is modified or deleted directly in PostgreSQL, the forward chain validation fails immediately, triggering a system security alert.

---

## 5. Retention Policies & Cold Storage Archival

- **Hot Storage (PostgreSQL):** 90 days of immediate indexed search availability.
- **Warm Storage (Partitioned Tables):** 365 days of partitioned table accessibility.
- **Cold Storage (Encrypted Cloud Object Storage):** 7 years mandatory retention conforming to statutory medical record preservation acts.
- **Destruction Protocol:** Cryptographic erasure (KMS key destruction) upon expiration of legal retention holding periods.
