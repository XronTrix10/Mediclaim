# Security Architecture: Threat Model & Risk Analysis

## 1. Threat Modeling Methodology
Mediclaim employs the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) to evaluate threats against patient health data and identify systematic defensive controls.

```
+-----------------------------------------------------------------------------+
|                               STRIDE MATRIX                                 |
+-------------------+-----------------------------+---------------------------+
| Threat Category   | Potential Vector            | Implemented Mitigation    |
+-------------------+-----------------------------+---------------------------+
| Spoofing          | Doctor credential theft     | 2FA OTP, Reg No validation|
| Tampering         | Altering medical records    | Strict RBAC & check locks |
| Repudiation       | Denying access grant        | Immutable audit log trail |
| Info Disclosure   | Doctor accessing birth cert | Absolute route filtering  |
| Denial of Service | OTP flooding                | Rate limits, TTL cache    |
| Privilege Elev.   | Patient calling admin routes| Strict dependency checks  |
+-------------------+-----------------------------+---------------------------+
```

## 2. In-Depth Threat Vector Analysis

### 2.1 Spoofing (Identity Deception)
- **Threat**: An adversary attempts to register as a licensed medical practitioner to gain illegitimate access to patient records.
- **Mitigation**:
  - Medical Council Registration numbers (`reg_number`) are validated against medical council registries.
  - Organization accounts (`HS-XXXX`) require administrative verification by platform governance before activation.
  - Multi-factor authentication via secure OTP verification on verified mobile numbers.

### 2.2 Tampering (Data Manipulation)
- **Threat**: Malicious alteration of clinical histories, allergy severities, or prescription dosages.
- **Mitigation**:
  - Clinical records distinguish between `self_reported`, `uploaded`, and `practitioner` sources.
  - Patients can only propose corrections through `record_correction_requests` without mutating original clinician-entered notes.
  - Cryptographic hash checks and relational database foreign key constraints protect integrity.

### 2.3 Repudiation (Denial of Action)
- **Threat**: A patient or practitioner denies having authorized access or accessed sensitive diagnostic records.
- **Mitigation**:
  - Append-only `audit_events` table captures user ID, actor name, role, timestamp, action type (`view`, `upload`, `grant`, `revoke`, `emergency`), and target patient ID.
  - Database permissions prevent updates or deletions on audit trail records.

### 2.4 Information Disclosure (Privacy Breach)
- **Threat**: Unauthorized practitioner access to non-consented clinical records or sensitive identity documents (e.g., birth certificates).
- **Mitigation**:
  - Dynamic consent evaluation filters clinical records to only approved scopes (`allergy`, `condition`, `medication`, `vaccination`, `report`, `document`).
  - Strict birth certificate isolation: files matching birth certificate keywords are universally excluded from doctor view and download endpoints.
  - Practitioners are blocked from direct file downloads (`Content-Disposition: attachment`), permitting only browser inline preview.

### 2.5 Denial of Service (Service Exhaustion)
- **Threat**: Flooding OTP generation endpoints or uploading multi-gigabyte files to exhaust disk and LLM processing quota.
- **Mitigation**:
  - Maximum upload size capped at 15MB per file.
  - Supported MIME-type verification (JPEG, PNG, WebP, PDF only).
  - Rate limiting on OTP dispatch and document OCR parsing endpoints.

### 2.6 Elevation of Privilege
- **Threat**: A standard patient attempts to invoke hospital administration or platform verification endpoints.
- **Mitigation**:
  - FastAPI dependency injection (`require_roles("admin")`, `require_roles("doctor")`, `require_roles("hospital")`) strictly verifies JWT claims on every endpoint.
