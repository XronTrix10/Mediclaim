# Consent Directive Specifications & Granular Access Policies

## 1. Overview & Conceptual Architecture

Patient autonomy is central to modern health information systems. Mediclaim implements granular consent directives based on the HL7 FHIR `Consent` resource, permitting patients to selectively authorize or restrict clinical data categories, specific healthcare practitioners, or organizational boundaries.

---

## 2. Granular Data Classifications

| Scope Category | Description | Sensitivity Tier | Default State | Opt-Out Required |
|:---------------|:------------|:-----------------|:--------------|:-----------------|
| `DEMOGRAPHICS` | Name, age, address, emergency contact | Baseline | Granted | No |
| `GENERAL_CLINICAL` | Vital signs, routine physical exams | Standard | Granted to Attending | No |
| `LAB_RESULTS` | Blood tests, pathology reports | Standard | Granted to Attending | No |
| `PRESCRIPTIONS` | Active and historical medications | High | Granted to Attending | No |
| `PSYCHIATRIC_NOTES`| Mental health evaluations, therapy notes | Protected | Restricted | Explicit Opt-In Required |
| `GENOMICS` | DNA sequencing, genetic predisposition | Protected | Restricted | Explicit Opt-In Required |
| `INFECTIOUS_DISEASE`| HIV, Hepatitis C, STI records | Protected | Restricted | Explicit Opt-In Required |

---

## 3. Consent State Transition Engine

```
[Draft]
  │
  ├──> [Active] ──> [Revoked]
  │       │
  │       └──> [Expired]
  │
  └──> [Rejected]
```

### Transition Invariants
- `Draft` -> `Active`: Requires cryptographic patient signature or verified OTP confirmation.
- `Active` -> `Revoked`: Can be executed by patient at any millisecond; takes effect immediately for future read requests.
- `Active` -> `Expired`: Triggered automatically by scheduled cron upon passing `consent.period.end`.

---

## 4. Consent Grant Database Schema

```sql
-- Architectural Reference for Patient Access Grants
CREATE TABLE IF NOT EXISTS patient_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    grantee_type VARCHAR(32) NOT NULL CHECK (grantee_type IN ('doctor', 'hospital', 'caregiver', 'emergency')),
    grantee_id UUID NULL,
    grantee_name VARCHAR(255) NULL,
    grantee_role VARCHAR(64) NULL,
    scope VARCHAR(64) NOT NULL DEFAULT 'read_records',
    sensitive_categories_included BOOLEAN NOT NULL DEFAULT FALSE,
    duration_hours INTEGER NOT NULL DEFAULT 24,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    revocation_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Evaluation Algorithm Flowchart

```
Patient Query Request
        │
        ▼
Is Grantee the Patient Themselves? ──[YES]──> ALLOW FULL ACCESS
        │ [NO]
        ▼
Is Break-Glass Active? ─────────────[YES]──> ALLOW ACCESS + AUDIT LOG
        │ [NO]
        ▼
Does Active Grant Exist for (Patient, Grantee)?
        │ [NO]
        ├──> DENY (403 Forbidden)
        │ [YES]
        ▼
Is Current Time <= valid_until?
        │ [NO]
        ├──> Auto-Expire Grant + DENY
        │ [YES]
        ▼
Filter Requested Categories by Permitted Scopes ──> RETURN REDACTED RECORD
```

---

## 6. Audit Logging Requirements

Every consent grant creation, modification, access evaluation, and revocation is registered in the immutable audit table with:
- Client IP Address
- User-Agent
- Grant ID
- Decision Outcome (`PERMIT` / `DENY`)
- Timestamp with microsecond precision.
