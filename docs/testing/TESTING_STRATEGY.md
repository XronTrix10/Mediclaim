# Quality Assurance: Testing Strategy & Verification Architecture

## 1. Testing Pyramid Overview
Mediclaim maintains a robust testing hierarchy to guarantee clinical safety, consent invariants, and database schema integrity.

```
          / \
         /   \       End-to-End Workflows (5%)
        /  E2E\      (Cross-portal consent, OCR verification)
       /--------\
      /          \     Integration & API Tests (25%)
     /Integration \    (FastAPI TestClient, DB schema constraints)
    /--------------\
   /                \   Unit & Type Verification (70%)
  /   Unit & Types   \  (Service logic, React types, Oxlint, TS compiler)
 /--------------------\
```

## 2. Test Suites Catalog

### 2.1 Backend Unit & Integration Tests (`backend/tests/`)
- **`test_auth.py`**: User registration, password hashing verification, OTP expiration, JWT issuance and claims validation.
- **`test_consent.py`**: Consent request lifecycles, scope enforcement, time-based grant expiration, and doctor scope restriction.
- **`test_database_schema.py`**: Direct PostgreSQL schema introspection validating column nullability, check constraints, and foreign key cascades.
- **`test_document_processing.py`**: Mocked and live Gemini multimodal extraction parser validation and payload normalization.

### 2.2 Security Invariant Tests
- **Birth Certificate Privacy Barrier**: Tests verify that neither inline preview nor document listing endpoints expose birth records to non-owner clinicians.
- **Practitioner Download Guard**: Verifies that practitioners receive `403 FORBIDDEN` when attempting direct file download of patient records.
- **Cascade File Purge**: Verifies that deleting a patient record physically removes the corresponding directory from `/data/uploads/documents/<patient_id>/`.

### 2.3 Frontend Type & Build Verification
- **Static Analysis**: `oxlint` for high-speed JavaScript/TypeScript linting.
- **Type Checking**: `tsc -b` validating all React 19 component props, API interfaces, and state stores.
- **Bundle Production**: `vite build` validating asset compression and clean code splitting.
