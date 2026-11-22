# Architecture: Dynamic Consent Engine Specification

## 1. Overview
The Mediclaim Consent Engine is an automated policy enforcement point (PEP) that governs practitioner access to patient health records. Access is zero-trust, explicit, time-bounded, and revocable at any moment.

```
       +-------------------------------------------------------------+
       |                  CONSENT LIFECYCLE FLOW                     |
       +-------------------------------------------------------------+

[Doctor]                          [Patient]                       [Backend Engine]
   |                                 |                                    |
   |--- 1. Request Access ---------->|                                    |
   |    (Mediclaim ID, scopes, TTL)  |                                    |
   |                                 |--- 2. Inspect Pending Request ---->|
   |                                 |                                    |
   |                                 |--- 3. Approve or Reject ---------->|
   |                                 |                                    |
   |                                 |                        [Create Grant Table]
   |                                 |                        [Set Expiry Timestamp]
   |                                 |                        [Record Audit Log]
   |                                 |                                    |
   |--- 4. Query Patient Records ---------------------------------------->|
   |                                                          [Verify Active Grant]
   |                                                          [Filter Approved Scopes]
   |                                                          [Exclude Birth Certs]
   |<-- 5. Return Filtered Clinical Data ---------------------------------|
```

## 2. Scope Hierarchy & Definitions
The engine enforces six granular clinical scopes:
- `allergy`: Access to adverse reactions, criticality, and allergens.
- `condition`: Access to diagnosed acute and chronic conditions and onset dates.
- `medication`: Access to prescribed drugs, dosages, and regimens.
- `vaccination`: Access to immunization records and batch numbers.
- `report`: Access to diagnostic laboratory tests, clinical notes, and conclusions.
- `document`: Access to inline viewing of verified uploaded documents.
- `all`: Comprehensive bundle containing all clinical categories.

## 3. Invariant Enforcement Rules

### 3.1 Time-To-Live (TTL) Bounding
- Every access grant requires an explicit duration (`duration_hours` between 1 and 72 hours).
- The engine calculates `expires_at = NOW() + INTERVAL 'N hours'`.
- Expired grants are automatically evaluated as inactive; no clinician can access records past the expiration timestamp.

### 3.2 Instant Revocation
- Patients can click "Revoke" at any point prior to grant expiration.
- Revocation immediately transitions status to `revoked` and logs an audit record, instantly terminating clinician access.

### 3.3 Birth Certificate Privacy Barrier
- Even when `document` or `all` scope is granted, the backend consent service filters out any document identified as a birth record.
- Verification checks scan document titles, original filenames, and metadata for birth certificate markers.
- Direct API requests to fetch birth certificate binaries by non-patient actors return `403 FORBIDDEN` (`BIRTH_CERTIFICATE_RESTRICTED`).
