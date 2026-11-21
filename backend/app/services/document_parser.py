"""
Mandatory Gemini Medical Document Parsing & Persistence Pipeline for Mediclaim.

Uses Google Gemini multimodal structured output (`responseMimeType="application/json"`
+ strict `responseSchema`) to parse uploaded PDFs and images (prescriptions,
vaccination certificates, lab/diagnostic reports, discharge summaries, clinical notes)
directly from raw file bytes—without local OCR fallback.

If Gemini extraction fails (missing API key, network/API error, invalid response,
or zero extractable clinical records), the document is still stored and previewable,
and the API returns `ocrStatus="failed"` with `failureMessage="Failed to extract data, upload anyway"`.
"""

from __future__ import annotations

import base64
from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import status

from app.config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    PARSER_TIMEOUT_SECONDS,
)
from app.database import get_db
from app.exceptions import APIProblemException
from app.schemas.records import (
    NewAllergyInput,
    NewConditionInput,
    NewMedicationInput,
    NewPrescriptionInput,
    NewReportInput,
    NewVaccinationInput,
)
from app.schemas.uploads import ParsedDocumentPayload
from app.services.audit_service import record_audit
from app.services.records_service import (
    create_allergy,
    create_condition,
    create_medication,
    create_prescription,
    create_report,
    create_vaccination,
)

logger = logging.getLogger("mediclaim.document_parser")

FAILURE_USER_MESSAGE = "Failed to extract data, upload anyway"


# ---------------------------------------------------------------------------
# Strict Gemini Structured Output Schema & Clinical Prompt
# ---------------------------------------------------------------------------

EXTRACTION_SYSTEM_PROMPT = """You are a clinical medical document parser for the Mediclaim longitudinal EHR timeline.
Carefully read the attached medical document (PDF or image — printed, scanned, or handwritten) and extract EVERY clinically meaningful record into clean, structured JSON.

Formatting rules (CRITICAL for clean patient timeline display):
1. Dates: Always normalize to ISO `YYYY-MM-DD` using the ACTUAL clinical event date (consultation date, vaccination date, admission/diagnosis date, or report date — NEVER today's date unless explicitly written on the document). If only month/year is present, use the 1st of that month. If truly absent, omit/null.
2. Titles: Write concise, natural clinical titles (e.g., "Appendicitis", "Dengue fever", "Measles vaccine", "BCG and Hepatitis B (birth dose)", "Birth record", "HbA1c Blood Test", "Asthma Maintenance Prescription"). Never use raw filenames or ALL-CAPS noise.
3. Descriptions / Notes / Conclusions: Write clean, factual 1-2 sentence clinical summaries (e.g., "Laparoscopic appendectomy with two nights in hospital.", "Admitted for four days. Fully recovered.", "Single dose at nine months.", "Birth weight 3.1 kg. No complications.").
4. Providers & Organizations: Extract the clean hospital, clinic, lab, or doctor name (e.g., "Sion Government Hospital", "Primary Health Centre", "Dr. Rohan Kulkarni").
5. Status: Use accurate clinical status:
   - Conditions: "resolved" if recovered/discharged/past surgery, "active" if ongoing/chronic, "inactive" if dormant.
   - Medications: "active" if currently taking, "completed" if past course finished, "discontinued" if stopped.
6. Multi-record documents: A single discharge summary or visit note can contain a condition, a prescription, lab results, allergies, and/or vaccinations. Extract all distinct items present, but do NOT duplicate the same medication in both `prescriptions` and standalone `medications` (put prescribed drugs inside `prescriptions[].medications`; use standalone `medications` only for non-prescription medication lists).
7. Strict truthfulness: Never invent or hallucinate medical facts not present in the document. If the image is blank, unreadable, or not a medical document, return empty arrays and confidence 0.0.
"""

