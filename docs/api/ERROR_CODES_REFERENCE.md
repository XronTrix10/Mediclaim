# API Architecture: Standardized Error Taxonomy & Handling

## 1. Error Response Envelope
All non-2xx API responses return a consistent, machine-readable JSON structure:

```json
{
  "status": "error",
  "code": "ERROR_CODE_CONSTANT",
  "detail": "Human-readable description of the error condition.",
  "timestamp": "2026-11-22T22:00:00Z"
}
```

## 2. Standardized Error Catalog

### 2.1 Authentication & Session Errors (401 / 403)
| Error Code | HTTP Status | Meaning | Recommended Client Action |
|---|---|---|---|
| `AUTH_FAILED` | 401 | Invalid phone/email or password | Prompt user to verify credentials |
| `TOKEN_EXPIRED` | 401 | JWT session token has expired | Refresh token or redirect to login |
| `INVALID_OTP` | 400 | Entered OTP code does not match | Allow user to retry entering code |
| `OTP_EXPIRED` | 400 | Verification code exceeded TTL | Offer "Resend OTP" action |
| `ACCOUNT_PENDING_APPROVAL`| 403 | Organization awaiting admin verification | Display pending verification message |

### 2.2 Consent & Access Errors (403)
| Error Code | HTTP Status | Meaning | Recommended Client Action |
|---|---|---|---|
| `CONSENT_REQUIRED` | 403 | No active consent grant exists | Direct doctor to submit access request |
| `SCOPE_UNAUTHORIZED` | 403 | Requested category not granted | Show "Scope not approved" notice |
| `GRANT_EXPIRED` | 403 | Time-bound consent has elapsed | Notify clinician that session ended |
| `BIRTH_CERTIFICATE_RESTRICTED` | 403 | Birth certificate access blocked | Inform clinician document is restricted |

### 2.3 Entity & Validation Errors (400 / 404 / 409)
| Error Code | HTTP Status | Meaning | Recommended Client Action |
|---|---|---|---|
| `ENTITY_NOT_FOUND` | 404 | Target record, patient, or doc missing | Verify ID and refresh list |
| `INVALID_MEDICLAIM_ID`| 400 | ID format does not match 12-digit standard | Prompt user for valid Mediclaim ID |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists (e.g. phone) | Suggest sign-in or alternative phone |
| `FILE_TOO_LARGE` | 413 | Uploaded document exceeds 15MB limit | Prompt user to compress file |
