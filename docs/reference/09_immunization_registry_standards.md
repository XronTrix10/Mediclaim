# Immunization Registry Standards & CDC CVX Taxonomy

## 1. Scope & Conformance

Immunization data captures vaccinations administered across primary care clinics, hospitals, and national public health campaigns. This specification outlines CVX vaccine coding, dose sequencing rules, and cold chain verification parameters.

### Conformance Target
- **FHIR Resource:** `Immunization` (R4)
- **Terminology:** CDC CVX (Vaccine Administered) & MVX (Manufacturers of Vaccines)
- **National Schedule:** Indian Universal Immunization Programme (UIP) & WHO Expanded Programme on Immunization (EPI)

---

## 2. Universal Immunization Schedule & CVX Codes

| CVX Code | Vaccine Description | Abbreviation | Target Disease | Recommended Schedule |
|:---------|:--------------------|:-------------|:---------------|:---------------------|
| `19` | Bacillus Calmette-Guerin | BCG | Tuberculosis | At birth (up to 1 year) |
| `178` | Oral Poliovirus Vaccine, bivalent | bOPV | Poliomyelitis | Birth dose, 6, 10, 14 weeks |
| `45` | Hepatitis B, adult/pediatric formulation | Hep B | Hepatitis B | Birth dose (< 24 hrs) |
| `198` | DTwP-HepB-Hib pentavalent vaccine | Pentavalent | Diphtheria, Pertussis, Tetanus, Hep B, Hib | 6, 10, 14 weeks |
| `122` | Rotavirus vaccine, live oral | Rotavirus | Rotaviral enteritis | 6, 10, 14 weeks |
| `03` | Measles, Mumps, Rubella vaccine | MMR | Measles, Mumps, Rubella | 9 months, 15 months |
| `133` | Pneumococcal conjugate vaccine 13-valent | PCV13 | Pneumococcal pneumonia | 6, 14 weeks, booster 9 mos |
| `115` | Tdap (Tetanus, reduced diphtheria, acellular pertussis)| Tdap | Tetanus, Diphtheria, Pertussis | 10 years, 16 years, pregnancy |
| `208` | COVID-19, mRNA, spike protein | COVID-19 | SARS-CoV-2 | Primary series + Boosters |

---

## 3. Vaccine Manufacturer Identifiers (MVX)

| MVX Code | Manufacturer Name | Country of Origin | Primary Vaccines Supplied |
|:---------|:------------------|:------------------|:--------------------------|
| `SKB` | GlaxoSmithKline | United Kingdom | Infanrix, Havrix, Priorix |
| `MSD` | Merck Sharp & Dohme | United States | Gardasil, M-M-R II, Pneumovax |
| `PFR` | Pfizer Inc. | United States | Prevnar 13, Comirnaty |
| `SI` | Serum Institute of India | India | Covishield, BCG, Rotasiil |
| `BA` | Bharat Biotech | India | Covaxin, Typbar TCV |
| `SNV` | Sanofi Pasteur | France | Pentaxim, Fluzone |

---

## 4. Dose Sequence & Minimum Interval Logic

Immunization algorithms validate that doses are administered with proper spacing:

```yaml
minimum_interval_rules:
  pentavalent_series:
    total_doses: 3
    minimum_start_age_days: 42 # 6 weeks
    minimum_interval_between_doses_days: 28 # 4 weeks
  mmr_series:
    total_doses: 2
    minimum_start_age_days: 270 # 9 months
    minimum_interval_between_doses_days: 90 # 3 months
```

---

## 5. Cold Chain Temperature Compliance Logging

Mediclaim tracks vaccine vial safety through IoT and batch temperature logs:

```json
{
  "lot_number": "SII-COV-88912A",
  "manufacturer": "Serum Institute of India",
  "expiration_date": "2027-08-31",
  "storage_compliance": {
    "target_temp_celsius": 4.0,
    "tolerance_min": 2.0,
    "tolerance_max": 8.0,
    "excursion_logged": false,
    "verification_status": "certified_cold_chain"
  }
}
```

---

## 6. Regulatory Reporting Directives

- All pediatric immunizations are replicated to the central immunization registry within 24 hours of administration.
- Adverse Events Following Immunization (AEFI) require immediate clinician reporting within 2 hours of onset.