GEMINI_RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "documentType": {
            "type": "STRING",
            "enum": [
                "prescription",
                "vaccination",
                "lab_report",
                "discharge_summary",
                "allergy_note",
                "other",
            ],
        },
        "title": {"type": "STRING", "nullable": True},
        "documentDate": {"type": "STRING", "nullable": True, "description": "YYYY-MM-DD"},
        "provider": {"type": "STRING", "nullable": True},
        "organization": {"type": "STRING", "nullable": True},
        "confidence": {"type": "NUMBER"},
        "prescriptions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "doctor": {"type": "STRING"},
                    "organization": {"type": "STRING", "nullable": True},
                    "date": {"type": "STRING", "nullable": True},
                    "instructions": {"type": "STRING", "nullable": True},
                    "medications": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "name": {"type": "STRING"},
                                "dosage": {"type": "STRING", "nullable": True},
                                "frequency": {"type": "STRING", "nullable": True},
                                "duration": {"type": "STRING", "nullable": True},
                                "instructions": {"type": "STRING", "nullable": True},
                            },
                            "required": ["name"],
                        },
                    },
                },
                "required": ["title", "doctor"],
            },
        },
        "vaccinations": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "vaccineName": {"type": "STRING"},
                    "doseNumber": {"type": "INTEGER", "nullable": True},
                    "administeredDate": {"type": "STRING", "nullable": True},
                    "nextDueDate": {"type": "STRING", "nullable": True},
                    "batchNumber": {"type": "STRING", "nullable": True},
                    "provider": {"type": "STRING", "nullable": True},
                    "notes": {"type": "STRING", "nullable": True},
                },
                "required": ["vaccineName"],
            },
        },
        "allergies": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "allergen": {"type": "STRING"},
                    "category": {
                        "type": "STRING",
                        "enum": ["food", "medication", "environment", "biologic"],
                        "nullable": True,
                    },
                    "severity": {
                        "type": "STRING",
                        "enum": ["mild", "moderate", "severe", "life-threatening"],
                        "nullable": True,
                    },
                    "criticality": {
                        "type": "STRING",
                        "enum": ["low", "high", "unable-to-assess"],
                        "nullable": True,
                    },
                    "reaction": {"type": "STRING"},
                    "provider": {"type": "STRING", "nullable": True},
                    "identifiedDate": {"type": "STRING", "nullable": True},
                    "notes": {"type": "STRING", "nullable": True},
                },
                "required": ["allergen", "reaction"],
            },
        },
        "conditions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "conditionName": {"type": "STRING"},
                    "status": {
                        "type": "STRING",
                        "enum": ["active", "resolved", "inactive", "completed", "discontinued"],
                        "nullable": True,
                    },
                    "severity": {"type": "STRING", "nullable": True},
                    "onsetDate": {"type": "STRING", "nullable": True},
                    "resolvedDate": {"type": "STRING", "nullable": True},
                    "provider": {"type": "STRING", "nullable": True},
                    "notes": {"type": "STRING", "nullable": True},
                },
                "required": ["conditionName"],
            },
        },
        "medications": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "medicationName": {"type": "STRING"},
                    "dosage": {"type": "STRING", "nullable": True},
                    "startDate": {"type": "STRING", "nullable": True},
                    "endDate": {"type": "STRING", "nullable": True},
                    "status": {
                        "type": "STRING",
                        "enum": ["active", "resolved", "inactive", "completed", "discontinued"],
                        "nullable": True,
                    },
                    "provider": {"type": "STRING", "nullable": True},
                    "instructions": {"type": "STRING", "nullable": True},
                },
                "required": ["medicationName"],
            },
        },
        "reports": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "reportName": {"type": "STRING"},
                    "reportType": {"type": "STRING", "nullable": True},
                    "reportDate": {"type": "STRING", "nullable": True},
                    "conclusion": {"type": "STRING", "nullable": True},
                    "provider": {"type": "STRING", "nullable": True},
                    "labResults": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "testName": {"type": "STRING"},
                                "testCode": {"type": "STRING", "nullable": True},
                                "resultValue": {"type": "STRING", "nullable": True},
                                "unit": {"type": "STRING", "nullable": True},
                                "referenceRange": {"type": "STRING", "nullable": True},
                                "interpretation": {"type": "STRING", "nullable": True},
                                "notes": {"type": "STRING", "nullable": True},
                            },
                            "required": ["testName"],
                        },
                    },
                },
                "required": ["reportName"],
            },
        },
        "warnings": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": [
        "documentType",
        "confidence",
        "prescriptions",
        "vaccinations",
        "allergies",
        "conditions",
        "medications",
        "reports",
        "warnings",
    ],
}


