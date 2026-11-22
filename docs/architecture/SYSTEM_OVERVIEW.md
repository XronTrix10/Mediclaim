# Mediclaim Architecture: System Overview

## 1. Executive Summary
Mediclaim is a unified, federated national health records platform compliant with HL7 FHIR R4 standards. The platform empowers patients with sovereign ownership over their longitudinal health records while providing doctors, healthcare providers, and emergency personnel with secure, time-bound, and consent-gated access to clinical data.

```
+----------------------------------------------------------------------------------+
|                                MEDICLAIM ECOSYSTEM                               |
+----------------------------------------------------------------------------------+
|  +--------------------+     +---------------------+     +---------------------+  |
|  |   Patient Portal   |     |   Doctor Console    |     | Hospital Admin App  |  |
|  | (React / Tailwind) |     |  (Clinical Review)  |     | (Staff & Org Mgmt)  |  |
|  +---------+----------+     +----------+----------+     +----------+----------+  |
|            |                           |                           |             |
|            +-------------------+       |       +-------------------+             |
|                                |       |       |                                 |
|                                v       v       v                                 |
|                     +-----------------------------------+                        |
|                     |     REST API Gateway / Security   |                        |
|                     |     (FastAPI / Python 3.12 Engine)|                        |
|                     +-----------------+-----------------+                        |
|                                       |                                          |
|        +------------------------------+------------------------------+           |
|        |                              |                              |           |
|        v                              v                              v           |
| +--------------+             +-----------------+             +-----------------+ |
| | PostgreSQL   |             | Gemini OCR      |             | File System /   | |
| | Core RDBMS   |             | Multimodal LLM  |             | Encrypted Disk  | |
| | (Structured) |             | (Doc Extractor) |             | (Blob Storage)  | |
| +--------------+             +-----------------+             +-----------------+ |
+----------------------------------------------------------------------------------+
```

## 2. Core Architectural Components

### 2.1 Frontend Single Page Application (SPA)
- **Framework**: React 19 with Vite bundler and TypeScript 6.
- **Styling**: Tailwind CSS v4 with custom medical palette and high-contrast accessibility tokens.
- **State Architecture**: Context-driven unified `HealthDataProvider` orchestrating API interaction, optimistic state caches, and live notification sync.
- **Visual Analytics**: Interactive health graph visualization powered by `@xyflow/react` and `d3-hierarchy`.

### 2.2 Backend Microservices & API Engine
- **Framework**: FastAPI (Asynchronous Python ASGI web server powered by Uvicorn).
- **Authentication**: Stateless HMAC-SHA256 JWT tokens paired with SMS/Email OTP two-factor verification.
- **Password Security**: Argon2id password hashing via pwdlib with high memory-cost parameters.
- **Authorization**: Role-Based Access Control (RBAC) supporting `patient`, `doctor`, `hospital`, and `admin` scopes.

### 2.3 PostgreSQL Relational Database
- **Engine**: PostgreSQL 16 Alpine containerized.
- **Data Integrity**: Enforced via relational foreign keys with `ON DELETE CASCADE` on transactional records and defensive CHECK constraints.
- **Audit Trails**: Append-only event journaling recording every read, write, consent grant, and emergency access.

### 2.4 Multimodal Document Extraction Engine
- **Provider**: Google Gemini Flash API (`gemini-3-flash-preview` / `gemini-1.5-flash`).
- **Functionality**: Extracts prescriptions, medications, dosages, frequency, diagnoses, vaccinations, and lab report metrics from uploaded images and PDFs into structured JSON representations.

## 3. Core Architectural Invariants
1. **Patient Sovereignty**: Data cannot be viewed by clinicians without an explicit, time-bound, unexpired consent grant approved by the patient.
2. **Birth Record Isolation**: Birth certificates are strictly isolated and permanently exempt from practitioner visibility regardless of consent scope.
3. **Download Restriction**: Doctors are granted strictly read-only inline preview access; direct binary file downloads by clinicians are blocked at the API gateway.
4. **Physical Storage Cleanup**: Permanent deletion of patient records cascades to remove physical disk blobs, leaving zero orphaned files.
5. **Non-Repudiation**: Every clinical event, view, grant, revocation, and administrative intervention is permanently committed to an immutable audit ledger.
