# RxNorm Pharmaceutical Terminology & Active Ingredient Catalog

## 1. Overview

RxNorm provides normalized names and identifiers for clinical drugs and active pharmaceutical ingredients. Produced by the U.S. National Library of Medicine (NLM), RxNorm is used in Mediclaim for prescription normalization, drug-drug interaction detection, and formulary coverage analysis.

### RxNorm Conceptual Tiers
- **IN (Ingredient):** Generic chemical agent (e.g., `Atorvastatin`)
- **PIN (Precise Ingredient):** Salt or specific ester form (e.g., `Atorvastatin Calcium`)
- **SCDC (Semantic Clinical Drug Component):** Ingredient + Strength (e.g., `Atorvastatin 20 MG`)
- **SCD (Semantic Clinical Drug):** Ingredient + Strength + Dose Form (e.g., `Atorvastatin 20 MG Oral Tablet`)

---

## 2. Cardiovascular Drug Crosswalk

| RxCUI | Clinical Drug Description (SCD) | Active Ingredient | ATC Classification |
|:------|:--------------------------------|:------------------|:-------------------|
| `617314` | Atorvastatin 20 MG Oral Tablet | Atorvastatin | `C10AA05` (HMG CoA reductase inhibitor) |
| `197361` | Amlodipine 5 MG Oral Tablet | Amlodipine | `C08CA01` (Calcium channel blocker) |
| `866414` | Metoprolol Succinate 50 MG ER Tablet | Metoprolol | `C07AB02` (Beta-blocking agent) |
| `314076` | Lisinopril 10 MG Oral Tablet | Lisinopril | `C09AA03` (ACE inhibitor) |
| `855332` | Losartan Potassium 50 MG Oral Tablet| Losartan | `C09CA01` (Angiotensin II antagonist) |

---

## 3. Endocrinology & Metabolic Therapeutics

| RxCUI | Clinical Drug Description (SCD) | Active Ingredient | ATC Classification |
|:------|:--------------------------------|:------------------|:-------------------|
| `860975` | Metformin Hydrochloride 500 MG Tablet | Metformin | `A10BA02` (Biguanide) |
| `199955` | Glimepiride 2 MG Oral Tablet | Glimepiride | `A10BB12` (Sulfonylurea) |
| `861007` | Sitagliptin 100 MG Oral Tablet | Sitagliptin | `A10BH01` (DPP-4 inhibitor) |
| `1545653`| Empagliflozin 10 MG Oral Tablet | Empagliflozin | `A10BK03` (SGLT2 inhibitor) |
| `261551` | Insulin Glargine 100 UNT/ML SubQ Pen | Insulin Glargine | `A10AE04` (Long-acting insulin) |

---

## 4. Anti-Infective & Antimicrobial Agents

| RxCUI | Clinical Drug Description (SCD) | Active Ingredient | ATC Classification |
|:------|:--------------------------------|:------------------|:-------------------|
| `723` | Amoxicillin 500 MG Oral Capsule | Amoxicillin | `J01CA04` (Penicillin) |
| `18631` | Azithromycin 250 MG Oral Tablet | Azithromycin | `J01FA10` (Macrolide) |
| `2551` | Ciprofloxacin 500 MG Oral Tablet| Ciprofloxacin | `J01MA02` (Fluoroquinolone) |
| `309090` | Ceftriaxone 1000 MG Injection | Ceftriaxone | `J01DD04` (3rd Gen Cephalosporin)|
| `372696` | Doxycycline Hyclate 100 MG Capsule | Doxycycline | `J01AA02` (Tetracycline) |

---

## 5. Drug-Drug Interaction Severity Categories

When a patient possesses multiple active prescriptions, the Mediclaim interaction engine checks for interaction pairs:

```yaml
interaction_severities:
  category_x:
    label: "Contraindicated"
    action: "Block prescription submission until clinician signs explicit override"
    example: "Simvastatin + Gemfibrozil (Severe rhabdomyolysis risk)"
  category_d:
    label: "Consider Therapy Modification"
    action: "Display alert modal with alternative drug options"
    example: "Warfarin + Fluconazole (Heightened INR and bleeding hazard)"
  category_c:
    label: "Monitor Therapy"
    action: "Log telemetry flag; display informational card"
    example: "ACE Inhibitor + Spironolactone (Hyperkalemia monitoring required)"
```

---

## 6. Implementation Guidelines

- RxNorm lookup caching is maintained in memory with an eviction TTL of 24 hours.
- Formulary tier status (Tier 1: Preferred Generic, Tier 2: Non-Preferred Generic, Tier 3: Preferred Brand, Tier 4: Specialty) is tagged to each RxCUI.
