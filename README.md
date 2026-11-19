# Mediclaim — Longitudinal Health Record & Unified Graph Platform

> **A lifetime digital medical record system conforming to HL7 FHIR principles, featuring interactive health graph visualization, granular patient-consent governance, clinical encounter workflows, and administrative verifications.**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features & Portals](#key-features--portals)
  - [1. Patient Portal (`/app`)](#1-patient-portal-app)
  - [2. Doctor / Practitioner Portal (`/app/doctor`)](#2-doctor--practitioner-portal-appdoctor)
  - [3. Healthcare Organization Portal (`/app/hospital`)](#3-healthcare-organization-portal-apphospital)
  - [4. Administrator Portal (`/admin`)](#4-administrator-portal-admin)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Quickstart Guide](#quickstart-guide)
  - [Running with Docker Compose (Recommended)](#running-with-docker-compose-recommended)
  - [Manual Local Development](#manual-local-development)
- [Default Credentials & Authentication](#default-credentials--authentication)
- [API Documentation](#api-documentation)
- [Running Tests & Quality Checks](#running-tests--quality-checks)
- [Directory Layout](#directory-layout)

---

## 🌟 Overview

Mediclaim replaces scattered paper prescriptions, disparate hospital records, and uncoordinated medical histories with a unified digital health system. Every citizen is issued a unique, standardized **12-digit Mediclaim ID** following verified registration. 

Patients retain full sovereign ownership over their data, granting explicit, scoped, time-bound consent to healthcare providers or caregivers. Doctors and hospitals can review longitudinal records, issue prescriptions, record clinical diagnoses, and initiate emergency break-glass protocols when critical care demands it.

---

## 🚀 Key Features & Portals

### 1. Patient Portal (`/app`)
- **Interactive Health Graph (`/app`)**: Powered by `@xyflow/react` and D3 hierarchy, visualizing the patient's entire health journey as an interconnected node graph (linking conditions, allergies, vital signs, prescriptions, and lab reports).
- **Comprehensive Clinical Records (`/app/records`)**: Categorized views with manual entry modals and document upload capabilities:
  - Chronic Conditions & Diagnoses
  - Medications & Digital Prescriptions
  - Allergies & Intolerances (with criticality levels)
  - Vaccinations & Immunization history
  - Vital Signs & Observations
  - Lab & Diagnostic Reports
  - Clinical Notes
- **Longitudinal Medical Timeline (`/app/timeline`)**: Chronological event stream with instant filtering by date range, provider, and clinical category.
- **Consent Governance (`/app/access`)**:
  - Review, approve, or revoke access requests from doctors and hospitals.
  - Configure granular access scopes (`allergies`, `medications`, `conditions`, `records`, `emergency`).
  - Family Caregiver Delegations: Grant managed access to designated relatives.
  - Emergency Break-Glass History: Audit log of all emergency accesses with clinical justifications.

### 2. Doctor / Practitioner Portal (`/app/doctor`)
- **Doctor Dashboard (`/app/doctor`)**: Active patient authorizations, upcoming consultations, and pending consent requests.
- **Request Patient Access (`/app/doctor/request-access`)**: Lookup patients by 12-digit Mediclaim ID and request scoped access with OTP authorization.
- **Patient Inspection View (`/app/doctor/patients/:mediclaimId`)**: Full longitudinal view of authorized patient records.
- **Clinical Data Entry**: Form modals for doctors to record:
  - Consultations & Clinical Encounters
  - Diagnoses & Chronic Conditions
  - Prescriptions & Dosages
  - Lab Diagnostic Requests & Results
  - Immunizations & Vaccinations
- **Access History & Audit (`/app/doctor/access-history`)**: Detailed log of past access sessions.

### 3. Healthcare Organization Portal (`/app/hospital`)
- **Organization Dashboard (`/app/hospital`)**: Total active patients, department metrics, and clinical summary.
- **Practitioner Management (`/app/hospital/practitioners`)**: Directory of onboarded medical staff with medical registration/license numbers and specializations.
- **Patient Roster (`/app/hospital/patients`)**: All patients with active consent granted to the hospital or its medical staff.

### 4. Administrator Portal (`/admin`)
- **Admin Overview (`/admin`)**: Real-time KPI metrics (total registered patients, pending verifications, verified practitioners, affiliated hospitals, break-glass alerts).
- **User Verifications Lifecycle (`/admin/verifications`)**:
  - Filter across **Pending**, **Verified**, and **All** registrations.
  - Search by name, phone, Aadhaar, or Mediclaim ID.
  - Review documents, verify identity, and issue unique 12-digit Mediclaim IDs.
  - User detail inspection modal with comprehensive demographics and emergency contacts.
- **Patient Directory (`/admin/patients`)**: List of all patients with search, pagination, and click-to-open profile detail modals.
- **Practitioner Directory (`/admin/practitioners`)**: Onboard new medical practitioners, filter by organization or specialization, and inspect profiles via detail modals.
- **Healthcare Organizations (`/admin/organizations`)**: Register and manage hospitals, clinics, and diagnostic centers with affiliated doctor counts.
- **Emergency Audit & Review (`/admin/emergency`)**: Global audit trail of emergency break-glass overrides with justification notes.

---

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router v7, `@xyflow/react`, D3 Hierarchy, Oxlint |
| **Backend** | Python 3.12+, FastAPI, Pydantic v2, psycopg2 (threaded connection pool), PyJWT, Argon2 / Passlib |
| **Database** | PostgreSQL 16 (with `pgcrypto` for UUIDs and cryptography) |
| **Standards** | HL7 FHIR R4 concepts, RFC 9457 Problem Details error responses |
| **DevOps** | Docker, Docker Compose, automated database seeding and migration routines |

---

## ⚡ Quickstart Guide

### Running with Docker Compose (Recommended)

1. **Clone the repository and enter directory**:
   ```bash
   git clone https://github.com/your-username/Mediclaim.git
   cd Mediclaim
   ```

2. **Configure environment (optional)**:
   ```bash
   cp .env.example .env
   ```

3. **Start the complete stack**:
   ```bash
   docker-compose up --build -d
   ```

4. **Verify container status**:
   ```bash
   docker-compose ps
   ```

---

### Manual Local Development

#### Prerequisites
- Node.js 20+ & npm
- Python 3.12+
- PostgreSQL 16+ running locally

#### 1. Database Setup
Ensure PostgreSQL is running and create the database:
```sql
CREATE DATABASE mediclaim;
CREATE USER mediclaim WITH PASSWORD 'mediclaim_secret_password';
GRANT ALL PRIVILEGES ON DATABASE mediclaim TO mediclaim;
```

#### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Default Credentials & Authentication

### Administrator Portal
- **URL**: `http://localhost:3000/auth/admin`
- **Email**: `admin@mediclaim.gov.in`
- **Password**: `Admin@123`

### Citizen, Doctor & Hospital Portals
- **URL**: `http://localhost:3000/auth`
- Select **Patient**, **Doctor**, or **Hospital** to login or register.
- **Development OTP Mode**: When `OTP_DEBUG=true`, verification codes are displayed directly in the user interface and logged to the backend console.

---

## 📖 API Documentation

FastAPI automatically generates interactive OpenAPI documentation:

| Resource | URL |
|---|---|
| **Swagger UI (Interactive API Docs)** | [http://localhost:8000/docs](http://localhost:8000/docs) |
| **ReDoc Documentation** | [http://localhost:8000/redoc](http://localhost:8000/redoc) |
| **OpenAPI Specification (JSON)** | [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json) |
| **System Health Check** | [http://localhost:8000/health](http://localhost:8000/health) |

---

## 🧪 Running Tests & Quality Checks

### Backend Unit & Integration Tests
Run all 15 automated test suites covering authentication, consent, clinical records, doctor & hospital workflows, admin verifications, and audit logging:

```bash
# Inside Docker container
docker exec mediclaim-backend python -m unittest discover -s tests

# Or locally (from backend directory)
python -m unittest discover -s tests
```

### Frontend Typecheck, Lint & Build
```bash
# From frontend directory
npm run build   # TypeScript compilation (tsc -b) & Vite bundle
npm run lint    # Oxlint code quality verification
```

---

## 📁 Directory Layout

```
Mediclaim/
├── .env.example             # Environment variable template
├── docker-compose.yml       # Docker stack (postgres, backend, frontend)
├── README.md                # Project documentation
│
├── backend/                 # FastAPI backend application
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── config.py        # Centralized settings & environment variables
│   │   ├── database.py      # PostgreSQL connection pooling & auto-migrations
│   │   ├── security.py      # JWT authentication, hashing, roles & helpers
│   │   ├── exceptions.py    # RFC 9457 Problem Details error handling
│   │   ├── main.py          # FastAPI application factory & router registration
│   │   ├── routes/          # API endpoint routers
│   │   │   ├── auth.py          # Patient registration, login, OTP
│   │   │   ├── patients.py      # Patient profile & emergency contacts
│   │   │   ├── records.py       # CRUD for conditions, allergies, vitals, vaccines
│   │   │   ├── timeline.py      # Medical timeline & graph data endpoints
│   │   │   ├── consent.py       # Consent management & caregiver access
│   │   │   ├── doctor.py        # Doctor portal endpoints
│   │   │   ├── hospital.py      # Hospital management & practitioner onboarding
│   │   │   ├── admin.py         # Administrator portal endpoints
│   │   │   ├── emergency.py     # Emergency break-glass override
│   │   │   ├── audit.py         # Tamper-evident audit trail
│   │   │   ├── corrections.py   # Record correction requests
│   │   │   └── uploads.py       # Prescription & report document uploads
│   │   ├── schemas/         # Pydantic v2 validation models
│   │   └── services/        # Business logic & database operations
│   └── tests/               # Backend unittest test suites
│       ├── test_auth.py
│       ├── test_patients.py
│       ├── test_records.py
│       ├── test_timeline.py
│       ├── test_consent.py
│       ├── test_doctor_hospital.py
│       ├── test_admin.py
│       └── test_emergency_audit_corrections.py
│
├── frontend/                # React 19 + TypeScript + Vite frontend
│   ├── Dockerfile
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── App.tsx          # Client routing & portal layouts
│       ├── main.tsx         # Application entry point
│       ├── api/             # Typed API client functions
│       ├── components/      # Reusable UI components & modals
│       │   ├── graph/           # ReactFlow health graph flow & nodes
│       │   ├── records/         # Record details, manual entry modals
│       │   ├── doctor/          # Doctor record entry modal
│       │   └── dashboard/       # Dashboard widgets, stats, uploader
│       ├── pages/           # Page views for all portals
│       │   ├── Auth.tsx         # Patient, Doctor & Hospital login/register
│       │   ├── Dashboard.tsx    # Patient overview & health graph
│       │   ├── Records.tsx      # Patient clinical records view
│       │   ├── Timeline.tsx     # Longitudinal timeline view
│       │   ├── Access.tsx       # Consent & caregiver management
│       │   ├── doctor/          # Doctor portal views
│       │   ├── hospital/        # Hospital portal views
│       │   └── admin/           # Administrator portal views
│       └── store/           # HealthData React context provider
│
└── infra/                   # Infrastructure configuration & seed scripts
    └── db/
        └── 001_schema.sql   # PostgreSQL baseline DDL
```
