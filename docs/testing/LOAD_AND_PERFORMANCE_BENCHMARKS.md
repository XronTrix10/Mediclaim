# Performance: Load Testing & Capacity Benchmarks

## 1. Target Service Level Objectives (SLOs)
Mediclaim targets the following performance objectives under standard operating loads:

| Transaction Type | Target p50 | Target p95 | Target p99 | Max Permissible Error Rate |
|---|---|---|---|---|
| User Authentication | < 80 ms | < 150 ms | < 300 ms | < 0.01% |
| Clinical Records Query | < 35 ms | < 80 ms | < 150 ms | < 0.01% |
| Consent Evaluation | < 20 ms | < 45 ms | < 90 ms | < 0.001% |
| Tabular PDF Generation | < 250 ms | < 600 ms | < 1200 ms | < 0.05% |
| Document OCR Extraction| < 3.5 s | < 6.0 s | < 9.0 s | < 0.5% |

## 2. Database Indexing Strategy
To maintain sub-50ms query latency across millions of records, the following composite indexes are maintained:
- `idx_clinical_records_patient`: `clinical_records(patient_id, date DESC)`
- `idx_patient_access_grants_lookup`: `patient_access_grants(patient_id, grantee_user_id, expires_at)`
- `idx_audit_events_patient_timestamp`: `audit_events(patient_id, created_at DESC)`
- `idx_prescriptions_patient`: `prescriptions(patient_id, created_at DESC)`

## 3. Capacity Planning & Sizing
- **PostgreSQL Connection Pool**: Sized for 20-50 concurrent connections per backend worker.
- **Memory Footprint**:
  - Backend ASGI worker: ~120 MiB RSS under load.
  - Frontend static Nginx container: ~25 MiB RSS.
  - PostgreSQL container: ~256 MiB buffer pool allocation.
