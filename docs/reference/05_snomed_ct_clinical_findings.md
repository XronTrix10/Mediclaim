# SNOMED CT Clinical Terms Taxonomy & Symptom Guidelines

## 1. Overview and Structural Model

SNOMED CT (Systematized Nomenclature of Medicine -- Clinical Terms) is the most comprehensive multilingual healthcare clinical ontology in the world. Within Mediclaim, SNOMED CT powers clinical note natural language parsing, symptom indexing, and medical history classification.

### Hierarchy Roots
- `Clinical finding (finding)` -- `404684003`
- `Procedure (procedure)` -- `71388002`
- `Situation with explicit context (situation)` -- `243796009`
- `Body structure (body structure)` -- `123037004`

---

## 2. Common Clinical Findings & Concept Identifiers

### Cardiovascular & Circulatory Symptoms
| Concept ID | Fully Specified Name (FSN) | Preferred Term | Semantic Category |
|:-----------|:---------------------------|:---------------|:------------------|
| `29857009` | Chest pain (finding) | Chest pain | Finding |
| `80313002` | Palpitations (finding) | Palpitations | Finding |
| `271594007`| Syncope (finding) | Syncope | Finding |
| `426396005`| Cardiac murmur (finding) | Heart murmur | Finding |
| `267036007`| Dyspnea (finding) | Shortness of breath | Finding |

### Neurological & Sensory Symptoms
| Concept ID | Fully Specified Name (FSN) | Preferred Term | Semantic Category |
|:-----------|:---------------------------|:---------------|:------------------|
| `25064002` | Headache (finding) | Headache | Finding |
| `399153001`| Vertigo (finding) | Vertigo | Finding |
| `91175000` | Seizure (finding) | Seizure | Finding |
| `44609009` | Paresthesia (finding) | Tingling sensation | Finding |
| `230145002`| Tremor (finding) | Tremor | Finding |

### Gastrointestinal & Abdominal Symptoms
| Concept ID | Fully Specified Name (FSN) | Preferred Term | Semantic Category |
|:-----------|:---------------------------|:---------------|:------------------|
| `21522001` | Abdominal pain (finding) | Abdominal pain | Finding |
| `422587007`| Nausea (finding) | Nausea | Finding |
| `3006004` | Distention of abdomen | Abdominal distension | Finding |
| `62315008` | Diarrhea (finding) | Diarrhea | Finding |
| `14760008` | Constipation (finding) | Constipation | Finding |

---

## 3. Post-Coordination & Concept Composition

SNOMED CT allows post-coordination to represent complex clinical states:

```
=== Post-Coordination Expression ===
29857009 | Chest pain | :
  363698007 | Finding site | = 78904004 | Chest wall structure |,
  263502005 | Clinical course | = 255227004 | Acute |
```

---

## 4. NLP Entity Extraction Crosswalk

When physician clinical notes are parsed via OCR or text extraction, terms are normalized using the following dictionary rules:

```json
{
  "synonym_mappings": {
    "sob": "267036007",
    "short of breath": "267036007",
    "breathlessness": "267036007",
    "dyspnoea": "267036007",
    "angina": "225566008",
    "high bp": "38341003",
    "elevated blood pressure": "38341003",
    "sugar problem": "73211009",
    "diabetes": "73211009"
  }
}
```

---

## 5. Audit & Compliance Safeguards

- Every extracted concept is tagged with confidence scoring (`0.0` to `1.0`).
- Extracted concepts with confidence `< 0.85` require human clinical reviewer validation before claim pre-authorization.
