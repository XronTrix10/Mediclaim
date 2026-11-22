# Allergy Intolerance Taxonomy & Clinical Reaction Standards

## 1. Overview & Purpose

Drug, food, and environmental hypersensitivities represent critical patient safety vectors. This specification defines data models, reaction classifications, severity scales, and automated alerting protocols for allergies recorded within Mediclaim.

### Regulatory Standards
- **FHIR Resource:** `AllergyIntolerance` (R4)
- **Terminology:** SNOMED CT for allergen substances and manifestations
- **Safety Objective:** Zero undetected severe anaphylactic or drug cross-reactivity events.

---

## 2. Classification Hierarchy & Criticality

```
AllergyIntolerance
├── Category
│   ├── food
│   ├── medication
│   ├── environment
│   └── biologic
├── Type
│   ├── allergy (IgE-mediated immune response)
│   └── intolerance (non-immune adverse physiological effect)
└── Criticality
    ├── low (minor localized rash, mild discomfort)
    ├── high (anaphylaxis, airway compromise, hemodynamic collapse)
    └── unable-to-assess (historical report without clinical detail)
```

---

## 3. Reaction Manifestation Vocabulary

| SNOMED CT Code | Manifestation Description | Default Severity | High Criticality Indicator |
|:---------------|:--------------------------|:-----------------|:---------------------------|
| `39579001` | Anaphylaxis | Severe | **YES** |
| `126485001` | Urticaria (Hives) | Moderate | No |
| `41291007` | Angioedema (Facial/Airway swelling) | Severe | **YES** |
| `267036007` | Dyspnea / Bronchospasm | Severe | **YES** |
| `271759002` | Generalized erythematous rash | Mild / Moderate | No |
| `422587007` | Nausea and vomiting | Mild | No |
| `91175000` | Drug-induced seizure | Severe | **YES** |
| `247472004` | Stevens-Johnson syndrome | Severe | **YES** |

---

## 4. Drug Cross-Reactivity Matrix

Mediclaim evaluates structural cross-reactivity when a patient possesses documented medication allergies:

| Documented Allergy | Cross-Reactive Class | Estimated Cross-Reactivity Risk | Recommended Clinical Action |
|:-------------------|:---------------------|:--------------------------------|:----------------------------|
| Penicillin G / V | 1st Gen Cephalosporins | 1% to 2% | Caution; consider 3rd Gen cephalosporin |
| Penicillin G / V | 3rd Gen Cephalosporins | < 1% | Clinically acceptable with observation |
| Penicillin G / V | Carbapenems (Meropenem) | < 1% | Safe under monitored clinical setting |
| Sulfamethoxazole | Non-antibiotic Sulfonamides | Low (Non-cross-reactive) | No contraindication |
| Aspirin (NSAID) | Ibuprofen, Naproxen | High (> 80% cross-reactivity) | Strict contraindication for COX-1 |

---

## 5. FHIR JSON Conformance Example

```json
{
  "resourceType": "AllergyIntolerance",
  "id": "all-90812-b",
  "clinicalStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
        "code": "active"
      }
    ]
  },
  "verificationStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
        "code": "confirmed"
      }
    ]
  },
  "type": "allergy",
  "category": ["medication"],
  "criticality": "high",
  "code": {
    "coding": [
      {
        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
        "code": "70618",
        "display": "Penicillin"
      }
    ],
    "text": "Penicillin class antibiotics"
  },
  "patient": {
    "reference": "Patient/7f8b91a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"
  },
  "reaction": [
    {
      "manifestation": [
        {
          "coding": [
            {
              "system": "http://snomed.info/sct",
              "code": "39579001",
              "display": "Anaphylaxis"
            }
          ]
        }
      ],
      "severity": "severe"
    }
  ]
}
```

---

## 6. Implementation Directives

- Allergy records marked `criticality: high` render persistent red banner warnings across all doctor viewing dashboards.
- Allergy records cannot be deleted; they may only transition to `clinicalStatus: resolved` or `verificationStatus: refuted` with mandatory physician notes.
