# Mediclaim — Longitudinal Health Record & Unified Graph Platform

> **A sovereign, lifelong digital medical record system conforming to HL7 FHIR principles, featuring interactive health graph visualization, multimodal AI document extraction with Google Gemini 3, granular patient-consent governance, clinical encounter workflows, and administrative verifications.**

---

## 📸 Platform Overview

<!-- SCREENSHOT PLACEHOLDER: Insert an overview screenshot of the Mediclaim Dashboard and Health Graph below -->
![Mediclaim Platform Dashboard and Health Graph Flow](docs/screenshots/dashboard.png)
*Figure 1: Mediclaim Dashboard featuring the Lifelong Timeline anchored at birth, Multimodal AI Extraction with live document preview, Active Consent Countdown, and Interactive D3 Health Graph.*

---

## 🌟 Executive Summary

### 1. What It Is
**Mediclaim** is an open-standard, citizen-first digital health record platform designed to unify an individual's entire medical history from birth onwards. It solves the fragmentation of paper prescriptions, disparate hospital records, and disconnected clinic visits by issuing every citizen a standardized, verifiable **12-digit Mediclaim ID** (e.g. `4821 9306 1175`) completely independent of their national identity number.

### 2. What It Does
- **Anchors Lifelong History at Birth**: The timeline automatically begins at the citizen's registered date of birth ("Day 0"). If an official birth certificate is not yet attached, clear clinical recommendations guide the citizen to upload neonatal records (such as BCG and Hepatitis B birth dose). When uploaded, records matching the birth date merge automatically into the primary birth milestone.
- **Extracts Medical Documents with Multimodal AI**: Incorporates Google DeepMind's Gemini 3 Flash model to read doctor handwriting, clinical discharge notes, immunization cards, and lab printouts (PDF, PNG, JPEG, WEBP). It extracts structured medications, doses, diagnoses, and lab values, presenting an editable side-by-side verification screen with live preview before saving, with a manual "Upload anyway" fallback mode.
- **Visualizes Health Journeys as an Interactive Graph**: Maps illnesses, allergies, medications, procedures, and test results into an interactive node-edge graph powered by `@xyflow/react` and D3 hierarchy, switchable between radial and hierarchical tree layouts.
- **Enforces Sovereign Patient Consent**: Doctors have zero default access to patient records. Patients grant explicit, time-bounded (e.g. 1 hour, 8 hours, 24 hours), scoped (`allergies`, `medications`, `conditions`, `vaccinations`, `reports`) access via OTP verification, with the ability to instantly revoke access at any second.
- **Provides Multi-Role Clinical Workflows**: Tailored portals for **Patients** (`/app`), **Physicians** (`/app/doctor`), **Hospital Desks** (`/app/hospital`), and **Platform Administrators** (`/admin`), including emergency break-glass protocols for critical care and tamper-evident immutable audit logs.

### 3. How It Does It
- **Frontend**: Built with **React 19**, **TypeScript**, and **Tailwind CSS v4** bundled via **Vite 8**. State is managed through a central `HealthDataProvider` context store that synchronizes with the REST backend and gracefully falls back to cached local storage during offline demonstrations.
- **Backend**: Built with **Python 3.12+** and **FastAPI**, employing **Pydantic v2** for strict schema validation. It features a fail-safe Gemini 3 model fallback cascade (`gemini-3-flash-preview` → `gemini-3.5-flash-lite` → `gemini-flash-latest`) and validates API keys on startup.
- **Database & Storage**: Powered by **PostgreSQL 16** with the `pgcrypto` extension for UUIDs and cryptography, managed through a threaded connection pool. A database-level PL/pgSQL trigger prevents mutations or deletions of audit history. Uploaded documents are saved with sanitized paths, SHA-256 checksums, and streamed exclusively through authenticated preview endpoints.
- **Containerization**: Coordinated via **Docker Compose**, running `postgres`, `mediclaim-backend`, and `mediclaim-frontend` with persistent volumes and health checks.

---

## 📚 Documentation Navigation

Mediclaim provides dedicated documentation tailored specifically for end users and software engineers:

