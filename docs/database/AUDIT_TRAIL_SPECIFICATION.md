# Database Architecture: Immutable Audit Trail Specification

## 1. Architectural Philosophy
Audit logging in Mediclaim is non-negotiable and tamper-evident. The platform guarantees that every access to personal health records is indelibly recorded, providing patients with total visibility over who inspected their records and when.

## 2. Table Schema: `audit_events`

```sql
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    what TEXT NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    extra_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_patient_created
    ON audit_events(patient_id, created_at DESC);
```

## 3. Standardized Action Taxonomy

| Action Keyword | Clinical Description | Example Trigger |
|---|---|---|
| `view` | Clinician inspected patient records | Doctor opened consultation dashboard |
| `upload` | New medical file or record uploaded | Patient uploaded CBC report |
| `grant` | Access consent approved | Patient approved 4-hour doctor request |
| `revoke` | Active consent manually revoked | Patient clicked Revoke access |
| `approve` | Access request accepted | Administrative verification approval |
| `correction` | Patient requested record correction | Patient submitted correction note |
| `emergency` | Break-Glass emergency override | Emergency physician emergency unlock |

## 4. Immutability Protections
- Application database connection roles are prohibited from executing `UPDATE` or `DELETE` statements against `audit_events`.
- Triggers and integrity rules ensure timestamps reflect true database server clock time (`NOW()`), preventing backdated audit insertion.
