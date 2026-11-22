# HIPAA Security Rule Technical Safeguards & Control Matrix

## 1. Regulatory Context

The Health Insurance Portability and Accountability Act (HIPAA) Security Rule (45 CFR Part 160 and Part 164, Subparts A and C) mandates administrative, physical, and technical safeguards to ensure the confidentiality, integrity, and availability of electronic protected health information (ePHI).

### Conformance Mandate
- **Entity Type:** Covered Entity / Business Associate
- **Standard:** 45 CFR § 164.312 (Technical Safeguards)
- **Encryption Standard:** NIST SP 800-52 Rev. 2, NIST SP 800-111

---

## 2. Technical Safeguards Matrix (§ 164.312)

| Section | Standard | Type | Mediclaim Technical Implementation |
|:--------|:---------|:-----|:-----------------------------------|
| `§ 164.312(a)(1)` | Access Control | Required | Unique user credentials, RBAC (Patient, Doctor, Admin, Caregiver) |
| `§ 164.312(a)(2)(i)` | Unique User Identification | Required | UUID primary keys, OAuth2 / JWT stateless cryptographically signed tokens |
| `§ 164.312(a)(2)(ii)` | Emergency Access Procedure | Required | Break-glass emergency access protocol with mandatory audit reason logging |
| `§ 164.312(a)(2)(iii)`| Automatic Logoff | Addressable| Session token expiry after 15 minutes of inactivity; frontend idle timer |
| `§ 164.312(a)(2)(iv)` | Encryption and Decryption | Addressable| AES-256-GCM column encryption for sensitive fields; envelope KMS encryption |
| `§ 164.312(b)` | Audit Controls | Required | Tamper-evident PostgreSQL audit trail logging all SELECT, INSERT, UPDATE, DELETE |
| `§ 164.312(c)(1)` | Integrity Controls | Required | SHA-256 file hashing for medical records and uploaded diagnostic documents |
| `§ 164.312(d)` | Person or Entity Authentication | Required | Argon2id password hashing; Brevo OTP MFA for sensitive clinical changes |
| `§ 164.312(e)(1)` | Transmission Security | Required | TLS 1.3 mandatory across all public REST endpoints; HSTS enforced |

---

## 3. Cryptographic Specifications

```yaml
cryptography_profiles:
  data_in_transit:
    protocol: "TLS 1.3"
    cipher_suites:
      - "TLS_AES_256_GCM_SHA384"
      - "TLS_CHACHA20_POLY1305_SHA256"
    hsts_preload: true
    min_tls_version: "TLS 1.2"
  data_at_rest:
    database_volume: "AES-256-XTS"
    application_payload_fields: "AES-256-GCM"
    key_derivation: "PBKDF2 with HMAC-SHA256 (600,000 iterations)"
  passwords:
    algorithm: "Argon2id"
    time_cost: 3
    memory_cost_kib: 65536
    parallelism: 4
```

---

## 4. Break-Glass Emergency Access Protocol

When emergency physicians require immediate patient access during acute trauma without prior patient consent:

1. **Trigger Condition:** Emergency admission flag active in hospital triage system.
2. **Mandatory Input:** Attending doctor must record explicit clinical rationale (`emergency_reason: "Acute trauma, patient comatose"`).
3. **Privilege Elevation:** Read access granted for an immutable 4-hour window.
4. **Immediate Alerting:** Background worker immediately triggers Brevo SMS and email alert to the patient and registered emergency contacts.
5. **Retrospective Review:** Incident logged in administrative compliance queue for 48-hour hospital compliance review.

---

## 5. Breach Notification & Incident Response SLAs

- **SLA Tier 1 (Suspected Exfiltration):** Containment within 1 hour; forensics team activated.
- **SLA Tier 2 (Confirmed Unauthorized Disclosure):** Formal report to compliance officer within 24 hours.
- **Regulatory Notification:** Breach reporting to federal authority within mandated statutory windows.
