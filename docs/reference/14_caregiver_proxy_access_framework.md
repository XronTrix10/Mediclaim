# Caregiver Proxy Access Framework & Delegation Lifecycle

## 1. Context & Clinical Rationale

Many patients (pediatric dependents, geriatric individuals, cognitively impaired adults) rely on family members or legal guardians to manage appointments, coordinate prescriptions, and review laboratory results. The Mediclaim Caregiver Proxy Access Framework provides compliant delegation without credential sharing.

---

## 2. Legal Authority Classifications

| Authority Type | Legal Basis | Verification Documentation | Authorized Access Scope |
|:---------------|:------------|:---------------------------|:------------------------|
| `LEGAL_GUARDIAN` | Court Order / Guardianship Decree | Certified court order scan | Full Administrative & Clinical |
| `PARENT_MINOR` | Biological / Adoptive Custody | Birth certificate / Adoption deed | Full Access (subject to minor privacy laws)|
| `HEALTHCARE_POA` | Durable Power of Attorney | Notarized DPOA-HC execution | Clinical decision support, treatment consent|
| `DESIGNATED_FAMILY`| Patient Consent Directive | In-app patient digital signature | Read-only records, appointment booking |
| `TEMPORARY_ESCORT`| Patient Travel / Hospital Accompaniment| Verbal / SMS consent token | 48-Hour Emergency Contact only |

---

## 3. Caregiver Role Matrix

```yaml
caregiver_roles:
  primary_guardian:
    permissions:
      - "records:read"
      - "records:download"
      - "appointments:book"
      - "prescriptions:refill_request"
      - "billing:pay"
      - "consent:delegate"
  clinical_viewer:
    permissions:
      - "records:read"
      - "prescriptions:view"
      - "appointments:view"
  billing_representative:
    permissions:
      - "billing:view"
      - "billing:pay"
      - "insurance:claim_status"
```

---

## 4. Minor Patient Emancipation & Age of Majority

Mediclaim enforces automatic proxy restriction upon minors reaching statutory age:

1. **Pediatric Tier (Ages 0 - 11):** Parents have default full access to all clinical records.
2. **Adolescent Tier (Ages 12 - 17):** Sensitive records (reproductive health, mental health, substance use) are automatically sequestered from parental view unless explicitly opted in by the adolescent patient.
3. **Adult Transition (Age 18):** On the patient's 18th birthday, parental caregiver proxies are automatically suspended. The adult patient receives an automated prompt to re-authorize designated caregivers.

---

## 5. Delegation Lifecycle State Machine

```
[Requested]
     │
     ├──> [Documents Uploaded]
     │           │
     │           ├──> [Verified by Admin] ──> [Active Proxy] ──> [Revoked]
     │           │                                   │
     │           └──> [Rejected]                     └──> [Auto-Expired]
     │
     └──> [Cancelled by Requester]
```

---

## 6. Technical Safeguards & Anti-Coercion Measures

- **Discrete Revocation:** The patient can revoke a caregiver proxy at any time from their mobile device with zero delay.
- **Access Notification:** An unobtrusive SMS/email summary of all caregiver lookups is dispatched to the patient weekly.
- **Session Isolation:** Caregivers authenticate using their own unique credentials; sharing passwords violates platform terms of service.
