# Synthetic Patient Benchmark Cohort & Stress Testing Methodology

## 1. Objectives & Compliance Guardrails

Benchmarking healthcare databases, query response times, and AI extraction pipelines requires realistic, statistically robust patient datasets without using actual Protected Health Information (PHI). This specification documents the generation methodology, demographic distributions, and test fixtures for synthetic cohorts in Mediclaim.

### Regulatory Standards
- **HIPAA Safe Harbor:** Zero presence of the 18 direct personal identifiers (§ 164.514(b)(2)).
- **Synthetic Generator:** Python Synthea-aligned parametric generative model.
- **Statistical Fidelity:** Age, gender, disease incidence calibrated against national morbidity surveys.

---

## 2. Demographic & Epidemiological Distribution Models

| Parameter | Demographic Stratification | Target Cohort Distribution |
|:----------|:---------------------------|:---------------------------|
| Age Distribution | Pediatric (0 - 17 yrs) | 22.5% |
| | Young Adult (18 - 35 yrs) | 31.0% |
| | Middle Aged (36 - 60 yrs) | 33.5% |
| | Geriatric (60+ yrs) | 13.0% |
| Gender Identity | Male | 51.2% |
| | Female | 48.7% |
| | Non-Binary / Other | 0.1% |
| Chronic Disease Prevalence | Type 2 Diabetes Mellitus | 11.4% (Adult population) |
| | Essential Hypertension | 24.8% (Adult population) |
| | Chronic Kidney Disease | 3.2% |
| | Asthma / COPD | 6.8% |

---

## 3. Benchmark Patient Archetypes

```yaml
archetypes:
  geriatric_multimorbid:
    identifier: "SYNTH-PAT-001"
    age: 68
    gender: "female"
    conditions:
      - "Type 2 Diabetes Mellitus (E11.9)"
      - "Essential Hypertension (I10)"
      - "Chronic Kidney Disease Stage 3 (N18.3)"
    prescriptions_active: 5
    annual_encounters: 8
    target_query_complexity: "High join density across encounters, labs, and vitals"
  pediatric_acute:
    identifier: "SYNTH-PAT-002"
    age: 5
    gender: "male"
    conditions:
      - "Acute Otitis Media (H66.90)"
      - "Viral Upper Respiratory Infection (J06.9)"
    prescriptions_active: 1
    annual_encounters: 3
    target_query_complexity: "Immunization schedule verification, dosage-by-weight checks"
  healthy_adult_baseline:
    identifier: "SYNTH-PAT-003"
    age: 28
    gender: "male"
    conditions: []
    prescriptions_active: 0
    annual_encounters: 1
    target_query_complexity: "Baseline preventive checkup, routine lipid screening"
```

---

## 4. Synthetic Fixture JSON Template

```json
{
  "synthetic_benchmark_patient": {
    "mediclaim_id": "MED-SYN8820",
    "demographics": {
      "first_name": "Suresh",
      "last_name": "Patel",
      "gender": "male",
      "birth_date": "1965-04-12",
      "city": "Ahmedabad",
      "state": "Gujarat",
      "postal_code": "380001"
    },
    "vital_signs_timeline": [
      {
        "timestamp": "2026-01-15T09:30:00Z",
        "systolic_bp": 138,
        "diastolic_bp": 88,
        "heart_rate": 74,
        "bmi": 26.4
      },
      {
        "timestamp": "2026-06-20T10:15:00Z",
        "systolic_bp": 132,
        "diastolic_bp": 84,
        "heart_rate": 72,
        "bmi": 25.9
      }
    ],
    "laboratory_results": [
      {
        "loinc": "4548-4",
        "test_name": "HbA1c",
        "value": 6.8,
        "unit": "%",
        "date": "2026-06-20"
      }
    ]
  }
}
```

---

## 5. Performance Benchmark Targets

The synthetic cohort (100,000 synthetic patients, 1,200,000 encounters, 4,500,000 clinical records) is utilized for load testing:

| Query Type | Database Index Target | Target Latency (P95) | Target Latency (P99) |
|:-----------|:----------------------|:---------------------|:---------------------|
| Single Patient Summary Fetch | Primary Key / UUID | < 12 ms | < 25 ms |
| Longitudinal Timeline Aggregation | `idx_records_patient_timestamp` | < 45 ms | < 85 ms |
| Full-Text Clinical Search | GIN `to_tsvector('english', notes)` | < 120 ms | < 220 ms |
| Consent Directive Verification | Composite `(patient_id, grantee_id)`| < 8 ms | < 18 ms |

---

## 6. Zero PHI Contamination Certification

- Automated regex scanning is executed across all synthetic fixtures to confirm zero live social security, Aadhaar, PAN, phone number, or residential address data.