def _count_extracted_records(payload: ParsedDocumentPayload) -> int:
    return (
        len(payload.prescriptions)
        + len(payload.vaccinations)
        + len(payload.allergies)
        + len(payload.conditions)
        + len(payload.medications)
        + len(payload.reports)
    )


def _normalize_empty_dates(data: Any) -> Any:
    """Convert empty-string date fields from LLM output into None before Pydantic validation."""
    if isinstance(data, dict):
        cleaned: Dict[str, Any] = {}
        for k, v in data.items():
            if isinstance(v, str) and v.strip() == "" and ("date" in k.lower() or k == "date"):
                cleaned[k] = None
            else:
                cleaned[k] = _normalize_empty_dates(v)
        return cleaned
    if isinstance(data, list):
        return [_normalize_empty_dates(item) for item in data]
    return data


def parse_document_with_gemini(
    content_bytes: bytes,
    mime_type: str,
    document_type_hint: Optional[str] = None,
) -> ParsedDocumentPayload:
    """
    Mandatory Gemini multimodal extraction.
    Raises RuntimeError / ValueError if GEMINI_API_KEY is missing, the API fails across
    all attempted candidate models, or no structured clinical records could be extracted.
    """
    if not GEMINI_API_KEY or not GEMINI_API_KEY.strip():
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    user_prompt = (
        "Parse this medical document and extract all structured clinical records "
        "(conditions, vaccinations, prescriptions, medications, allergies, and diagnostic/birth/lab reports) "
        "in clean, human-readable timeline format."
    )
    if document_type_hint and document_type_hint != "other":
        user_prompt += f" User document hint: '{document_type_hint}'."

    b64_data = base64.b64encode(content_bytes).decode("ascii")
    body = {
        "systemInstruction": {"parts": [{"text": EXTRACTION_SYSTEM_PROMPT}]},
        "contents": [
            {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": mime_type or "application/pdf",
                            "data": b64_data,
                        }
                    },
                    {"text": user_prompt},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
            "responseSchema": GEMINI_RESPONSE_SCHEMA,
        },
    }

    # Model selection with automatic fallback cascade if the primary model is busy or deprecated
    models_to_try = [GEMINI_MODEL]
    for alt in ["gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-flash-latest"]:
        if alt not in models_to_try:
            models_to_try.append(alt)

    last_error: Optional[Exception] = None
    successful_model: Optional[str] = None
    raw_json: Optional[Dict[str, Any]] = None

    for candidate_model in models_to_try:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{candidate_model}:generateContent?key={GEMINI_API_KEY.strip()}"
        )
        logger.info(
            "Calling Gemini (%s) to extract medical document (%s, %d bytes)...",
            candidate_model,
            mime_type,
            len(content_bytes),
        )
        try:
            with httpx.Client(timeout=PARSER_TIMEOUT_SECONDS) as client:
                resp = client.post(url, json=body)
                resp.raise_for_status()
                raw_json = resp.json()
                successful_model = candidate_model
                break
        except httpx.HTTPStatusError as err:
            status_code = err.response.status_code if err.response else 0
            err_text = err.response.text[:200] if err.response else str(err)
            logger.warning(
                "Gemini model '%s' failed with status %d: %s. Attempting fallback...",
                candidate_model,
                status_code,
                err_text,
            )
            last_error = err
            # Only retry next model on 404 (model not found/deprecated) or 503 (high demand)
            if status_code not in (404, 503, 429):
                raise
        except Exception as exc:
            logger.warning("Gemini model '%s' error: %s. Attempting fallback...", candidate_model, exc)
            last_error = exc

    if not raw_json or not successful_model:
        raise last_error or RuntimeError("All candidate Gemini models failed to process the document.")

    candidates = raw_json.get("candidates") or []
    if not candidates:
        raise ValueError(f"Gemini ({successful_model}) returned no candidates for this document.")

    parts = candidates[0].get("content", {}).get("parts") or []
    text_out = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
    if not text_out:
        raise ValueError("Gemini returned an empty extraction response.")

    parsed_dict = _normalize_empty_dates(json.loads(text_out))
    payload = ParsedDocumentPayload.model_validate(parsed_dict)

    if _count_extracted_records(payload) == 0:
        raise ValueError("No structured medical records could be extracted from this file.")

    return payload


