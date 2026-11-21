# Mediclaim Developer & Technical Contributor Guide

> **Engineering Handbook for Developing, Testing, and Deploying the Mediclaim Platform**

---

## Table of Contents

1. [System Architecture & Component Topology](#1-system-architecture--component-topology)
2. [Technology Stack & Key Libraries](#2-technology-stack--key-libraries)
3. [Prerequisites & Development Environment Setup](#3-prerequisites--development-environment-setup)
4. [Running the Application](#4-running-the-application)
   - [Method A: Docker Compose (Recommended)](#method-a-docker-compose-recommended)
   - [Method B: Manual Local Setup](#method-b-manual-local-setup)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Multimodal AI Document Parser Architecture (Gemini 3)](#6-multimodal-ai-document-parser-architecture-gemini-3)
   - [Model Fallback Cascade](#model-fallback-cascade)
   - [Startup Safety & Key Validation](#startup-safety--key-validation)
   - [Structured Extraction Schema](#structured-extraction-schema)
7. [Testing, Linting & Quality Assurance](#7-testing-linting--quality-assurance)
   - [Running Backend Unit Tests](#running-backend-unit-tests)
   - [Running Frontend Typechecks & Vite Build](#running-frontend-typechecks--vite-build)
   - [Running the Oxlint Linter](#running-the-oxlint-linter)
8. [Security Architecture & Implementation Details](#8-security-architecture--implementation-details)
   - [Authentication & JWT Token Structure](#authentication--jwt-token-structure)
   - [Granular Scoped Consent Middleware](#granular-scoped-consent-middleware)
   - [Immutable Audit Trail Trigger](#immutable-audit-trail-trigger)
   - [File Storage & Authenticated Preview Streaming](#file-storage--authenticated-preview-streaming)
9. [Documentation References](#9-documentation-references)

---

## 1. System Architecture & Component Topology

Mediclaim follows a decoupled three-tier architecture adhering to HL7 FHIR R4 clinical data principles:

```mermaid
graph TD
    subgraph Client Layer
        A["React 19 SPA<br>(Tailwind CSS v4 + Vite)"]
    end

    subgraph API Gateway / Backend Layer
        B["FastAPI Application Server<br>(Python 3.12+ / Uvicorn)"]
        C["Multimodal AI Parser<br>(Google Gemini 3 Flash Cascade)"]
        D["Disk Storage Engine<br>(Local Sandboxed Volume)"]
    end

    subgraph Data Layer
        E[("PostgreSQL 16 Database<br>(pgcrypto + Connection Pool)")]
    end

    A -->|REST API over HTTP/JSON| B
    B -->|Multimodal Document Inference| C
    B -->|Binary Stream IO & SHA-256| D
    B -->|Threaded Connection Pool| E
```

### Key Architectural Characteristics
- **Stateless API**: Authentication is handled via cryptographically signed JSON Web Tokens (JWT). The backend holds no session state.
- **Connection Pooling**: Backend utilizes `psycopg2.pool.ThreadedConnectionPool` with automatic retry logic and transaction rollback handlers.
- **Fail-Safe AI Integration**: Document parsing cascades through Gemini 3 preview, Flash-Lite, and Flash-Latest models, with immediate fallback to manual entry if all AI tiers are unreachable.
- **Tamper-Evident Storage**: Audit events are protected by database-level triggers preventing any modifications or deletions.

---

## 2. Technology Stack & Key Libraries

| Component | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend Framework** | React | 19.2.x | Component-based UI with Concurrent Mode |
| **Language (Frontend)** | TypeScript | 6.0.x | Type safety across clinical interfaces |
| **Styling** | Tailwind CSS | 4.3.x | Modern CSS styling with CSS variables |
| **Bundler & Tooling** | Vite | 8.3.x | Lightning-fast HMR and ESM build pipeline |
| **Graph Visualization** | `@xyflow/react` | 12.12.x | Interactive node-edge clinical health graphs |
| **Graph Layout Engine** | `d3-hierarchy` | 3.1.x | Radial and tree node layout calculations |
| **Linter** | Oxlint | 1.81.x | High-performance Rust-based linter |
| **Backend Framework** | FastAPI | 0.115.x | High-throughput asynchronous Python web API |
| **Validation** | Pydantic | 2.9.x | Strict request/response schema validation |
| **Database Driver** | psycopg2-binary | 2.9.x | PostgreSQL driver with connection pooling |
| **Security & Cryptography** | PyJWT / Passlib / Argon2 | — | Password hashing and JWT generation |
| **Multimodal AI** | `google-genai` | 1.5.x | Multimodal medical OCR and structured data extraction |
| **Database** | PostgreSQL | 16-alpine | Relational persistence with UUID extensions |
| **Containerization** | Docker / Docker Compose | — | Container orchestration |

---

## 3. Prerequisites & Development Environment Setup

Ensure the following runtimes are installed on your workstation:
- **Node.js**: v20.18+ or v22+
- **npm**: v10+
- **Python**: v3.12+
- **PostgreSQL**: v16+ (if running manually outside Docker)
- **Docker & Docker Compose**: Docker Desktop 4.30+

---

## 4. Running the Application

### Method A: Docker Compose (Recommended)

Docker Compose coordinates the database, backend, and frontend containers automatically.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/Mediclaim.git
   cd Mediclaim
   ```

2. **Configure your environment**:
   Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```
   Ensure `GEMINI_API_KEY` is populated with a valid Google Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3-flash-preview
   JWT_SECRET=super-secret-dev-jwt-key-minimum-32-chars
   ```

3. **Start the containers**:
   ```bash
   docker compose up --build -d
   ```

4. **Verify container health**:
   ```bash
   docker compose ps
   ```
   All three containers (`mediclaim-postgres`, `mediclaim-backend`, and `mediclaim-frontend`) should show healthy running statuses:
   - Frontend: `http://localhost:5173` (also mapped to `http://localhost:3000`)
   - Backend API: `http://localhost:8000`
   - Interactive OpenAPI Docs: `http://localhost:8000/docs`
   - PostgreSQL Database: `localhost:5432`

5. **Stop containers**:
   ```bash
   docker compose down
   ```
   *(To wipe all database volumes, pass `-v`: `docker compose down -v`)*

---

### Method B: Manual Local Setup

#### 1. Database Setup
Ensure PostgreSQL is running locally, then initialize the database:
```sql
CREATE DATABASE mediclaim;
CREATE USER mediclaim WITH PASSWORD 'mediclaim_secret_password';
GRANT ALL PRIVILEGES ON DATABASE mediclaim TO mediclaim;
```
Execute schema migration:
```bash
psql -U mediclaim -d mediclaim -f infra/db/001_schema.sql
```

#### 2. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set required environment variables
export DATABASE_URL="postgresql://mediclaim:mediclaim_secret_password@localhost:5432/mediclaim"
export JWT_SECRET="your-strong-random-secret-key-32-chars-min"
export GEMINI_API_KEY="your-google-gemini-api-key"
export GEMINI_MODEL="gemini-3-flash-preview"
export STORAGE_DIR="./data/storage"

# Run migrations and start API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 5. Environment Variables Reference

| Variable | Required | Default (Dev) | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | `postgresql://mediclaim:mediclaim_secret_password@postgres:5432/mediclaim` | PostgreSQL DSN connection string |
| `JWT_SECRET` | **Yes** | *None (must be set)* | Minimum 32-character secret for signing JWT tokens |
| `GEMINI_API_KEY` | **Yes** | *None (must be set)* | Google Gemini API key for document parsing. Backend fails on startup if missing. |
| `GEMINI_MODEL` | No | `gemini-3-flash-preview` | Primary Gemini model. Auto-falls back to `gemini-3.5-flash-lite`. |
| `STORAGE_DIR` | No | `/app/data/storage` | Local directory path for persisting uploaded documents and prescriptions |
| `OTP_DEBUG` | No | `true` | When true, prints SMS OTP codes to server console logs |
| `VITE_API_BASE_URL` | No | `http://localhost:8000/api/v1` | Base URL used by the frontend client to communicate with the API |

---

## 6. Multimodal AI Document Parser Architecture (Gemini 3)

Located in [`backend/app/services/document_parser.py`](file:///Users/sreejan/Codes/Mediclaim/backend/app/services/document_parser.py).

### Startup Safety & Key Validation
In [`backend/app/main.py`](file:///Users/sreejan/Codes/Mediclaim/backend/app/main.py), a lifespan check strictly validates the presence of `GEMINI_API_KEY`:
```python
if not GEMINI_API_KEY or not GEMINI_API_KEY.strip():
    raise RuntimeError(
        "CRITICAL STARTUP ERROR: GEMINI_API_KEY environment variable is not set. "
        "Mediclaim requires a valid Gemini API key for multimodal medical document parsing."
    )
```
If missing, the backend process immediately terminates with a clear, actionable error.

### Model Fallback Cascade
To avoid rate limits or deprecation outages, the parser cascades through three model tiers:
1. `gemini-3-flash-preview` (Default primary)
2. `gemini-3.5-flash-lite` (Fast high-availability tier)
3. `gemini-flash-latest` (Stable fallback)

### Structured Extraction Schema
The model returns an enforced JSON schema containing:
- `documentType`: `prescription`, `vaccination`, `lab_report`, `discharge_summary`, `allergy_note`
- `documentDate`: `YYYY-MM-DD`
- `provider`: Clinician / Clinic name
- `prescriptions`: Medications, dosages, frequencies, and durations
- `vaccinations`: Vaccine names, doses, and dates
- `conditions`: Diagnoses, clinical severity, and status
- `allergies`: Allergens, reactions, and criticality
- `reports`: Lab tests, observed values, units, reference ranges, and interpretations

---

## 7. Testing, Linting & Quality Assurance

### Running Backend Unit Tests
The test suite consists of 20 comprehensive unit tests covering authentication, patient profiles, records, document parsing, consent, emergency overrides, and admin verification.

Run directly via Docker:
```bash
docker exec mediclaim-backend python -m unittest discover -s tests
```
Or locally inside your virtual environment:
```bash
cd backend
python -m unittest discover -s tests
```
Expected output:
```text
Ran 20 tests in ~0.95s
OK
```

### Running Frontend Typechecks & Vite Build
Validates all TypeScript definitions and verifies that the production bundle compiles:
```bash
npm --prefix frontend run build
```

### Running the Oxlint Linter
Executes Oxlint across all 86+ frontend source files:
```bash
npm --prefix frontend run lint
```

---

## 8. Security Architecture & Implementation Details

### Authentication & JWT Token Structure
- Tokens use the HMAC-SHA256 (`HS256`) algorithm.
- Standard claims:
  - `sub`: User UUID (`usr_...`)
  - `roles`: Array of assigned roles (`['patient']`, `['practitioner']`, `['admin']`)
  - `pat`: Patient profile public ID (`pat_...`)
  - `doc`: Doctor profile public ID (`doc_...`)
  - `grt`: Access grant ID (for scoped doctor sessions)
  - `exp`: Expiration timestamp (default: 8 hours for users; duration-bounded for doctors)

### Granular Scoped Consent Middleware
When a practitioner issues a request for `/api/v1/doctor/patients/:mediclaimId/records`:
1. The backend inspects the doctor's active token for the `grt` grant ID.
2. It verifies in real time that `status = 'active'` and `expires_at > now()`.
3. It fetches the authorized scopes from `access_grant_scopes` (`['allergy', 'medication']`).
4. Records outside the approved scopes are filtered out before sending the response.

### Immutable Audit Trail Trigger
The PostgreSQL database enforces append-only immutability for the `audit_events` table via a PL/pgSQL trigger function:
```sql
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.actor_user_id IS NULL OR NEW.patient_id IS NULL) 
       AND OLD.id = NEW.id AND OLD.action = NEW.action THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Audit history is immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;
```
Direct attempts to run `UPDATE` or `DELETE` queries on `audit_events` are rejected with an exception.

### File Storage & Authenticated Preview Streaming
- Binary files uploaded by users are saved with sanitized paths under `STORAGE_DIR`.
- Files are never hosted as static public assets.
- Streaming endpoints (`GET /api/v1/documents/:id/preview` and `/content`) verify JWT credentials and check patient ownership or active doctor consent before streaming content bytes.

---

## 9. Documentation References

- **User Guide**: [`USER_GUIDE.md`](file:///Users/sreejan/Codes/Mediclaim/USER_GUIDE.md) — Comprehensive guide for patients, doctors, hospitals, and admins.
- **Frontend Architecture**: [`frontend/README.md`](file:///Users/sreejan/Codes/Mediclaim/frontend/README.md) — Routing, components, state, and UI tokens.
- **Backend API Reference**: [`docs/BACKEND_API.md`](file:///Users/sreejan/Codes/Mediclaim/docs/BACKEND_API.md) — Complete specification of all REST endpoints.
- **Database Architecture**: [`docs/DATABASE.md`](file:///Users/sreejan/Codes/Mediclaim/docs/DATABASE.md) — Schemas, relationships, file storage, and DBML code block.
- **Master README**: [`README.md`](file:///Users/sreejan/Codes/Mediclaim/README.md) — Project summary and master table of contents.
