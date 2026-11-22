# Health Insurance Claims Standards & ASC X12 EDI Transactions

## 1. Overview & Transaction Landscape

Health insurance claim processing requires reliable communication between healthcare providers, clearinghouses, and health maintenance organizations. Mediclaim implements standard ASC X12N EDI formats and modern REST/JSON claim payloads.

### Standard Transaction Sets
- **X12N 837P:** Health Care Claim -- Professional (Outpatient Clinician Billing)
- **X12N 837I:** Health Care Claim -- Institutional (Hospital Inpatient Facilities)
- **X12N 835:** Health Care Claim Payment / Advice (Electronic Remittance Advice)
- **X12N 270 / 271:** Eligibility and Benefit Inquiry & Response
- **X12N 276 / 277:** Health Care Claim Status Request & Notification

---

## 2. Claim Adjudication Lifecycle

```
[Submission]
    │
    ▼
[EDI Syntax Scrubbing] ──[Fail]──> [999 Functional Rejection]
    │ [Pass]
    ▼
[Business Rules Engine] ──[Fail]──> [277CA Claim Acknowledgment Rejection]
    │ [Pass]
    ▼
[Adjudication Engine]
    ├── Pre-Existing Condition Analysis
    ├── Deductible & Co-Pay Calculation
    └── Sub-Limit Verification
    │
    ▼
[Remittance (835 ERA)] ──> [Settlement / EFT Payment]
```

---

## 3. Claim Adjustment Reason Codes (CARC)

When claims are partially paid or denied, standard CARC codes explain the adjudication rationale:

| CARC Code | Standard Meaning | Typical Scenario | Clinical Remediation |
|:----------|:-----------------|:-----------------|:---------------------|
| `1` | Deductible Amount | Patient policy annual deductible applies | Collect co-pay from patient |
| `2` | Coinsurance Amount | Policy co-insurance percentage deducted | Bill secondary insurance |
| `16` | Claim lacks information or has billing errors | Missing diagnosis code / modifier | Resubmit corrected claim |
| `27` | Expenses incurred after coverage terminated | Patient policy lapsed | Verify coverage dates |
| `50` | Non-covered services because not deemed medical necessity | Procedure not indicated by diagnosis | Submit physician letter of appeal |
| `96` | Non-covered charge(s) | Excluded service category (cosmetic) | Patient liability |
| `197` | Precertification / authorization absent | Procedure performed without prior approval | Emergency retro-authorization |

---

## 4. Remittance Advice Remark Codes (RARC)

RARC codes provide secondary granular context alongside CARC:

| RARC Code | Description | Category |
|:----------|:------------|:---------|
| `M1` | X-ray not taken within specified time period | Technical Imaging |
| `M24` | Missing / incomplete operation report | Documentation |
| `MA04` | Secondary payment negotiated under coordination of benefits | Financial |
| `N115` | Prior authorization requested but denied | Pre-Authorization |

---

## 5. Canonical JSON Claim Representation

```json
{
  "claim_id": "CLM-2026-88019",
  "patient_id": "7f8b91a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b",
  "policy_number": "POL-HDFC-9912048",
  "billing_provider": {
    "npi": "1892019482",
    "name": "Apollo Hospitals",
    "tin": "07AAAAA0000A1Z5"
  },
  "diagnoses": [
    {"sequence": 1, "icd10": "J44.1", "description": "COPD acute exacerbation"}
  ],
  "lines": [
    {
      "line_number": 1,
      "service_date": "2026-11-20",
      "hcpcs_code": "99214",
      "units": 1,
      "billed_amount": 1200.00,
      "allowed_amount": 1000.00,
      "paid_amount": 800.00,
      "patient_responsibility": 200.00,
      "adjudication": {
        "carc": "2",
        "description": "Coinsurance 20%"
      }
    }
  ],
  "total_billed": 1200.00,
  "total_paid": 800.00,
  "status": "adjudicated"
}
```

---

## 6. Fraud, Waste, and Abuse (FWA) Detection

- Claims are scored through machine learning heuristics detecting unbundling, upcoding, and duplicate billing before EDI transmission.