# ---------------------------------------------------------------------------
# Database Orchestration & Atomic Commit into Mediclaim Tables
# ---------------------------------------------------------------------------

def run_parse_and_update_document(
    document_uuid: str,
    content_bytes: bytes,
    mime_type: str,
    filename: str,
    document_type_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run mandatory Gemini extraction and store the structured result on medical_documents.
    On any failure, marks ocr_status='failed' and returns failureMessage='Failed to extract data, upload anyway'.
    """
    try:
        payload = parse_document_with_gemini(
            content_bytes=content_bytes,
            mime_type=mime_type,
            document_type_hint=document_type_hint,
        )
        payload_dict = payload.model_dump(mode="json")

        with get_db() as conn:
            conn.execute(
                """
                UPDATE medical_documents
                SET ocr_status = 'needs_review',
                    document_type = %s,
                    title = COALESCE(%s, title),
                    extracted_payload = %s::jsonb,
                    parse_confidence = %s,
                    parser_provider = %s,
                    parse_error = NULL,
                    parsed_at = now()
                WHERE id = %s
                """,
                (
                    payload.documentType,
                    payload.title,
                    json.dumps(payload_dict),
                    payload.confidence,
                    f"gemini:{GEMINI_MODEL}",
                    document_uuid,
                ),
            )

        return {
            "ocrStatus": "needs_review",
            "parserProvider": f"gemini:{GEMINI_MODEL}",
            "confidence": payload.confidence,
            "extractedData": payload_dict,
        }
    except Exception as exc:
        logger.warning("Gemini document parsing failed for %s: %s", document_uuid, exc)
        with get_db() as conn:
            conn.execute(
                """
                UPDATE medical_documents
                SET ocr_status = 'failed',
                    parser_provider = %s,
                    parse_error = %s,
                    parsed_at = now()
                WHERE id = %s
                """,
                (f"gemini:{GEMINI_MODEL}", str(exc)[:1000], document_uuid),
            )
        return {
            "ocrStatus": "failed",
            "parserProvider": f"gemini:{GEMINI_MODEL}",
            "confidence": 0.0,
            "extractedData": None,
            "failureMessage": FAILURE_USER_MESSAGE,
            "parseError": str(exc),
        }


def commit_parsed_document(
    document_id: str,
    patient_profile_id: str,
    user_id: str,
    actor_name: str = "Patient",
    override_payload: Optional[ParsedDocumentPayload] = None,
) -> Dict[str, Any]:
    """
    Persist verified (or manually entered 'upload anyway') medical records into
    Mediclaim's clinical tables, linking EVERY created clinical_record to
    `medical_documents.id` so the uploaded PDF/image can always be previewed.
    """
    raw_doc_id = document_id.replace("doc-", "").replace("doc_", "")
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")

    with get_db() as conn:
        doc = conn.execute(
            """
            SELECT * FROM medical_documents
            WHERE (id::text = %s OR public_id = %s) AND patient_id = %s AND deleted_at IS NULL
            """,
            (raw_doc_id, raw_doc_id, raw_pat_id),
        ).fetchone()

    if not doc:
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Document Not Found",
            detail=f"Medical document '{document_id}' was not found.",
            code="RECORD_NOT_FOUND",
        )

    if override_payload is not None:
        payload = override_payload
    elif doc.get("extracted_payload"):
        raw_payload = doc["extracted_payload"]
        if isinstance(raw_payload, str):
            raw_payload = json.loads(raw_payload)
        payload = ParsedDocumentPayload.model_validate(raw_payload)
    else:
        raise APIProblemException(
            status_code=status.HTTP_400_BAD_REQUEST,
            title="No Record Data Supplied",
            detail="Please provide verified or manual record details before saving.",
            code="PARSE_DATA_MISSING",
        )

    if _count_extracted_records(payload) == 0:
        raise APIProblemException(
            status_code=status.HTTP_400_BAD_REQUEST,
            title="No Records to Save",
            detail="At least one medical record is required to save.",
            code="EMPTY_RECORDS",
        )

    created: Dict[str, List[Dict[str, Any]]] = {
        "prescriptions": [],
        "vaccinations": [],
        "allergies": [],
        "conditions": [],
        "medications": [],
        "reports": [],
    }
    primary_clinical_record_id: Optional[str] = None

    doc_uuid_str = str(doc["id"])
    doc_file_url = f"/api/v1/documents/doc_{doc_uuid_str}/content"
    doc_mime = (doc.get("mime_type") or "application/pdf").lower()
    doc_file_type = "pdf" if "pdf" in doc_mime else "image"

    # 1. Prescriptions (+ prescription_items + clinical_records)
    for rx in payload.prescriptions:
        rx_input = NewPrescriptionInput(
            title=rx.title.strip(),
            doctor=(rx.doctor or payload.provider or "Unknown Practitioner").strip(),
            organization=rx.organization or payload.organization,
            date=rx.date or payload.documentDate or datetime.now(timezone.utc).date(),
            instructions=rx.instructions,
            medications=rx.medications or None,
            fileType=doc_file_type,
            fileName=doc.get("original_filename"),
            fileSizeBytes=doc.get("file_size_bytes"),
            fileUrl=doc_file_url,
        )
        res = create_prescription(
            patient_profile_id,
            user_id,
            rx_input,
            source="uploaded",
            document_id=doc_uuid_str,
        )
        created["prescriptions"].append(res)
        if not primary_clinical_record_id and res.get("clinicalRecordId"):
            primary_clinical_record_id = res["clinicalRecordId"]

    # 2. Vaccinations (+ clinical_records)
    for vac in payload.vaccinations:
        vac_input = NewVaccinationInput(
            vaccineName=vac.vaccineName.strip(),
            doseNumber=vac.doseNumber or 1,
            administeredDate=vac.administeredDate or payload.documentDate,
            nextDueDate=vac.nextDueDate,
            batchNumber=vac.batchNumber,
            provider=vac.provider or payload.organization or payload.provider or "Healthcare Provider",
            notes=vac.notes,
        )
        res = create_vaccination(
            patient_profile_id,
            user_id,
            vac_input,
            source="uploaded",
            document_id=doc_uuid_str,
        )
        created["vaccinations"].append(res)
        if not primary_clinical_record_id:
            primary_clinical_record_id = res["id"].replace("rec_", "")

    # 3. Allergies (+ clinical_records)
    for alg in payload.allergies:
        alg_input = NewAllergyInput(
            allergen=alg.allergen.strip(),
            category=alg.category or "medication",
            severity=alg.severity or "moderate",
            criticality=alg.criticality or "low",
            reaction=(alg.reaction or "Reported in uploaded document").strip(),
            provider=alg.provider or payload.organization or payload.provider or "Healthcare Provider",
            identifiedDate=alg.identifiedDate or payload.documentDate,
            notes=alg.notes,
        )
        res = create_allergy(
            patient_profile_id,
            user_id,
            alg_input,
            source="uploaded",
            document_id=doc_uuid_str,
        )
        created["allergies"].append(res)
        if not primary_clinical_record_id:
            primary_clinical_record_id = res["id"].replace("rec_", "")

    # 4. Conditions (+ clinical_records)
    for cond in payload.conditions:
        cond_input = NewConditionInput(
            conditionName=cond.conditionName.strip(),
            status=cond.status or "active",
            severity=cond.severity or "mild",
            onsetDate=cond.onsetDate or payload.documentDate,
            resolvedDate=cond.resolvedDate,
            provider=cond.provider or payload.organization or payload.provider or "Healthcare Provider",
            notes=cond.notes,
        )
        res = create_condition(
            patient_profile_id,
            user_id,
            cond_input,
            source="uploaded",
            document_id=doc_uuid_str,
        )
        created["conditions"].append(res)
        if not primary_clinical_record_id:
            primary_clinical_record_id = res["id"].replace("rec_", "")

    # 5. Standalone Medications (+ clinical_records)
    for med in payload.medications:
        med_input = NewMedicationInput(
            medicationName=med.medicationName.strip(),
            dosage=med.dosage,
            startDate=med.startDate or payload.documentDate,
            endDate=med.endDate,
            status=med.status or "active",
            provider=med.provider or payload.organization or payload.provider or "Healthcare Provider",
            instructions=med.instructions,
        )
        res = create_medication(
            patient_profile_id,
            user_id,
            med_input,
            source="uploaded",
            document_id=doc_uuid_str,
        )
        created["medications"].append(res)
        if not primary_clinical_record_id:
            primary_clinical_record_id = res["id"].replace("rec_", "")

    # 6. Diagnostic / Lab / Birth Reports (+ lab_results + clinical_records)
    for rep in payload.reports:
        rep_input = NewReportInput(
            reportName=rep.reportName.strip(),
            reportType=rep.reportType or "lab",
            reportDate=rep.reportDate or payload.documentDate,
            conclusion=rep.conclusion,
            provider=rep.provider or payload.organization or payload.provider or "Diagnostic Centre",
        )
        res = create_report(
            patient_profile_id,
            user_id,
            rep_input,
            source="uploaded",
            lab_results=[lr.model_dump() for lr in rep.labResults],
            document_id=doc_uuid_str,
        )
        created["reports"].append(res)
        if not primary_clinical_record_id:
            primary_clinical_record_id = res["id"].replace("rec_", "")

    total_created = sum(len(v) for v in created.values())

    with get_db() as conn:
        conn.execute(
            """
            UPDATE medical_documents
            SET ocr_status = 'completed',
                clinical_record_id = COALESCE(%s, clinical_record_id),
                extracted_payload = %s::jsonb,
                confirmed_at = now()
            WHERE id = %s
            """,
            (
                primary_clinical_record_id,
                json.dumps(payload.model_dump(mode="json")),
                doc_uuid_str,
            ),
        )

    record_kinds = [k for k, v in created.items() if v]
    try:
        record_audit(
            actor_user_id=user_id,
            patient_id=patient_profile_id,
            action="document_parsed_commit",
            what=f"saved {total_created} record(s) from {doc.get('original_filename') or doc.get('title')}",
            actor_name=actor_name,
            actor_role="Patient",
            resource_kinds=record_kinds,
            resource_table="medical_documents",
            resource_id=doc_uuid_str,
            extra_metadata={"createdCount": total_created, "documentType": payload.documentType},
        )
    except Exception as exc:
        logger.warning("Audit log write skipped during document commit: %s", exc)

    return {
        "documentId": f"doc_{doc_uuid_str}",
        "fileUrl": doc_file_url,
        "ocrStatus": "completed",
        "createdCount": total_created,
        "createdRecords": created,
    }
