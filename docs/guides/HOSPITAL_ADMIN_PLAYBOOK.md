# Operations Playbook: Hospital & Healthcare Organization Administration

## 1. Organization Account Lifecycle
Healthcare facilities, clinics, and hospital networks interface with Mediclaim through verified organizational accounts (`HS-XXXX`).

```
+----------------------------------------------------------------------------+
|                       ORGANIZATION LIFECYCLE                               |
+----------------------------------------------------------------------------+
| 1. Registration   | Hospital submits facility details, license & contact   |
| 2. Verification   | Platform administrators verify hospital accreditation  |
| 3. Staff Roster   | Organization assigns verified practitioners            |
| 4. Clinical Ops   | Doctors initiate consent-based patient encounters      |
| 5. Governance     | Departmental audit monitoring and access review        |
+----------------------------------------------------------------------------+
```

## 2. Hospital Registration & Onboarding
1. **Submission**:
   - Provide Organization Legal Name, Healthcare Facility Type (Hospital, Diagnostic Center, Clinic).
   - Enter registration license number and official administrative email.
   - Submit contact phone for administrative OTP verification.
2. **Administrative Approval**:
   - New organization accounts initially carry a `pending_approval` status.
   - Platform governance administrators review the facility credentials before granting active operational status.

## 3. Practitioner Management
- Hospital administrators can view all doctors associated with their facility.
- Verify that each doctor's Medical Council Registration Number corresponds to valid practitioner licensing.
- Track active and historical patient consultations conducted by hospital medical staff.

## 4. Departmental Security & Auditing
- Review access history across all organizational consultations.
- Monitor active emergency access events to ensure compliance with clinical governance standards.
- Maintain accurate facility contact details to ensure emergency patient communications reach the appropriate department.
