# Mediclaim Frontend Application

> **React 19 Single Page Application for Longitudinal Health Records & Unified Medical Graph**

---

## Table of Contents

1. [Overview & Architectural Principles](#1-overview--architectural-principles)
2. [Application Routing Table](#2-application-routing-table)
   - [Public & Onboarding Routes](#public--onboarding-routes)
   - [Patient Portal Routes (`/app`)](#patient-portal-routes-app)
   - [Practitioner Routes (`/app/doctor`)](#practitioner-routes-appdoctor)
   - [Healthcare Organization Routes (`/app/hospital`)](#healthcare-organization-routes-apphospital)
   - [Administrator Routes (`/admin`)](#administrator-routes-admin)
3. [Key Features & Clinical Workflows](#3-key-features--clinical-workflows)
   - [Lifelong Medical Timeline & Birth Milestone Anchor](#lifelong-medical-timeline--birth-milestone-anchor)
   - [Interactive Health Graph Flow (`@xyflow/react`)](#interactive-health-graph-flow-xyflowreact)
   - [Multimodal Document Ingestion & Verification (`PrescriptionUploader`)](#multimodal-document-ingestion--verification-prescriptionuploader)
   - [Granular Access Governance & Real-Time Countdown](#granular-access-governance--real-time-countdown)
   - [Emergency Break-Glass Audit Feeds](#emergency-break-glass-audit-feeds)
4. [State Architecture & Data Synchronization](#4-state-architecture--data-synchronization)
   - [The HealthDataProvider Context Store](#the-healthdataprovider-context-store)
   - [Backend Hydration & Offline LocalStorage Fallback](#backend-hydration--offline-localstorage-fallback)
   - [Dynamic Grant Expiration Engine](#dynamic-grant-expiration-engine)
5. [UI System & Design Tokens](#5-ui-system--design-tokens)
6. [Developer Scripts & Local Workflow](#6-developer-scripts--local-workflow)

---

## 1. Overview & Architectural Principles

The Mediclaim frontend is built with **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Vite 8**. It implements an HL7 FHIR-aligned health record interface designed for low latency, high accessibility, and seamless desktop/mobile responsiveness.

### Design Principles
- **Privacy & Sovereignty by Default**: The interface never displays unauthorized records. All clinical data is partitioned by approved scope permissions.
- **Fail-Safe Offline Hydration**: If the backend is temporarily unreachable, the frontend automatically falls back to authenticated cached state in `localStorage` without crashing.
- **Zero Raw Aadhaar Exposure**: Only citizen names, 12-digit Mediclaim IDs, and masked references are rendered.
- **Optimized Graph Bundling**: Large graph libraries (`@xyflow/react` and `d3-hierarchy`) are code-split and loaded on-demand via `React.lazy` when navigating to the Graph tab.

---

## 2. Application Routing Table

All routes are configured in [`frontend/src/App.tsx`](file:///Users/sreejan/Codes/Mediclaim/frontend/src/App.tsx) using React Router v7.

### Public & Onboarding Routes

| Route | Page Component | Access | Description |
|---|---|---|---|
| `/` | `Landing.tsx` | Public | Marketing homepage, platform principles, and portal navigation |
| `/login` | `Login.tsx` | Public | Authentication screen accepting 12-digit Mediclaim ID and password |
| `/register` | `Register.tsx` | Public | Citizen registration form (Name, DOB, Phone, Aadhaar, Password) |
| `/verify-otp` | `VerifyOTP.tsx` | Public | Phone OTP verification screen following registration |

### Patient Portal Routes (`/app`)

| Route | Page Component | Access | Description |
|---|---|---|---|
| `/app` | `Dashboard.tsx` | Patient | Patient home: Summary stats, prescriptions, allergies, timeline preview, quick links |
| `/app/timeline` | `Timeline.tsx` | Patient | Full chronological lifelong timeline and interactive health graph view |
| `/app/records` | `Records.tsx` | Patient | Searchable master clinical directory with category chips and correction requests |
| `/app/access` | `Access.tsx` | Patient | Consent governance: review doctor access requests, active grants, caregivers, audit trail |

### Practitioner Routes (`/app/doctor`)

| Route | Page Component | Access | Description |
|---|---|---|---|
| `/app/doctor` | `DoctorDashboard.tsx` | Doctor | Practitioner home: active consultations, pending requests, patient roster |
| `/app/doctor/request-access` | `DoctorRequestAccess.tsx` | Doctor | Search patient by Mediclaim ID, select scopes/duration, trigger OTP or Break-Glass |
| `/app/doctor/patients/:mediclaimId`| `DoctorPatientDetail.tsx`| Doctor | Longitudinal patient records view (only approved scopes) and clinical data entry |
| `/app/doctor/access-history` | `DoctorAccessHistory.tsx` | Doctor | Audit log of all completed patient consultation sessions |

### Healthcare Organization Routes (`/app/hospital`)

| Route | Page Component | Access | Description |
|---|---|---|---|
| `/app/hospital` | `HospitalDashboard.tsx` | Hospital | Hospital desk: patient census, departmental stats, and emergency triage |
| `/app/hospital/practitioners` | `HospitalPractitioners.tsx`| Hospital | Staff directory: onboard physicians, verify medical licenses and designations |
| `/app/hospital/patients` | `HospitalPatients.tsx` | Hospital | Directory of all patients with active consent granted to the hospital |

### Administrator Routes (`/admin`)

| Route | Page Component | Access | Description |
|---|---|---|---|
| `/admin` | `AdminDashboard.tsx` | Admin | Real-time platform KPI metrics (users, verifications, doctors, hospitals, overrides) |
| `/admin/verifications` | `AdminVerifications.tsx` | Admin | User verification lifecycle with "Pending", "Verified", and "All" tabs + detail modal |
| `/admin/patients` | `AdminPatients.tsx` | Admin | Master patient directory with search, pagination, and user profile detail modal |
| `/admin/practitioners` | `AdminPractitioners.tsx`| Admin | Master doctor directory with search, hospital filtering, and profile detail modal |
| `/admin/organizations` | `AdminOrganizations.tsx`| Admin | Healthcare organizations directory: hospitals, clinics, diagnostic centers |
| `/admin/emergency` | `AdminEmergency.tsx` | Admin | Real-time global feed of all emergency break-glass overrides with justification notes |

---

## 3. Key Features & Clinical Workflows

### Lifelong Medical Timeline & Birth Milestone Anchor
- **Day 0 Origin**: Every timeline begins at the patient's birth date entered during registration (`profile.dateOfBirth`).
- **Missing Certificate Reminders**: If no official certificate has been uploaded, an amber `Missing certificate` badge is displayed alongside clinical hints:
  > 💡 *Upload your birth certificate, maternity card, or neonatal vaccinations like Hepatitis B (birth dose) and BCG.*
- **Automated Merging**: When a user uploads a birth certificate or enters a manual birth record, the system strictly matches the event date against `profile.dateOfBirth`. Upon matching, it merges into the birth anchor milestone, sets `hasCertificate: true`, attaches the document preview, and clears the missing badge.

### Interactive Health Graph Flow (`@xyflow/react`)
- Located on `/app/timeline` under the **Graph** tab.
- Renders the patient at the center node with birth year and name.
- Connects to five color-coded category nodes (Allergies, Conditions, Medicines, Vaccinations, Reports).
- Supports dynamic switching between **Radial Graph Layout** and **Hierarchical Tree Layout** via D3 hierarchy.
- Wrapped in a React `GraphErrorBoundary` to guarantee that rendering anomalies never crash the surrounding page.

### Multimodal Document Ingestion & Verification (`PrescriptionUploader`)
- Located in [`frontend/src/components/dashboard/PrescriptionUploader.tsx`](file:///Users/sreejan/Codes/Mediclaim/frontend/src/components/dashboard/PrescriptionUploader.tsx).
- Accepts PDF, PNG, JPEG, and WEBP files up to 10 MB.
- Sends files to the backend for multimodal processing by Google DeepMind's Gemini 3 Flash model.
- Displays an animated loading spinner and live document preview while Gemini extracts clinical entities.
- Presents an editable verification form (Conditions, Medications, Vaccinations, Allergies, Lab Reports) before writing to the database.
- Features a graceful **"Failed to extract data, upload anyway"** manual fallback mode ensuring no file upload is blocked.

### Granular Access Governance & Real-Time Countdown
- Patients can review pending access requests from doctors and specify authorized scopes (`allergy`, `condition`, `medication`, `vaccination`, `report`).
- Each active grant shows a live countdown timer.
- Patients can click **Revoke** at any moment, which immediately invalidates the doctor's JWT grant token on the backend.

### Emergency Break-Glass Audit Feeds
- Emergency physicians can execute emergency overrides during trauma resuscitations.
- Overrides immediately log immutable audit events viewable by the patient on `/app/access` and by administrators on `/admin/emergency`.

---

## 4. State Architecture & Data Synchronization

### The HealthDataProvider Context Store
Located in [`frontend/src/store/HealthDataProvider.tsx`](file:///Users/sreejan/Codes/Mediclaim/frontend/src/store/HealthDataProvider.tsx).
- Custom React context providing unified state management across the application:
  - `profile`: Demographics, blood group, address, emergency contact, DOB.
  - `events`: Consolidated longitudinal health events (sorted chronologically).
  - `prescriptions`: Active and past digital prescriptions.
  - `grants`: Active doctor access grants with expiration timestamps.
  - `requests`: Pending access requests from doctors.
  - `caregivers`: Authorized family caregiver delegations.
  - `audit`: Local access audit trail.
  - `corrections`: Medical record correction requests.

### Backend Hydration & Offline LocalStorage Fallback
- Upon application load, `syncFromBackend()` triggers parallel asynchronous queries to `/api/v1/patients/me`, `/records`, `/prescriptions`, `/consent/grants`, and `/audit`.
- If authenticated, data is populated directly into state.
- If offline or unauthenticated, state restores seamlessly from `localStorage` (`mediclaim_patient_data`), enabling full offline demos.

### Dynamic Grant Expiration Engine
- `HealthDataProvider` calculates the nearest grant expiration (`nextExpiry`).
- Sets a precise native `setTimeout` that automatically triggers a `grant/expire` reducer dispatch the millisecond a grant expires, removing the doctor's access in real time without polling.

---

## 5. UI System & Design Tokens

Mediclaim uses Tailwind CSS v4 with bespoke clinical design tokens:
- `--color-brand`: Medical sapphire primary (`#0055ff` / `#0040cc`)
- `--color-brand-tint`: Soft sapphire background tint
- `--color-mist`: Clean, sterile clinical grey background
- `--color-line`: Subtle divider border
- `--color-ink`: High-contrast typography
- **Clinical Category Tokens**:
  - `allergy`: Amber / Crimson alert
  - `condition`: Sapphire heart blue
  - `medication`: Violet pharmacy purple
  - `vaccination`: Emerald syringe green
  - `report`: Golden laboratory yellow

---

## 6. Developer Scripts & Local Workflow

From the `frontend/` directory:

```bash
# Start local development server with Vite HMR
npm run dev

# Run Oxlint across all TypeScript files
npm run lint

# Compile TypeScript and build production bundle
npm run build

# Preview production build locally
npm run preview
```
