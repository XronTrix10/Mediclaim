# Prescription SIG Standards & Drug Administration Guidelines

## 1. Scope & Objective

The prescription "SIG" (Latin *signa*, meaning "write" or "label") directs the patient on how, when, and in what quantity to administer medication. This document codifies SIG parsing grammar, frequency codes, routes of administration, and safety limits enforced in Mediclaim.

---

## 2. Standard Administration Frequency Codes

| Latin SIG Code | Frequency Meaning | Standard Doses / Day | Interval Between Doses |
|:---------------|:------------------|:---------------------|:-----------------------|
| `QD` / `OD` | Once daily (*quaque die*) | 1 | Every 24 hours |
| `BID` | Twice daily (*bis in die*) | 2 | Every 12 hours |
| `TID` | Three times daily (*ter in die*) | 3 | Every 8 hours |
| `QID` | Four times daily (*quater in die*) | 4 | Every 6 hours |
| `Q4H` | Every 4 hours | 6 | Every 4 hours |
| `Q6H` | Every 6 hours | 4 | Every 6 hours |
| `Q8H` | Every 8 hours | 3 | Every 8 hours |
| `QHS` | Every night at bedtime | 1 | Bedtime |
| `QAM` | Every morning | 1 | Morning |
| `PRN` | As needed (*pro re nata*) | Variable | As required with max limit |
| `STAT` | Immediately (*statim*) | 1 | Single immediate dose |

---

## 3. Administration Routes (FDA / CDISC Vocabulary)

| Route Code | Display Route | Description | Typical Dosage Forms |
|:-----------|:--------------|:------------|:---------------------|
| `PO` | Per Os (Oral) | Swallowed through mouth | Tablet, Capsule, Syrup |
| `SL` | Sublingual | Dissolved under tongue | Sublingual tablet, spray |
| `IV` | Intravenous | Injected into vein | Infusion solution, IV push |
| `IM` | Intramuscular | Injected into muscle tissue | Depot suspension, aqueous solution|
| `SC` / `SQ` | Subcutaneous | Injected beneath skin layer | Insulin pen, pre-filled syringe |
| `TOP` | Topical | Applied to epidermal skin | Cream, Ointment, Gel |
| `INH` | Inhalation | Inhaled via respiratory tract | MDI Inhaler, DPI, Nebulizer |
| `OPHTH` | Ophthalmic | Applied into conjunctival sac | Eye drops, ocular ointment |
| `OTIC` | Otic | Instilled into ear canal | Otic suspension, eardrops |

---

## 4. Prescription Schema & JSON Representation

```json
{
  "prescription_id": "rx-2026-99214-a",
  "medication": {
    "drug_name": "Metformin Hydrochloride",
    "rxcui": "860975",
    "strength": "500 mg",
    "form": "Oral Tablet, Extended Release"
  },
  "dosage_instruction": {
    "dose_quantity": 1,
    "unit": "tablet",
    "frequency": "BID",
    "timing": "with meals",
    "route": "PO",
    "duration_days": 30,
    "total_quantity": 60,
    "refills_authorized": 2
  },
  "precautions": [
    "Take with or immediately after meals to reduce gastrointestinal upset",
    "Do not crush or chew extended-release formulation"
  ]
}
```

---

## 5. Automated Clinical Safety Rules

1. **Maximum Daily Dose Check:** Prescribed doses are automatically evaluated against pharmacological ceiling limits (e.g. Paracetamol max 4,000 mg/day).
2. **Frequency Sanity:** Frequencies exceeding 6 times per day trigger a high-priority prescriber warning.
3. **PRN Justification:** All `PRN` prescriptions must specify both minimum re-dose interval and qualifying condition (e.g., "for severe pain > 6/10").
