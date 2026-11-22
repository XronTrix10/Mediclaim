# Practitioner Guide: Clinical Workflows & Record Inspection

## 1. Overview
The Doctor Console enables licensed medical practitioners to securely request patient consent, inspect longitudinal medical histories, and verify clinical prescriptions.

## 2. Authentication & Verification
- **Doctor Sign-In**: Enter your registered Mobile Number, Password, and verify via 2FA OTP.
- **Medical Registration**: During sign-in, your state/national medical council registration number (e.g. `MCI-12345`) is validated to ensure active clinical standing.

## 3. Requesting Patient Consent

```
[Doctor Console] -> Enter Mediclaim ID (e.g. 3048 4019 6339)
                 -> Select Required Categories (Medications, Reports, etc.)
                 -> Select Duration (1 hour, 4 hours, 24 hours)
                 -> Specify Clinical Purpose (e.g. "Pre-operative evaluation")
                 -> Dispatch Consent Request
```

1. Navigate to **Request Access**.
2. Enter the patient's 12-digit **Mediclaim ID**.
3. Select the clinical scopes relevant to your consultation. Only request data categories strictly necessary for care.
4. Select the duration of access required (default: 4 hours).
5. Submit the request. The patient will be notified immediately on their portal.

## 4. Clinical Record Review
Once the patient approves the consent request:
1. Navigate to **Patients** and select the patient from your active consultations list.
2. The **Patient Detail** page displays:
   - Patient Summary: Name, Age, Gender, Blood Group, Emergency Contacts.
   - Critical Allergies: Prominently highlighted to avoid contraindications.
   - Active Medications & Chronic Conditions.
   - Diagnostic Test Reports.
3. **Document Preview Policy**:
   - Documents are rendered inline in an interactive, read-only preview modal.
   - For patient privacy and security, direct downloading of document files is restricted.
   - Birth certificates are strictly withheld from practitioner access under all circumstances.
