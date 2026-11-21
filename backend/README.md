# Mediclaim Backend API & Clinical Engine

> **FastAPI Application Server for HL7 FHIR-Aligned Longitudinal Medical Records**

---

## Table of Contents

1. [Overview & Capabilities](#1-overview--capabilities)
2. [API Architecture & Module Map](#2-api-architecture--module-map)
3. [Multimodal AI Document Parser (Gemini 3)](#3-multimodal-ai-document-parser-gemini-3)
4. [Database Connection Pool & Migrations](#4-database-connection-pool--migrations)
5. [Local Development Setup](#5-local-development-setup)
6. [Running with Docker Compose](#6-running-with-docker-compose)
7. [Running the Test Suite](#7-running-the-test-suite)
8. [API Documentation & Full Specification](#8-api-documentation--full-specification)

---

## 1. Overview & Capabilities

The Mediclaim backend is built with **Python 3.12+**, **FastAPI**, **Pydantic v2**, and **PostgreSQL 16**. It acts as the secure clinical records engine conforming to HL7 FHIR R4 concepts and strict data sovereignty principles.

### Key Capabilities
- **Authentication & Life Cycle**: Issues sovereign 12-digit Mediclaim IDs (`mediclaim_id`), verifies mobile phone numbers via 6-digit OTPs, and enforces administrator identity verification before account activation.
- **Multimodal AI Medical Ingestion**: Uses Google DeepMind's Gemini 3 Flash model to parse handwritten and typed prescriptions, vaccinations, chronic conditions, and diagnostic reports into structured FHIR records.
- **Birth Milestone Anchoring**: Synthesizes and merges the foundational birth record based on the citizen's registered date of birth.
- **Granular Consent Middleware**: Real-time evaluation of patient-approved scopes (`allergy`, `condition`, `medication`, `vaccination`, `report`) and automatic session expiration.
- **Break-Glass Emergency Protocol**: Allows critical care doctors to bypass consent during trauma resuscitations while logging immutable audit events.
- **Tamper-Evident Audit Logging**: Backed by database-level PostgreSQL triggers that strictly prohibit updates or deletions on audit trails.

---

## 2. API Architecture & Module Map

The API is mounted at `/api/v1` and structured into modular routers:

| Module | Route Prefix | Primary Purpose |
|---|---|---|
| **Authentication** | `/api/v1/auth` | Patient registration, OTP verification, login, and token generation |
| **Patient Profile** | `/api/v1/patients` | Demographics, blood group, address, emergency contact updates |
| **Clinical Records**| `/api/v1/records` | CRUD for allergies, conditions, medications, vaccines, and diagnostic reports |
| **Uploads & Storage**| `/api/v1/uploads`, `/documents` | Multimodal AI parsing, status polling, commit, and authenticated file preview |
| **Timeline & Graph**| `/api/v1/timeline` | Lifelong chronological event stream and node-edge health graph payload |
| **Consent & Access**| `/api/v1/consent` | Access request submission, OTP authorization, active grants, and caregivers |
| **Emergency** | `/api/v1/emergency` | Break-glass override execution and emergency session audit feeds |
| **Audit & Corrections**| `/api/v1/audit`, `/corrections`| Access logs, download history, and patient record amendment workflows |
| **Admin Portal** | `/api/v1/admin` | User verification lifecycle, patient/doctor directories, and organization management |
| **Doctor Portal** | `/api/v1/doctor` | Consultation encounters, authorized patient inspection, and clinical orders |
| **Hospital Portal** | `/api/v1/hospital` | Hospital dashboard, practitioner affiliations, and inpatient rosters |

---

## 3. Multimodal AI Document Parser (Gemini 3)

Located in [`backend/app/services/document_parser.py`](file:///Users/sreejan/Codes/Mediclaim/backend/app/services/document_parser.py).

### Mandatory API Key Check
To prevent silent runtime extraction failures, the server validates `GEMINI_API_KEY` on startup within [`backend/app/main.py`](file:///Users/sreejan/Codes/Mediclaim/backend/app/main.py):
- If `GEMINI_API_KEY` is missing or empty, the application immediately throws a `RuntimeError` and terminates.
- Docker Compose fails fast if `GEMINI_API_KEY` is not provided in the root `.env` file.

### Model Fallback Cascade
To provide high reliability during rate limits or model deprecations, the engine cascades automatically:
1. `gemini-3-flash-preview` (Default primary model)
2. `gemini-3.5-flash-lite` (Fast high-availability tier)
3. `gemini-flash-latest` (Stable fallback tier)

### Graceful Fallback
If an image is completely illegible or the AI tier fails:
- The backend marks `ocr_status = 'failed'` and provides a descriptive failure message.
- The original file binary is preserved on disk.
- The user can proceed with manual data entry via the "Upload anyway" flow while keeping the file preview attached.

---

## 4. Database Connection Pool & Migrations

Located in [`backend/app/database.py`](file:///Users/sreejan/Codes/Mediclaim/backend/app/database.py).
- Utilizes `psycopg2.pool.ThreadedConnectionPool` (1 to 20 connections) configured with connection retry logic.
- Managed via the `@contextmanager def get_db()` context manager with automated transaction commit and rollback handlers.
- **Automated Migration Runner**: `init_db()` runs automatically on application startup during the FastAPI lifespan event:
  - Enables the `pgcrypto` PostgreSQL extension.
  - Creates baseline tables if not present (`users`, `user_roles`, `patient_profiles`, `patient_caregivers`).
  - Executes incremental `ALTER TABLE ADD COLUMN IF NOT EXISTS` routines to guarantee backward and forward compatibility.

---

## 5. Local Development Setup

### 1. Prerequisites
- Python 3.12+
- PostgreSQL 16+ running locally with database `mediclaim` created

### 2. Virtual Environment & Dependencies
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment Variables
Set the required environment variables:
```bash
export DATABASE_URL="postgresql://mediclaim:mediclaim_secret_password@localhost:5432/mediclaim"
export JWT_SECRET="your-strong-random-jwt-secret-minimum-32-chars"
export GEMINI_API_KEY="your-google-gemini-api-key"
export GEMINI_MODEL="gemini-3-flash-preview"
export STORAGE_DIR="./data/storage"
```

### 4. Start Development Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health check: `GET http://localhost:8000/health` returns `{"status":"ok"}`

---

## 6. Running with Docker Compose

From the repository root:
```bash
# Build and start backend along with postgres and frontend
docker compose up --build -d backend

# Inspect live container logs
docker compose logs -f backend
```

---

## 7. Running the Test Suite

The test suite contains 20 comprehensive unit tests covering all operational modules:
- Admin verification and directory filtering (`test_admin.py`)
- Authentication, OTP verification, and JWT issuance (`test_auth.py`)
- Multimodal Gemini parser and structured fallback schema (`test_document_parser.py`)
- Lifelong timeline age calculations and health graph generation (`test_timeline.py`)
- Clinical records CRUD, prescriptions, and FHIR entities (`test_records.py`)
- Doctor encounters, patient inspection, and hospital rosters (`test_doctor_hospital.py`)
- Consent requests, OTP authorizations, and active grant revocation (`test_consent.py`)
- Emergency break-glass overrides, audit logging, and record corrections (`test_emergency_audit_corrections.py`)
- Patient profile completion and permitted demographic updates (`test_patients.py`)

Run tests inside the running Docker container:
```bash
docker exec mediclaim-backend python -m unittest discover -s tests
```
Or locally in your virtual environment:
```bash
python -m unittest discover -s tests
```
Output:
```text
Ran 20 tests in ~0.95s
OK
```

---

## 8. API Documentation & Full Specification

For detailed schemas, request/response payloads, authentication headers, and RFC 9457 error contracts, refer to:
- **Backend API Reference**: [`docs/BACKEND_API.md`](file:///Users/sreejan/Codes/Mediclaim/docs/BACKEND_API.md)
- **Database Architecture**: [`docs/DATABASE.md`](file:///Users/sreejan/Codes/Mediclaim/docs/DATABASE.md)
