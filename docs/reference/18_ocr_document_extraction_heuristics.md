# OCR Document Extraction Heuristics & Clinical Parsing Pipeline

## 1. Overview & Pipeline Architecture

Patients frequently upload historical medical documents as scanned PDFs, mobile photographs, or faxed reports. The Mediclaim OCR extraction pipeline transforms unstructured raster imagery into structured, queryable clinical data.

```
[Raw Image / PDF]
       │
       ▼
[Image Preprocessing] (Deskew, Denoise, Adaptive Binarization)
       │
       ▼
[Layout Analysis] (Bounding Box Segmentation, Table Detection)
       │
       ▼
[Multi-Engine OCR] (Tesseract / Cloud Vision / Local Tensor)
       │
       ▼
[NLP Key-Value Extraction] (Regex + Clinical Named Entity Recognition)
       │
       ▼
[Confidence Scoring & Validation Engine]
       ├── [Confidence >= 0.88] ──> Auto-Persist to Database
       └── [Confidence < 0.88]  ──> Enqueue for Human Clinical Review
```

---

## 2. Document Classification Taxonomy

| Document Class | Key Identifying Anchors | Extraction Targets | Target Table |
|:---------------|:------------------------|:-------------------|:-------------|
| `LAB_REPORT` | "Specimen", "Reference Range", "Result", "Units" | Test names, values, units, flags | `clinical_records` |
| `DISCHARGE_SUMMARY`| "Admission Date", "Discharge Date", "Hospital Course" | Diagnoses, procedures, medications | `clinical_records` |
| `PRESCRIPTION_SLIP`| "Rx", "Sig", "Dispense", "Refill", "Dr. License" | Drug name, strength, frequency | `prescriptions` |
| `INVOICE_BILL` | "Total Amount", "Tax", "Invoice #", "Itemized Charge"| Line items, charges, provider TIN | `billing_records` |

---

## 3. Heuristic Anchor Extraction Patterns

```python
import re

PATIENT_NAME_PATTERNS = [
    re.compile(r"Patient\s*Name\s*[:\-]\s*([A-Za-z\s\.\,'\-]+)", re.IGNORECASE),
    re.compile(r"Name\s*[:\-]\s*([A-Za-z\s\.\,'\-]+)", re.IGNORECASE),
    re.compile(r"Pt\.\s*Name\s*[:\-]\s*([A-Za-z\s\.\,'\-]+)", re.IGNORECASE),
]

DATE_PATTERNS = [
    re.compile(r"(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})"),
    re.compile(r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})", re.IGNORECASE),
]

LAB_RESULT_ROW_PATTERN = re.compile(
    r"^(?P<test_name>[A-Za-z0-9\s\-\(\)\/\+]+?)\s{2,}"
    r"(?P<result_value>[<>]?\s*\d+(?:\.\d+)?)\s+"
    r"(?P<units>[A-Za-z0-9\/\*\^%\.]+)\s+"
    r"(?P<reference_range>\d+(?:\.\d+)?\s*[\-\–]\s*\d+(?:\.\d+)?)",
    re.MULTILINE
)
```

---

## 4. Multi-Engine Consensus Arbitration

To prevent hallucinations and transcription errors, low-confidence extractions are evaluated using consensus weighting:

```yaml
engine_consensus_weights:
  tesseract_ocr:
    weight: 0.35
    strengths: "Speed, high-contrast printed text, tabular grid preservation"
  cloud_vision:
    weight: 0.45
    strengths: "Rotated text, handwritten annotations, noisy background suppression"
  heuristic_regex_validator:
    weight: 0.20
    strengths: "Deterministic format conformity, checksum validation"
```

---

## 5. Confidence Scoring Formula

The aggregate extraction confidence $C$ is computed as:

$$C = \sum_{i=1}^n w_i \cdot c_i$$

Where:
- $w_i$ is the engine reliability weight ($\sum w_i = 1.0$).
- $c_i$ is the individual engine's character confidence for the extracted token.

---

## 6. Audit Logging & Human-in-the-Loop Safeguards

- All original source images are cryptographically hashed (SHA-256) and archived in write-once-read-many (WORM) storage.
- Extracted records store the exact bounding box polygon coordinates `[x1, y1, x2, y2]` enabling instant visual verification on the doctor review screen.
