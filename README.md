# Mediclaim

## About
Mediclaim is a web application that helps people store and manage their complete medical history in one place.
Instead of keeping paper prescriptions and medical reports, users can maintain their health records digitally and access them whenever needed.

## Features
- Store medical history, diseases, and allergies.
- Manage prescriptions and medications.
- Maintain vaccination records.
- Upload and access medical reports.
- View medical history in chronological order.
- Share medical records securely with authorized doctors.

## Technologies Used
- Frontend: React
- Backend: Python FastAPI
- Database: PostgreSQL
- Healthcare Data Standard: HL7 FHIR (planned)

## Project Goal
To make medical records easy to store, access, and manage throughout a person's lifetime.

## Project Status
Currently in the planning and initial development phase.

## Directory structure:

```
mediclaim/
├── docker-compose.yml          # postgres, redis, minio, (later: keycloak, opa, vault)
├── .env.example
├── Makefile                    # shortcuts: make up, make test, make migrate
├── README.md
│
├── docs/
│   ├── architecture.md
│   ├── threat-model.md         # start early, grow as you build
│   ├── fhir-mapping.md         # which FHIR resource holds what
│   └── api-contract.md
│
├── infra/
│   ├── nginx/
│   ├── keycloak/               # realm export (added later)
│   ├── opa/policies/           # .rego consent policies (added later)
│   └── vault/
│
├── backend/
│   ├── pyproject.toml          # or requirements.txt
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/versions/       # DB migrations
│   ├── app/
│   │   ├── main.py             # FastAPI entry point
│   │   ├── core/
│   │   │   ├── config.py       # settings from env (pydantic-settings)
│   │   │   ├── database.py     # SQLAlchemy engine/session
│   │   │   ├── security.py     # JWT, password hashing (Argon2)
│   │   │   └── deps.py         # current_user, require_role dependencies
│   │   ├── crypto/
│   │   │   ├── envelope.py     # AES-256-GCM encrypt/decrypt
│   │   │   ├── key_manager.py  # per-patient data keys, wrap/unwrap
│   │   │   └── kms/            # local_kms.py now, vault_kms.py later
│   │   ├── models/             # SQLAlchemy tables
│   │   │   ├── user.py
│   │   │   ├── fhir_resource.py
│   │   │   ├── consent.py
│   │   │   ├── audit_log.py
│   │   │   └── patient_key.py
│   │   ├── schemas/            # request/response Pydantic models
│   │   ├── fhir/
│   │   │   ├── validators.py   # validate with fhir.resources
│   │   │   ├── mappers.py      # extracted data → FHIR resources
│   │   │   └── terminology/    # ICD-10, LOINC, RxNorm lookup files
│   │   ├── api/v1/
│   │   │   ├── auth.py
│   │   │   ├── patients.py
│   │   │   ├── records.py      # CRUD on FHIR resources
│   │   │   ├── consent.py      # request/approve/revoke access
│   │   │   ├── timeline.py     # aggregated view for the graph
│   │   │   ├── uploads.py      # prescription/report upload
│   │   │   ├── audit.py
│   │   │   ├── corrections.py
│   │   │   └── emergency.py    # break-glass endpoint
│   │   ├── services/           # business logic (keep routers thin)
│   │   │   ├── record_service.py
│   │   │   ├── consent_service.py
│   │   │   ├── audit_service.py
│   │   │   └── timeline_service.py
│   │   ├── ingestion/
│   │   │   ├── preprocess.py   # OpenCV deskew/denoise
│   │   │   ├── ocr.py
│   │   │   ├── extractor.py    # LLM structured extraction
│   │   │   ├── normalizer.py   # drug/lab name → standard codes
│   │   │   └── tasks.py        # Celery tasks
│   │   ├── safety/
│   │   │   ├── interactions.py
│   │   │   ├── duplicates.py
│   │   │   ├── vaccination.py  # IAP/UIP schedule
│   │   │   └── lab_trends.py
│   │   └── workers/celery_app.py
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── security/           # access-control and tamper tests
│
├── frontend/                   # created by Vite
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                # axios client + typed API calls
│       ├── auth/               # login, token handling, route guards
│       ├── components/         # shared UI
│       ├── features/
│       │   ├── timeline/       # vis-timeline view
│       │   ├── graph/          # React Flow / Cytoscape view
│       │   ├── records/
│       │   ├── upload/         # upload + review-extracted-fields screen
│       │   ├── consent/        # approve/revoke access UI
│       │   ├── audit/
│       │   └── emergency/
│       ├── hooks/
│       ├── store/              # Zustand or Redux Toolkit
│       └── types/              # TypeScript FHIR types
│
├── evaluation/                 # for your report's quantitative results
│   ├── datasets/               # labelled prescription samples
│   ├── ocr_eval.py
│   └── notebooks/
│
└── scripts/
    ├── seed_demo_data.py
    └── generate_keys.py

```
