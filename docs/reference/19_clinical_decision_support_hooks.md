# Clinical Decision Support (CDS) Hooks & SMART on FHIR Specifications

## 1. Executive Summary

Clinical Decision Support (CDS) Hooks is an HL7 specification for launching clinical decision support services from electronic health record (EHR) systems during normal clinical workflows. Mediclaim integrates CDS Hooks 1.0 to surface real-time guidance to physicians at point of care.

---

## 2. Supported CDS Hook Triggers

| Hook Name | EHR Workflow Trigger Point | Context Payload | Common Clinical Intent |
|:----------|:---------------------------|:----------------|:-----------------------|
| `patient-view` | Clinician opens a patient chart | `patientId`, `userId` | Preventive screening reminders, missing data alerts |
| `order-select` | Clinician selects a drug or test order | `patientId`, `selections` | Drug-allergy check, duplicate test warning |
| `order-sign` | Clinician prepares to sign active orders | `patientId`, `draftOrders` | Drug-drug interaction, renal dose adjustment |
| `encounter-start`| Clinician initiates encounter | `encounterId`, `patientId` | Protocol adherence checks, triage alerts |
| `encounter-discharge`| Clinician finalizes discharge | `encounterId`, `patientId` | Follow-up appointment scheduling, discharge checklist |

---

## 3. CDS Card Types & Structure

A CDS response returns a set of actionable cards:

```yaml
card_types:
  info:
    indicator: "info"
    purpose: "Informative context without critical urgency"
    example: "Patient completed HbA1c test 2 weeks ago (Result: 6.2%)"
  warning:
    indicator: "warning"
    purpose: "Potential clinical risk; clinician acknowledgment advised"
    example: "Patient has moderate renal impairment; monitor serum creatinine"
  critical:
    indicator: "critical"
    purpose: "High probability of patient harm; requires explicit override"
    example: "Documented anaphylactic allergy to Amoxicillin. DO NOT ADMINISTER."
```

---

## 4. Canonical CDS Response JSON

```json
{
  "cards": [
    {
      "uuid": "card-88129-a7",
      "summary": "Severe Drug Allergy Warning: Penicillin",
      "indicator": "critical",
      "detail": "Patient has a documented high-criticality allergy to Penicillin resulting in anaphylaxis. The currently selected medication (Amoxicillin 500mg) is cross-reactive.",
      "source": {
        "label": "Mediclaim Safety Knowledgebase",
        "url": "https://mediclaim.org/cds/safety-rules#penicillin-allergy"
      },
      "suggestions": [
        {
          "label": "Switch to Azithromycin 250mg",
          "uuid": "sug-1",
          "actions": [
            {
              "type": "delete",
              "description": "Remove Amoxicillin order"
            },
            {
              "type": "create",
              "description": "Add Azithromycin 250mg Oral Tablet order"
            }
          ]
        }
      ],
      "overrideReasons": [
        {"code": "BENEFIT_OUTWEIGHS_RISK", "display": "Clinical benefit outweighs allergic risk under desensitization protocol"},
        {"code": "PATIENT_TOLERATED_PREVIOUSLY", "display": "Patient has previously tolerated this specific therapy"}
      ]
    }
  ]
}
```

---

## 5. Performance & Reliability SLAs

1. **Sub-Second Execution:** Hook evaluation round-trip latency must not exceed 450 ms (P99).
2. **Circuit Breaker:** If a remote decision support microservice fails to respond within 800 ms, the EHR fails open with an unobtrusive warning card.
3. **Audit Trail:** Every displayed card and corresponding clinician action (dismissed, accepted suggestion, overridden with reason) is written to the audit log.
