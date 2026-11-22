# LOINC Laboratory Test Panel Dictionary & UCUM Specifications

## 1. Overview

Logical Observation Identifiers Names and Codes (LOINC) provides the universal standard for identifying medical laboratory observations and clinical test results. Mediclaim leverages LOINC to normalize heterogeneous hospital laboratory inputs.

### Reference Specifications
- **Standard:** Regenstrief LOINC 2.76
- **Units System:** Unified Code for Units of Measure (UCUM)
- **FHIR Target:** `Observation.code` and `Observation.valueQuantity`

---

## 2. Complete Blood Count (CBC) Panel (`58410-2`)

The Complete Blood Count with differential evaluation:

| LOINC Code | Component Name | Standard UCUM Unit | Typical Reference Range | Clinical Significance |
|:-----------|:---------------|:-------------------|:------------------------|:----------------------|
| `6690-2` | Leukocytes [#/volume] (WBC) | `10*3/uL` | `4.5 - 11.0` | Infection, leukemia, inflammation |
| `789-8` | Erythrocytes [#/volume] (RBC) | `10*6/uL` | `4.2 - 5.9` | Anemia, polycythemia |
| `718-7` | Hemoglobin [Mass/volume] | `g/dL` | `13.5 - 17.5 (M), 12.0 - 15.5 (F)` | Oxygen carrying capacity |
| `4544-3` | Hematocrit [Volume Fraction] | `%` | `41 - 50 (M), 36 - 44 (F)` | Red cell volume ratio |
| `777-3` | Platelets [#/volume] | `10*3/uL` | `150 - 450` | Coagulation, thrombocytopenia |
| `787-2` | Mean Corpuscular Volume (MCV)| `fL` | `80 - 96` | Microcytic / macrocytic anemia |
| `785-6` | MCH | `pg` | `27 - 33` | Mean cell hemoglobin mass |
| `786-4` | MCHC | `g/dL` | `32 - 36` | Hemoglobin concentration |

---

## 3. Comprehensive Metabolic Panel (CMP) (`24323-8`)

| LOINC Code | Analyte | UCUM Unit | Standard Range | Organ / Physiological System |
|:-----------|:--------|:----------|:---------------|:-----------------------------|
| `2345-7` | Glucose [Mass/volume] in serum | `mg/dL` | `70 - 99` | Carbohydrate Metabolism |
| `3094-0` | Blood Urea Nitrogen (BUN) | `mg/dL` | `7 - 20` | Renal Excretion |
| `2160-0` | Creatinine in serum | `mg/dL` | `0.7 - 1.3 (M), 0.5 - 1.1 (F)` | Renal Glomerular Filtration |
| `2951-2` | Sodium in serum | `mmol/L` | `136 - 145` | Electrolyte / Fluid Balance |
| `2823-3` | Potassium in serum | `mmol/L` | `3.5 - 5.1` | Cardiac & Cellular Conduction |
| `2075-0` | Chloride in serum | `mmol/L` | `98 - 107` | Acid-Base Homeostasis |
| `2028-9` | Carbon Dioxide (Bicarbonate) | `mmol/L` | `22 - 29` | Respiratory & Renal Regulation|
| `17861-6` | Calcium total in serum | `mg/dL` | `8.6 - 10.2` | Bone Metabolism & Signaling |

---

## 4. Lipid & Cardiovascular Risk Panel (`24331-1`)

| LOINC Code | Analyte | UCUM Unit | Optimal Target | High Risk Threshold |
|:-----------|:--------|:----------|:---------------|:--------------------|
| `2093-3` | Cholesterol total | `mg/dL` | `< 200` | `>= 240` |
| `2085-9` | HDL Cholesterol | `mg/dL` | `>= 60` | `< 40` |
| `13457-7` | LDL Cholesterol (calculated) | `mg/dL` | `< 100` | `>= 160` |
| `2571-8` | Triglycerides | `mg/dL` | `< 150` | `>= 200` |
| `4548-4` | Hemoglobin A1c / Total Hb | `%` | `< 5.7` | `>= 6.5 (Diabetic)` |

---

## 5. Result Interpretation Flags

EHR results must map standard HL7 observation interpretation codes:

```json
{
  "interpretation_codes": [
    {"code": "L", "display": "Low", "description": "Below reference range"},
    {"code": "H", "display": "High", "description": "Above reference range"},
    {"code": "LL", "display": "Critical Low", "description": "Below critical low threshold; immediate clinical notification"},
    {"code": "HH", "display": "Critical High", "description": "Above critical high threshold; immediate clinical notification"},
    {"code": "N", "display": "Normal", "description": "Within defined demographic reference limits"}
  ]
}
```

---

## 6. Storage & Query Optimization

- **Database Table:** `clinical_records` with `record_type = 'lab_report'`
- **Indexing:** GIN index on `metadata->'loinc_codes'` for sub-second panel filtering.