| Document | Audience | Scope & Purpose |
|---|---|---|
| 📖 **[User Guide](USER_GUIDE.md)** | Patients, Doctors, Hospitals, Admins | Comprehensive walk-through of account registration, portals, timeline, document upload, consent governance, and emergency workflows (no backend/database internals). |
| 🛠️ **[Developer Guide](DEVELOPER_GUIDE.md)** | Software Engineers, DevOps, Contributors | Technical handbook covering system architecture, environment setup, Docker Compose, testing, security, and quality assurance. |
| 💻 **[Frontend Documentation](frontend/README.md)** | Frontend Developers & UI Engineers | Deep dive into React 19 architecture, routing table, component hierarchy, `@xyflow/react` graph flow, state hydration, and design tokens. |
| ⚙️ **[Backend API Reference](docs/BACKEND_API.md)** | Backend Developers & Integrators | Complete REST specification across all 13 modules, request/response JSON schemas, envelope conventions, and RFC 9457 error contracts. |
| 🗄️ **[Database Architecture](docs/DATABASE.md)** | Database Administrators & Engineers | Detailed PostgreSQL schema across all 28 tables, relationships, indexes, storage layer, immutability triggers, and complete DBML code for dbdiagram.io. |

---

## 📑 Master Table of Contents

The complete hierarchical directory of all headers across every Mediclaim documentation document:

