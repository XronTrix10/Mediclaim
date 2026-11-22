# Architecture: Multimodal Document Extraction Pipeline

## 1. Pipeline Overview
The Mediclaim Document Extraction Pipeline converts unstructured clinical documents (handwritten or typed prescriptions, laboratory printouts, discharge summaries) into validated, structured clinical records.

```
+--------------------+
| Document Upload    | -> MIME type verification & 15MB size limit validation
+---------+----------+
          |
          v
+--------------------+
| Temporary Staging  | -> Stored under /data/uploads/documents/staging/
+---------+----------+
          |
          v
+--------------------+
| Multimodal AI OCR  | -> Google Gemini Flash API multimodal prompt
+---------+----------+
          |
          v
+--------------------+
| Schema Validation  | -> Pydantic StructuredMedicalDocument validation
+---------+----------+
          |
          v
+--------------------+
| User Verification  | -> Patient verifies and edits extracted fields
+---------+----------+
          |
          v
+--------------------+
| Commit & Link      | -> Records inserted into PostgreSQL & linked to file
+--------------------+
```

## 2. Structured Extraction Schema
The Gemini prompt instructs the LLM to output structured JSON conforming to the following Pydantic schema:

```python
class StructuredMedicalDocument(BaseModel):
    document_type: str  # prescription, lab_report, vaccination, etc.
    document_date: Optional[str]
    provider_name: Optional[str]
    organization_name: Optional[str]
    medications: List[ExtractedMedication] = []
    conditions: List[ExtractedCondition] = []
    allergies: List[ExtractedAllergy] = []
    vaccinations: List[ExtractedVaccination] = []
    lab_results: List[ExtractedLabResult] = []
    clinical_summary: Optional[str]
```

## 3. Fallback & Resilience Mechanisms
- **Extraction Failure Recovery**: If an image is unreadable or non-medical, the user is offered a graceful manual entry modal ("Upload anyway / Manual entry").
- **File Preservation**: The original file is preserved in encrypted storage and accessible for user review even when automated parsing falls back to manual entry.
