# ICD-10-CM Clinical Diagnostic Crosswalk & Taxonomy

## 1. Scope & Coding Principles

The International Classification of Diseases, Tenth Revision, Clinical Modification (ICD-10-CM) is standard for diagnostic reporting, disease morbidity tracking, and insurance claim adjudication within Mediclaim.

### Regulatory & Technical Standards
- **Standard Edition:** 2026 WHO & CMS ICD-10-CM
- **Format:** 3 to 7 alphanumeric characters (e.g., `E11.65`)
- **Coding Conventions:** Excludes1 (mutually exclusive), Excludes2 (not included here), Code First, Use Additional Code.

---

## 2. Chapter Breakdown & Diagnostic Hierarchy

| Chapter | Code Range | Description | Primary Mediclaim Category |
|:--------|:-----------|:------------|:---------------------------|
| I | `A00-B99` | Certain infectious and parasitic diseases | Infectious Disease |
| II | `C00-D49` | Neoplasms (benign and malignant) | Oncology |
| III | `D50-D89` | Diseases of blood and blood-forming organs | Hematology |
| IV | `E00-E89` | Endocrine, nutritional, and metabolic diseases | Endocrinology |
| V | `F01-F99` | Mental, behavioral, and neurodevelopmental | Psychiatry & Mental Health |
| VI | `G00-G99` | Diseases of the nervous system | Neurology |
| VII | `H00-H59` | Diseases of the eye and adnexa | Ophthalmology |
| VIII | `H60-H95` | Diseases of ear and mastoid process | ENT |
| IX | `I00-I99` | Diseases of the circulatory system | Cardiology / Vascular |
| X | `J00-J99` | Diseases of the respiratory system | Pulmonology |
| XI | `K00-K95` | Diseases of the digestive system | Gastroenterology |
| XIII | `M00-M99` | Diseases of musculoskeletal system | Orthopedics / Rheumatology |
| XIV | `N00-N99` | Diseases of the genitourinary system | Nephrology / Urology |
| XIX | `S00-T88` | Injury, poisoning, external consequences | Trauma / Emergency Medicine |

---

## 3. High-Frequency Clinical Codes Reference Table

### Endocrinology & Metabolic Disorders
| Code | Description | Billable Status | Chronic Indicator |
|:-----|:------------|:----------------|:------------------|
| `E11.9` | Type 2 diabetes mellitus without complications | Billable | Yes |
| `E11.21`| Type 2 diabetes mellitus with diabetic nephropathy | Billable | Yes |
| `E11.319`| Type 2 diabetes mellitus with unspecified diabetic retinopathy | Billable | Yes |
| `E03.9` | Hypothyroidism, unspecified | Billable | Yes |
| `E78.5` | Hyperlipidemia, unspecified | Billable | Yes |
| `E66.01`| Morbid (severe) obesity due to excess calories | Billable | Yes |

### Cardiovascular & Circulatory Diseases
| Code | Description | Billable Status | Chronic Indicator |
|:-----|:------------|:----------------|:------------------|
| `I10` | Essential (primary) hypertension | Billable | Yes |
| `I20.9` | Angina pectoris, unspecified | Billable | Yes |
| `I21.9` | Acute myocardial infarction, unspecified | Billable | No (Acute) |
| `I25.10`| Atherosclerotic heart disease of native coronary artery | Billable | Yes |
| `I48.0` | Paroxysmal atrial fibrillation | Billable | Yes |
| `I50.9` | Heart failure, unspecified | Billable | Yes |

### Respiratory & Pulmonary Conditions
| Code | Description | Billable Status | Chronic Indicator |
|:-----|:------------|:----------------|:------------------|
| `J18.9` | Pneumonia, unspecified organism | Billable | No (Acute) |
| `J20.9` | Acute bronchitis, unspecified | Billable | No (Acute) |
| `J44.9` | Chronic obstructive pulmonary disease, unspecified | Billable | Yes |
| `J45.909`| Unspecified asthma, uncomplicated | Billable | Yes |
| `J06.9` | Acute upper respiratory infection, unspecified | Billable | No (Acute) |

---

## 4. Mediclaim Ingestion Parsing Logic

```python
def validate_icd10_code(code: str) -> bool:
    import re
    # ICD-10 format: letter + 2 digits + optional dot + up to 4 digits/letters
    pattern = r"^[A-TV-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$"
    return bool(re.match(pattern, code.strip().upper()))
```

---

## 5. Claim Adjudication Guidelines

1. **Primary Diagnosis Requirement:** All submitted health insurance claims must feature at least one validated primary ICD-10 diagnosis code.
2. **Medical Necessity Cross-Validation:** Procedure codes (CPT/HCPCS) must correlate with established diagnosis-to-procedure coverage policies.
3. **Pre-Existing Disease (PED) Clause:** Diagnosis codes matching chronic indicators are evaluated against policy waiting periods (typically 24 to 36 months).