### 1. User Guide ([`USER_GUIDE.md`](USER_GUIDE.md))
- [1. Introduction to Mediclaim](USER_GUIDE.md#1-introduction-to-mediclaim)
  - [What is Mediclaim?](USER_GUIDE.md#what-is-mediclaim)
  - [The 12-Digit Mediclaim ID](USER_GUIDE.md#the-12-digit-mediclaim-id)
  - [Privacy, Security & Patient Sovereignty](USER_GUIDE.md#privacy-security--patient-sovereignty)
- [2. Getting Started: Registration & Account Activation](USER_GUIDE.md#2-getting-started-registration--account-activation)
  - [Step 1: Patient Registration](USER_GUIDE.md#step-1-patient-registration)
  - [Step 2: Phone OTP Verification](USER_GUIDE.md#step-2-phone-otp-verification)
  - [Step 3: Administrator Verification & ID Activation](USER_GUIDE.md#step-3-administrator-verification--id-activation)
  - [Step 4: Signing In with Your Mediclaim ID](USER_GUIDE.md#step-4-signing-in-with-your-mediclaim-id)
- [3. Patient Portal (`/app`)](USER_GUIDE.md#3-patient-portal-app)
  - [Profile Completion & Emergency Contacts](USER_GUIDE.md#profile-completion--emergency-contacts)
  - [The Lifelong Timeline & Birth Milestone](USER_GUIDE.md#the-lifelong-timeline--birth-milestone)
    - [Birth Date as Foundational Origin](USER_GUIDE.md#birth-date-as-foundational-origin)
    - [Missing Certificate Indicators & Clinical Hints](USER_GUIDE.md#missing-certificate-indicators--clinical-hints)
    - [Uploading & Merging Your Birth Record](USER_GUIDE.md#uploading--merging-your-birth-record)
  - [AI Medical Document Ingestion (Gemini Multimodal OCR)](USER_GUIDE.md#ai-medical-document-ingestion-gemini-multimodal-ocr)
    - [Uploading Prescriptions and Scans](USER_GUIDE.md#uploading-prescriptions-and-scans)
    - [Live Document Preview & Structured Verification](USER_GUIDE.md#live-document-preview--structured-verification)
    - [Manual "Upload Anyway" Fallback](USER_GUIDE.md#manual-upload-anyway-fallback)
  - [Interactive Health Graph](USER_GUIDE.md#interactive-health-graph)
  - [All Records Directory & Search (`/app/records`)](USER_GUIDE.md#all-records-directory--search-apprecords)
  - [Requesting Medical Record Corrections](USER_GUIDE.md#requesting-medical-record-corrections)
  - [Access Control & Doctor Consent Governance (`/app/access`)](USER_GUIDE.md#access-control--doctor-consent-governance-appaccess)
    - [Reviewing & Approving Doctor Access Requests](USER_GUIDE.md#reviewing--approving-doctor-access-requests)
    - [Granular Scope Permissions & Time-Bounded Grants](USER_GUIDE.md#granular-scope-permissions--time-bounded-grants)
    - [Instant Access Revocation](USER_GUIDE.md#instant-access-revocation)
    - [Family Caregiver Delegation](USER_GUIDE.md#family-caregiver-delegation)
    - [Emergency Break-Glass Audit Trail](USER_GUIDE.md#emergency-break-glass-audit-trail)
- [4. Doctor & Practitioner Portal (`/app/doctor`)](USER_GUIDE.md#4-doctor--practitioner-portal-appdoctor)
  - [Practitioner Sign-In & Dashboard](USER_GUIDE.md#practitioner-sign-in--dashboard)
  - [Requesting Patient Access by Mediclaim ID](USER_GUIDE.md#requesting-patient-access-by-mediclaim-id)
  - [Patient OTP Authorization](USER_GUIDE.md#patient-otp-authorization)
  - [Consultation View & Longitudinal Record Inspection](USER_GUIDE.md#consultation-view--longitudinal-record-inspection)
  - [Recording Clinical Data](USER_GUIDE.md#recording-clinical-data)
  - [Emergency Break-Glass Override Protocol](USER_GUIDE.md#emergency-break-glass-override-protocol)
  - [Access Session History & Automatic Expiration](USER_GUIDE.md#access-session-history--automatic-expiration)
- [5. Healthcare Organization Portal (`/app/hospital`)](USER_GUIDE.md#5-healthcare-organization-portal-apphospital)
  - [Hospital Dashboard Overview](USER_GUIDE.md#hospital-dashboard-overview)
  - [Practitioner Directory & License Verification](USER_GUIDE.md#practitioner-directory--license-verification)
  - [Active Patient Roster](USER_GUIDE.md#active-patient-roster)
- [6. Administrator Portal (`/admin`)](USER_GUIDE.md#6-administrator-portal-admin)
  - [Executive Overview & Real-Time KPIs](USER_GUIDE.md#executive-overview--real-time-kpis)
  - [User Verification Lifecycle (`/admin/verifications`)](USER_GUIDE.md#user-verification-lifecycle-adminverifications)
    - [Pending, Verified, and All Tabs](USER_GUIDE.md#pending-verified-and-all-tabs)
    - [Search & Filter Criteria](USER_GUIDE.md#search--filter-criteria)
    - [User Demographics & Identity Inspection Modal](USER_GUIDE.md#user-demographics--identity-inspection-modal)
    - [Issuing & Activating Mediclaim IDs](USER_GUIDE.md#issuing--activating-mediclaim-ids)
  - [Patient Directory (`/admin/patients`)](USER_GUIDE.md#patient-directory-adminpatients)
  - [Practitioner Directory (`/admin/practitioners`)](USER_GUIDE.md#practitioner-directory-adminpractitioners)
  - [Healthcare Organizations (`/admin/organizations`)](USER_GUIDE.md#healthcare-organizations-adminorganizations)
  - [Emergency Break-Glass Audit & Clinical Adjudication (`/admin/emergency`)](USER_GUIDE.md#emergency-break-glass-audit--clinical-adjudication-adminemergency)
- [7. Frequently Asked Questions (FAQ)](USER_GUIDE.md#7-frequently-asked-questions-faq)

---

### 2. Developer & Contributor Guide ([`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md))
- [1. System Architecture & Component Topology](DEVELOPER_GUIDE.md#1-system-architecture--component-topology)
- [2. Technology Stack & Key Libraries](DEVELOPER_GUIDE.md#2-technology-stack--key-libraries)
- [3. Prerequisites & Development Environment Setup](DEVELOPER_GUIDE.md#3-prerequisites--development-environment-setup)
- [4. Running the Application](DEVELOPER_GUIDE.md#4-running-the-application)
  - [Method A: Docker Compose (Recommended)](DEVELOPER_GUIDE.md#method-a-docker-compose-recommended)
  - [Method B: Manual Local Setup](DEVELOPER_GUIDE.md#method-b-manual-local-setup)
- [5. Environment Variables Reference](DEVELOPER_GUIDE.md#5-environment-variables-reference)
- [6. Multimodal AI Document Parser Architecture (Gemini 3)](DEVELOPER_GUIDE.md#6-multimodal-ai-document-parser-architecture-gemini-3)
  - [Model Fallback Cascade](DEVELOPER_GUIDE.md#model-fallback-cascade)
  - [Startup Safety & Key Validation](DEVELOPER_GUIDE.md#startup-safety--key-validation)
  - [Structured Extraction Schema](DEVELOPER_GUIDE.md#structured-extraction-schema)
- [7. Testing, Linting & Quality Assurance](DEVELOPER_GUIDE.md#7-testing-linting--quality-assurance)
  - [Running Backend Unit Tests](DEVELOPER_GUIDE.md#running-backend-unit-tests)
  - [Running Frontend Typechecks & Vite Build](DEVELOPER_GUIDE.md#running-frontend-typechecks--vite-build)
  - [Running the Oxlint Linter](DEVELOPER_GUIDE.md#running-the-oxlint-linter)
- [8. Security Architecture & Implementation Details](DEVELOPER_GUIDE.md#8-security-architecture--implementation-details)
  - [Authentication & JWT Token Structure](DEVELOPER_GUIDE.md#authentication--jwt-token-structure)
  - [Granular Scoped Consent Middleware](DEVELOPER_GUIDE.md#granular-scoped-consent-middleware)
  - [Immutable Audit Trail Trigger](DEVELOPER_GUIDE.md#immutable-audit-trail-trigger)
  - [File Storage & Authenticated Preview Streaming](DEVELOPER_GUIDE.md#file-storage--authenticated-preview-streaming)
- [9. Documentation References](DEVELOPER_GUIDE.md#9-documentation-references)

---

### 3. Frontend Architecture ([`frontend/README.md`](frontend/README.md))
- [1. Overview & Architectural Principles](frontend/README.md#1-overview--architectural-principles)
- [2. Application Routing Table](frontend/README.md#2-application-routing-table)
  - [Public & Onboarding Routes](frontend/README.md#public--onboarding-routes)
  - [Patient Portal Routes (`/app`)](frontend/README.md#patient-portal-routes-app)
  - [Practitioner Routes (`/app/doctor`)](frontend/README.md#practitioner-routes-appdoctor)
  - [Healthcare Organization Routes (`/app/hospital`)](frontend/README.md#healthcare-organization-routes-apphospital)
  - [Administrator Routes (`/admin`)](frontend/README.md#administrator-routes-admin)
- [3. Key Features & Clinical Workflows](frontend/README.md#3-key-features--clinical-workflows)
  - [Lifelong Medical Timeline & Birth Milestone Anchor](frontend/README.md#lifelong-medical-timeline--birth-milestone-anchor)
  - [Interactive Health Graph Flow (`@xyflow/react`)](frontend/README.md#interactive-health-graph-flow-xyflowreact)
  - [Multimodal Document Ingestion & Verification (`PrescriptionUploader`)](frontend/README.md#multimodal-document-ingestion--verification-prescriptionuploader)
  - [Granular Access Governance & Real-Time Countdown](frontend/README.md#granular-access-governance--real-time-countdown)
  - [Emergency Break-Glass Audit Feeds](frontend/README.md#emergency-break-glass-audit-feeds)
- [4. State Architecture & Data Synchronization](frontend/README.md#4-state-architecture--data-synchronization)
  - [The HealthDataProvider Context Store](frontend/README.md#the-healthdataprovider-context-store)
  - [Backend Hydration & Offline LocalStorage Fallback](frontend/README.md#backend-hydration--offline-localstorage-fallback)
  - [Dynamic Grant Expiration Engine](frontend/README.md#dynamic-grant-expiration-engine)
- [5. UI System & Design Tokens](frontend/README.md#5-ui-system--design-tokens)
- [6. Developer Scripts & Local Workflow](frontend/README.md#6-developer-scripts--local-workflow)

---

### 4. Backend Engine ([`backend/README.md`](backend/README.md))
- [1. Overview & Capabilities](backend/README.md#1-overview--capabilities)
- [2. API Architecture & Module Map](backend/README.md#2-api-architecture--module-map)
- [3. Multimodal AI Document Parser (Gemini 3)](backend/README.md#3-multimodal-ai-document-parser-gemini-3)
- [4. Database Connection Pool & Migrations](backend/README.md#4-database-connection-pool--migrations)
- [5. Local Development Setup](backend/README.md#5-local-development-setup)
- [6. Running with Docker Compose](backend/README.md#6-running-with-docker-compose)
- [7. Running the Test Suite](backend/README.md#7-running-the-test-suite)
- [8. API Documentation & Full Specification](backend/README.md#8-api-documentation--full-specification)

---

### 5. Backend API Reference ([`docs/BACKEND_API.md`](docs/BACKEND_API.md))
- [1. Overview & Architectural Principles](docs/BACKEND_API.md#1-overview--architectural-principles)
- [2. Data Types, Enums & Formatting Conventions](docs/BACKEND_API.md#2-data-types-enums--formatting-conventions)
- [3. Authentication & Account Lifecycle (`/auth`)](docs/BACKEND_API.md#3-authentication--account-lifecycle-auth)
- [4. Patient Profile Management (`/patients`)](docs/BACKEND_API.md#4-patient-profile-management-patients)
- [5. Clinical Records & FHIR Resources (`/records`)](docs/BACKEND_API.md#5-clinical-records--fhir-resources-records)
- [6. Document Ingestion & File Storage (`/uploads` & `/documents`)](docs/BACKEND_API.md#6-document-ingestion--file-storage-uploads--documents)
  - [6.1 Upload Prescription / Medical Document & Trigger AI OCR](docs/BACKEND_API.md#61-upload-prescription--medical-document--trigger-ai-ocr)
  - [6.2 Check Document Parsing Status](docs/BACKEND_API.md#62-check-document-parsing-status)
  - [6.3 Commit Verified Extracted Document Payload](docs/BACKEND_API.md#63-commit-verified-extracted-document-payload)
  - [6.4 Stream Authenticated Document Inline Preview](docs/BACKEND_API.md#64-stream-authenticated-document-inline-preview)
  - [6.5 Download Document Binary](docs/BACKEND_API.md#65-download-document-binary)
- [7. Lifelong Timeline & Health Graph (`/timeline`)](docs/BACKEND_API.md#7-lifelong-timeline--health-graph-timeline)
- [8. Doctor Consent & Access Control (`/consent`)](docs/BACKEND_API.md#8-doctor-consent--access-control-consent)
- [9. Emergency Break-Glass Protocol (`/emergency`)](docs/BACKEND_API.md#9-emergency-break-glass-protocol-emergency)
- [10. Audit Logging & Clinical Corrections (`/audit` & `/corrections`)](docs/BACKEND_API.md#10-audit-logging--clinical-corrections-audit--corrections)
- [11. Administrator Portal & Verifications (`/admin`)](docs/BACKEND_API.md#11-administrator-portal--verifications-admin)
- [12. Doctor & Hospital Portal Access (`/doctor` & `/hospital`)](docs/BACKEND_API.md#12-doctor--hospital-portal-access-doctor--hospital)
- [13. Standard Error Responses & Status Codes](docs/BACKEND_API.md#13-standard-error-responses--status-codes)

---

### 6. Database Architecture ([`docs/DATABASE.md`](docs/DATABASE.md))
- [1. Architecture Overview & Design Principles](docs/DATABASE.md#1-architecture-overview--design-principles)
- [2. Storage Layer & File Persistence](docs/DATABASE.md#2-storage-layer--file-persistence)
- [3. Core Entity Schemas & Tables](docs/DATABASE.md#3-core-entity-schemas--tables)
  - [3.1 Identity, Users & Roles](docs/DATABASE.md#31-identity-users--roles)
  - [3.2 Healthcare Organizations & Practitioners](docs/DATABASE.md#32-healthcare-organizations--practitioners)
  - [3.3 Clinical Encounters & Central Records](docs/DATABASE.md#33-clinical-encounters--central-records)
  - [3.4 Specialized Clinical Resources (FHIR-Aligned)](docs/DATABASE.md#34-specialized-clinical-resources-fhir-aligned)
  - [3.5 Medical Documents, File Storage & AI Parsing](docs/DATABASE.md#35-medical-documents-file-storage--ai-parsing)
  - [3.6 Patient Consent, Granular Access Grants & Caregivers](docs/DATABASE.md#36-patient-consent-granular-access-grants--caregivers)
  - [3.7 Audit Trails, Emergency Overrides & Corrections](docs/DATABASE.md#37-audit-trails-emergency-overrides--corrections)
- [4. Indexes & Performance Optimizations](docs/DATABASE.md#4-indexes--performance-optimizations)
- [5. Database Security & Immutability Triggers](docs/DATABASE.md#5-database-security--immutability-triggers)
- [6. Complete DBML Specification (for dbdiagram.io)](docs/DATABASE.md#6-complete-dbml-specification-for-dbdiagramio)
