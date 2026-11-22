# FHIR R4 Clinical Encounter Profile & Lifecycle Specification

## 1. Overview and Scope

The clinical encounter resource represents an interaction between a patient and healthcare practitioner(s) for the purpose of providing healthcare services or assessing the health status of a patient. This specification defines the structural rules, status transition state machine, and data dictionary bindings for all clinical encounters recorded in Mediclaim.

### Conformance Baseline
- **FHIR Resource:** `Encounter`
- **FHIR Version:** R4 (v4.0.1)
- **Profile URI:** `http://mediclaim.org/fhir/StructureDefinition/mediclaim-encounter`
- **Classifications:** Ambulatory (`AMB`), Emergency (`EMER`), Inpatient (`IMP`), Telehealth (`VR`)

---

## 2. Encounter Status State Machine

The lifecycle of an encounter proceeds through the following deterministic states:

```
[Planned]
   |
   v
[Arrived] ---------> [Cancelled]
   |
   v
[Triaged]
   |
   v
[In-Progress] ------> [On-Leave]
   |                     |
   v                     v
[Finished] <-------------+
```

### State Transition Matrix

| Current State | Permitted Transitions | Trigger Event | Audit Action |
|:--------------|:----------------------|:--------------|:-------------|
| `planned` | `arrived`, `cancelled` | Check-in or patient cancellation | `ENCOUNTER_SCHEDULE` |
| `arrived` | `triaged`, `cancelled` | Nurse triage desk intake | `TRIAGE_CHECKIN` |
| `triaged` | `in-progress`, `cancelled` | Physician exam room admission | `EXAM_INITIATION` |
| `in-progress` | `on-leave`, `finished` | Bed transfer, diagnostic release | `CLINICAL_ACTIVE` |
| `on-leave` | `in-progress`, `finished` | Return from external imaging | `LEAVE_TRANSITION` |
| `finished` | *Terminal State* | Discharge summary sign-off | `ENCOUNTER_ARCHIVE` |
| `cancelled` | *Terminal State* | Formal cancellation notice | `ENCOUNTER_CANCEL` |

---

## 3. Data Dictionary & Attribute Mapping

| Database Field | Type | FHIR Element | Cardinality | Value Set Binding |
|:---------------|:-----|:-------------|:------------|:------------------|
| `encounters.id` | `UUID` | `Encounter.id` | `1..1` | UUID v4 |
| `encounters.patient_id` | `UUID` | `Encounter.subject.reference` | `1..1` | Patient Reference |
| `encounters.doctor_id` | `UUID` | `Encounter.participant.individual` | `1..*` | Practitioner Reference |
| `encounters.hospital_id`| `UUID` | `Encounter.serviceProvider` | `1..1` | Organization Reference |
| `encounters.status` | `VARCHAR(32)` | `Encounter.status` | `1..1` | `EncounterStatus` |
| `encounters.class_code`| `VARCHAR(16)` | `Encounter.class.code` | `1..1` | `ActEncounterCode` |
| `encounters.start_time`| `TIMESTAMPTZ`| `Encounter.period.start` | `1..1` | ISO-8601 UTC |
| `encounters.end_time` | `TIMESTAMPTZ`| `Encounter.period.end` | `0..1` | ISO-8601 UTC |
| `encounters.reason` | `TEXT` | `Encounter.reasonCode.text` | `0..*` | SNOMED CT / ICD-10 |

---

## 4. Participant Roles & Care Team Composition

```yaml
participant_types:
  admitting_physician:
    code: "ADM"
    system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType"
    display: "Admitting Physician"
    responsibilities: "Initial intake authorization, bed allocation"
  attending_physician:
    code: "ATND"
    system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType"
    display: "Attending Physician"
    responsibilities: "Primary diagnostic orders, treatment plan"
  consulting_specialist:
    code: "CON"
    system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType"
    display: "Consulting Physician"
    responsibilities: "Specialty evaluation (Cardiology, Neurology)"
  primary_nurse:
    code: "NURSE"
    system: "http://mediclaim.org/codes/roles"
    display: "Triage / Primary Care Nurse"
    responsibilities: "Vital signs, medication administration"
```

---

## 5. Canonical FHIR JSON Instance

```json
{
  "resourceType": "Encounter",
  "id": "e4b2d189-9a01-4c77-b892-d3f4e5a6b7c8",
  "meta": {
    "profile": ["http://mediclaim.org/fhir/StructureDefinition/mediclaim-encounter"]
  },
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "AMB",
    "display": "ambulatory"
  },
  "type": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "185349003",
          "display": "Encounter for check up"
        }
      ]
    }
  ],
  "subject": {
    "reference": "Patient/7f8b91a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
    "display": "Rahul Kumar Sharma"
  },
  "participant": [
    {
      "type": [
        {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
              "code": "ATND",
              "display": "attender"
            }
          ]
        }
      ],
      "individual": {
        "reference": "Practitioner/d290f1ee-6c54-4b01-90e6-d701748f0851",
        "display": "Dr. Ananya Roy, MD"
      }
    }
  ],
  "period": {
    "start": "2026-11-21T09:00:00Z",
    "end": "2026-11-21T09:45:00Z"
  },
  "serviceProvider": {
    "reference": "Organization/c1029384-5f6e-7d8c-9b0a-112233445566",
    "display": "Apollo Multispecialty Hospital"
  }
}
```

---

## 6. Implementation Notes & Audit Rules

- **Timestamp Monotonicity:** `period.end` must be strictly equal to or after `period.start`.
- **Concurrency Locking:** In-progress updates utilize optimistic locking via `ETag` and version ID headers.
- **Access Control:** Doctors require explicit patient consent grants or an authorized hospital session to view active encounters.
