# Interoperability: HL7 FHIR R4 Mapping Specification

## 1. Introduction
Mediclaim standardizes health data interchange using Health Level Seven (HL7) Fast Healthcare Interoperability Resources (FHIR) Release 4.0.1.

## 2. Resource Mapping Catalog

### 2.1 Patient (`Patient`)
Maps `patient_profiles` to FHIR `Patient`:

| Mediclaim Field | FHIR R4 Path | Data Type | Notes |
|---|---|---|---|
| `mediclaim_id` | `Patient.identifier[0].value` | String | System: `urn:mediclaim:id` |
| `full_name` | `Patient.name[0].text` | String | Official full legal name |
| `date_of_birth` | `Patient.birthDate` | Date | Format: `YYYY-MM-DD` |
| `gender` | `Patient.gender` | Code | `male`, `female`, `other` |
| `phone` | `Patient.telecom[0].value` | String | System: `phone`, use: `mobile` |
| `address` | `Patient.address[0].text` | String | Residential address |

### 2.2 Condition (`Condition`)
Maps `conditions` to FHIR `Condition`:

| Mediclaim Field | FHIR R4 Path | Data Type | Notes |
|---|---|---|---|
| `condition_name` | `Condition.code.text` | String | Clinical diagnosis / term |
| `status` | `Condition.clinicalStatus` | CodeableConcept | `active`, `resolved`, `inactive` |
| `severity` | `Condition.severity.text` | String | e.g. `mild`, `moderate`, `severe` |
| `onset_date` | `Condition.onsetDateTime` | DateTime | Clinical onset date |
| `resolved_date` | `Condition.abatementDateTime`| DateTime | Clinical resolution date |
| `provider` | `Condition.recorder.display` | String | Recording physician / clinic |

### 2.3 Allergy Intolerance (`AllergyIntolerance`)
Maps `allergies` to FHIR `AllergyIntolerance`:

| Mediclaim Field | FHIR R4 Path | Data Type | Notes |
|---|---|---|---|
| `allergen` | `AllergyIntolerance.code.text`| String | Substance / agent |
| `category` | `AllergyIntolerance.category` | Code | `food`, `medication`, `environment` |
| `criticality` | `AllergyIntolerance.criticality`| Code | `low`, `high`, `unable-to-assess` |
| `reaction` | `AllergyIntolerance.reaction[0].manifestation[0].text` | String | Clinical manifestation |
| `severity` | `AllergyIntolerance.reaction[0].severity` | Code | `mild`, `moderate`, `severe` |

### 2.4 Medication (`MedicationStatement`)
Maps `medications` to FHIR `MedicationStatement`:

| Mediclaim Field | FHIR R4 Path | Data Type | Notes |
|---|---|---|---|
| `medication_name` | `MedicationStatement.medicationCodeableConcept.text` | String | Drug trade or generic name |
| `dosage` | `MedicationStatement.dosage[0].text` | String | Quantity & administration form |
| `instructions` | `MedicationStatement.dosage[0].patientInstruction` | String | e.g. "Take after food" |
| `start_date` | `MedicationStatement.effectivePeriod.start` | DateTime | Regimen commencement |
| `end_date` | `MedicationStatement.effectivePeriod.end` | DateTime | Regimen conclusion |
| `status` | `MedicationStatement.status` | Code | `active`, `completed`, `stopped` |

### 2.5 Immunization (`Immunization`)
Maps `vaccinations` to FHIR `Immunization`:

| Mediclaim Field | FHIR R4 Path | Data Type | Notes |
|---|---|---|---|
| `vaccine_name` | `Immunization.vaccineCode.text`| String | Vaccine formulation |
| `dose_number` | `Immunization.protocolApplied[0].doseNumberPositiveInt` | PositiveInt | e.g. 1, 2, 3 |
| `batch_number` | `Immunization.lotNumber` | String | Manufacturer lot identifier |
| `administered_date` | `Immunization.occurrenceDateTime` | DateTime | Injection administration date |

### 2.6 Consent (`Consent`)
Maps `patient_access_grants` to FHIR `Consent`:

| Mediclaim Field | FHIR R4 Path | Data Type | Notes |
|---|---|---|---|
| `id` | `Consent.id` | Id | Unique grant UUID |
| `patient_id` | `Consent.patient.reference` | Reference | `Patient/{patient_id}` |
| `grantee_user_id`| `Consent.actor[0].reference` | Reference | `Practitioner/{doctor_id}` |
| `scope` | `Consent.provision.action` | CodeableConcept | e.g. `medication`, `condition` |
| `valid_from` | `Consent.provision.period.start` | DateTime | Grant commencement |
| `expires_at` | `Consent.provision.period.end` | DateTime | Grant expiration |
