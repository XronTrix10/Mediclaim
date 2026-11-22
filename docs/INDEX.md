# Mediclaim Knowledge Base & Documentation Index

Welcome to the central technical documentation repository for the **Mediclaim** digital health records platform.

## 1. System Architecture & Standards
- [System Architecture Overview](architecture/SYSTEM_OVERVIEW.md) - High-level system topology, components, and core architectural invariants.
- [Dynamic Consent Engine Specification](architecture/CONSENT_ENGINE_SPEC.md) - Policy enforcement, time-bounded access, and scope delegation.
- [Multimodal Document Extraction Pipeline](architecture/DOCUMENT_EXTRACTION_PIPELINE.md) - Gemini AI OCR extraction, schema validation, and fallback mechanisms.
- [HL7 FHIR R4 Mapping Specification](compliance/HL7_FHIR_MAPPING_SPEC.md) - Standardized clinical resource mappings.

## 2. Security & Compliance
- [STRIDE Threat Model & Mitigations](security/THREAT_MODEL.md) - Systematic threat vector evaluation and defensive mitigations.
- [Encryption & Key Management Specification](security/ENCRYPTION_AND_KEY_MANAGEMENT.md) - Cryptographic standards, JWT policies, and password hashing.
- [HIPAA & GDPR Compliance Framework](compliance/HIPAA_GDPR_COMPLIANCE.md) - Health privacy safeguards, data portability, and right to erasure.

## 3. User & Operator Manuals
- [Patient Health Portal Operations Guide](guides/PATIENT_PORTAL_MANUAL.md) - Patient registration, document upload, and consent control.
- [Doctor Console & Clinical Review Guide](guides/DOCTOR_PORTAL_WORKFLOWS.md) - Requesting consent, clinical record review, and document inspection.
- [Hospital Organization Administration Playbook](guides/HOSPITAL_ADMIN_PLAYBOOK.md) - Healthcare facility onboarding, practitioner oversight, and governance.
- [Platform Administration & Governance Guide](guides/SYSTEM_ADMIN_OPERATIONS.md) - Institutional verification, entity removal, and platform oversight.

## 4. Operations, Infrastructure & Resilience
- [Production Deployment & Hardening Checklist](ops/DEPLOYMENT_CHECKLIST.md) - Pre-flight security verification and configuration checklist.
- [Disaster Recovery & Data Resiliency Runbook](ops/DISASTER_RECOVERY_RUNBOOK.md) - Backup routines, recovery objectives, and restore procedures.
- [Monitoring, Health Telemetry & Logging](ops/MONITORING_AND_OBSERVABILITY.md) - Health probes, audit log streaming, and anomaly alerting.

## 5. Quality Assurance & Performance
- [Testing Strategy & Test Pyramid](testing/TESTING_STRATEGY.md) - Automated unit, integration, schema validation, and security invariant tests.
- [Performance Benchmarks & Capacity Guidelines](testing/LOAD_AND_PERFORMANCE_BENCHMARKS.md) - Latency SLOs, connection pooling, and indexing strategy.

## 6. Database & API References
- [Relational Database Data Dictionary](database/DATA_DICTIONARY.md) - Entity specifications, column constraints, and foreign key cascades.
- [Immutable Audit Trail Specification](database/AUDIT_TRAIL_SPECIFICATION.md) - Append-only audit logging and action taxonomy.
- [Standardized API Error Codes Reference](api/ERROR_CODES_REFERENCE.md) - Machine-readable error codes and client handling guidance.
