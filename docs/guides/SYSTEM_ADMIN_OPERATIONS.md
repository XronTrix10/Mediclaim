# Governance Guide: Platform Administration & Entity Management

## 1. Platform Administration Console
Platform governance administrators manage platform compliance, verify institutional credentials, oversee platform telemetry, and execute entity management protocols.

## 2. Institutional Verification Queue
1. Log in to the Admin Console using administrative credentials (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
2. Navigate to **Verifications**:
   - Inspect pending healthcare organizations.
   - Validate state health authority licensing and clinic registration documents.
   - Click **Approve** to activate the organization or **Reject** if documentation is invalid.

## 3. Entity Removal & Cleanup Protocols

```
+----------------------------------------------------------------------------+
|                     ADMIN ENTITY REMOVAL PROTOCOLS                         |
+-------------------+--------------------------------------------------------+
| Target Entity     | Operational Cascade Actions                            |
+-------------------+--------------------------------------------------------+
| Doctor Profile    | Revoke active grants, invalidate credentials           |
| Hospital Org      | Dissociate staff, archive consultation history         |
| Patient Profile   | Cascade delete DB records, purge physical upload disk  |
+-------------------+--------------------------------------------------------+
```

### 3.1 Removing a Doctor Profile
- Identify practitioner by **Doctor ID** or **Medical Registration Number**.
- Revoking a doctor immediately cancels all active patient access grants and invalidates authentication credentials.

### 3.2 Removing a Patient Profile
- When removing a patient record upon verified request:
  - The database performs cascade deletion across all associated allergies, conditions, medications, vaccinations, prescriptions, and access grants.
  - The backend storage cleanup worker locates `/data/uploads/documents/<patient_id>/` and permanently purges all physical files from disk.

## 4. Emergency Event Auditing
- Super-admins can inspect all "Break-Glass" emergency access events.
- Audit records indicate the exact clinician, patient Mediclaim ID, emergency reason provided, and timestamps.
