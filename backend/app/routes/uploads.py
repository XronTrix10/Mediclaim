from datetime import datetime, timezone
import hashlib
import json
import uuid
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import Response
from app.schemas.auth import EnvelopeMeta
from app.schemas.uploads import CommitParsedDocumentRequest
from app.security import get_current_user, AuthenticatedUser
from app.database import get_db
from app.exceptions import APIProblemException
from app.services.storage_service import save_document_bytes, read_document_bytes
from app.services.document_parser import (
    FAILURE_USER_MESSAGE,
    commit_parsed_document,
    run_parse_and_update_document,
)

router = APIRouter()

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}


def _make_meta() -> EnvelopeMeta:
    return EnvelopeMeta(
        requestId=f"req_{uuid.uuid4().hex[:12]}",
        serverTime=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


def _get_patient_id(user: AuthenticatedUser) -> str:
    if not user.patient_profile_id:
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Profile Incomplete",
            detail="User does not have an active patient profile.",
            code="PROFILE_INCOMPLETE",
        )
    return user.patient_profile_id


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks = None,
    file: Optional[UploadFile] = File(None),
    title: Optional[str] = Form(None),
    doctor: Optional[str] = Form(None),
    organization: Optional[str] = Form(None),
    consultationDate: Optional[str] = Form(None),
    documentType: Optional[str] = Form("other"),
    autoParse: bool = Form(True),
    asyncMode: bool = Form(False),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)

    filename = "document.pdf"
    mime_type = "application/pdf"
    content_bytes = b"%PDF-1.4 simulated medical document content"
    file_size = len(content_bytes)
    has_real_file = False

    if file and hasattr(file, "filename") and file.filename:
        has_real_file = True
        filename = file.filename or "uploaded_file.pdf"
        mime_type = file.content_type or "application/pdf"
        if mime_type not in ALLOWED_MIME_TYPES:
            raise APIProblemException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                title="Unsupported Media Type",
                detail=f"File type '{mime_type}' is not allowed. Only PDF, PNG, JPEG, and WEBP are supported.",
                code="UNSUPPORTED_MEDIA_TYPE",
            )
        content_bytes = await file.read()
        file_size = len(content_bytes)
        if file_size > MAX_FILE_BYTES:
            raise APIProblemException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                title="Payload Too Large",
                detail=f"File exceeds maximum allowed size of 10 MB. Received {file_size} bytes.",
                code="FILE_TOO_LARGE",
            )

    doc_uuid = uuid.uuid4()
    upload_uuid = uuid.uuid4()
    safe_filename = filename.replace("/", "_").replace("\\", "_")
    storage_key = f"documents/{pat_id}/{doc_uuid}_{safe_filename}"
    checksum = hashlib.sha256(content_bytes).hexdigest()

    # Always persist uploaded binary content so it can be previewed whether parsing succeeds or fails
    save_document_bytes(storage_key, content_bytes)

    clean_title = title if isinstance(title, str) and title.strip() else filename
    clean_doctor = doctor if isinstance(doctor, str) and doctor.strip() else "Dr. Rohan Kulkarni"
    clean_date = (
        consultationDate
        if isinstance(consultationDate, str) and consultationDate.strip()
        else str(datetime.now(timezone.utc).date())
    )
    clean_type = documentType if isinstance(documentType, str) and documentType.strip() else "other"

    file_type = "pdf" if "pdf" in mime_type.lower() else "image"
    initial_ocr_status = "processing" if (autoParse and has_real_file) else "pending"

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO medical_documents (
                id, public_id, patient_id, uploaded_by, document_type,
                title, original_filename, storage_key, mime_type,
                file_size_bytes, document_date, checksum, ocr_status, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, now()
            )
            """,
            (
                str(doc_uuid),
                doc_uuid.hex[:12],
                pat_id,
                current_user.raw_uuid,
                clean_type,
                clean_title,
                filename,
                storage_key,
                mime_type,
                file_size,
                clean_date,
                checksum,
                initial_ocr_status,
            ),
        )

    ocr_status = initial_ocr_status
    extracted_data = None
    parser_used = None
    confidence = None
    failure_message = None
    parse_error = None

    if autoParse and has_real_file:
        if asyncMode and background_tasks is not None:
            background_tasks.add_task(
                run_parse_and_update_document,
                str(doc_uuid),
                content_bytes,
                mime_type,
                filename,
                clean_type,
            )
            ocr_status = "processing"
        else:
            parse_result = run_parse_and_update_document(
                document_uuid=str(doc_uuid),
                content_bytes=content_bytes,
                mime_type=mime_type,
                filename=filename,
                document_type_hint=clean_type,
            )
            ocr_status = parse_result["ocrStatus"]
            extracted_data = parse_result.get("extractedData")
            parser_used = parse_result.get("parserProvider")
            confidence = parse_result.get("confidence")
            failure_message = parse_result.get("failureMessage")
            parse_error = parse_result.get("parseError")

    response_data = {
        "uploadId": f"upl_{upload_uuid.hex[:8]}",
        "documentId": f"doc_{doc_uuid}",
        "fileName": filename,
        "fileType": file_type,
        "fileSizeBytes": file_size,
        "fileUrl": f"/api/v1/documents/doc_{doc_uuid}/content",
        "ocrStatus": ocr_status,
        "date": clean_date,
        "doctor": clean_doctor,
    }
    if extracted_data is not None:
        response_data["extractedData"] = extracted_data
    if parser_used is not None:
        response_data["parserProvider"] = parser_used
    if confidence is not None:
        response_data["confidence"] = confidence
    if failure_message is not None:
        response_data["failureMessage"] = failure_message
    if parse_error is not None:
        response_data["parseError"] = parse_error

    msg = "Document uploaded and queued for processing."
    if ocr_status == "needs_review":
        msg = "Document parsed with Gemini. Please verify the extracted details before saving."
    elif ocr_status == "failed":
        msg = FAILURE_USER_MESSAGE

    return {
        "status": "success",
        "message": msg,
        "data": response_data,
        "meta": _make_meta(),
    }


@router.get("/documents/{id}/parse-status", status_code=status.HTTP_200_OK)
def get_document_parse_status(
    id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    raw_doc_id = id.replace("doc-", "").replace("doc_", "")
    with get_db() as conn:
        doc = conn.execute(
            """
            SELECT id, public_id, title, original_filename, document_type, mime_type,
                   file_size_bytes, ocr_status, extracted_payload, parse_confidence,
                   parser_provider, parse_error, parsed_at, confirmed_at
            FROM medical_documents
            WHERE (id::text = %s OR public_id = %s) AND patient_id = %s AND deleted_at IS NULL
            """,
            (raw_doc_id, raw_doc_id, pat_id),
        ).fetchone()

    if not doc:
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Document Not Found",
            detail=f"Medical document '{id}' was not found.",
            code="RECORD_NOT_FOUND",
        )

    extracted_payload = doc.get("extracted_payload")
    if isinstance(extracted_payload, str):
        extracted_payload = json.loads(extracted_payload)

    ocr_status = doc.get("ocr_status") or "pending"
    mime_type = (doc.get("mime_type") or "application/pdf").lower()

    return {
        "status": "success",
        "data": {
            "documentId": f"doc_{doc['id']}",
            "title": doc["title"],
            "fileName": doc["original_filename"],
            "fileType": "pdf" if "pdf" in mime_type else "image",
            "fileSizeBytes": doc.get("file_size_bytes"),
            "fileUrl": f"/api/v1/documents/doc_{doc['id']}/content",
            "documentType": doc["document_type"],
            "ocrStatus": ocr_status,
            "parserProvider": doc.get("parser_provider"),
            "confidence": doc.get("parse_confidence"),
            "extractedData": extracted_payload,
            "failureMessage": FAILURE_USER_MESSAGE if ocr_status == "failed" else None,
            "parseError": doc.get("parse_error"),
            "parsedAt": doc["parsed_at"].isoformat() if doc.get("parsed_at") else None,
            "confirmedAt": doc["confirmed_at"].isoformat() if doc.get("confirmed_at") else None,
        },
        "meta": _make_meta(),
    }


@router.post("/documents/{id}/commit", status_code=status.HTTP_201_CREATED)
def commit_document_records(
    id: str,
    body: Optional[CommitParsedDocumentRequest] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    override_payload = body.payload if body else None
    result = commit_parsed_document(
        document_id=id,
        patient_profile_id=pat_id,
        user_id=current_user.id,
        actor_name=current_user.full_name,
        override_payload=override_payload,
    )
    return {
        "status": "success",
        "message": f"Saved {result['createdCount']} record(s) to your health profile.",
        "data": result,
        "meta": _make_meta(),
    }


@router.get("/documents/{id}/content")
def download_document_content(
    id: str,
    download: bool = Query(False, description="Whether attachment download is requested"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    raw_doc_id = id.replace("doc-", "").replace("doc_", "")
    with get_db() as conn:
        doc = conn.execute(
            """
            SELECT * FROM medical_documents
            WHERE (id::text = %s OR public_id = %s) AND deleted_at IS NULL
            """,
            (raw_doc_id, raw_doc_id),
        ).fetchone()

    if not doc:
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Document Not Found",
            detail=f"Medical document '{id}' was not found.",
            code="RECORD_NOT_FOUND",
        )

    is_owner = (
        current_user.patient_profile_id
        and str(doc["patient_id"]) == str(current_user.patient_profile_id).replace("pat-", "").replace("pat_", "")
    )
    is_privileged = current_user.has_role("admin", "doctor", "practitioner", "hospital_admin", "organization")
    if not is_owner and not is_privileged:
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Access Denied",
            detail="You are not authorized to view this medical document.",
            code="FORBIDDEN",
        )

    # Restrict practitioners from downloading patient files directly (preview access only)
    if download and not is_owner and not current_user.has_role("admin"):
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Download Restricted",
            detail="Practitioners are restricted from downloading patient documents. Preview access only.",
            code="DOWNLOAD_RESTRICTED",
        )

    stored_bytes = read_document_bytes(doc.get("storage_key") or "")
    content = stored_bytes if stored_bytes is not None else b"%PDF-1.4 Simulated Decrypted Medical Record Binary Content\n%%EOF"

    disposition_type = "attachment" if (download and (is_owner or current_user.has_role("admin"))) else "inline"

    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": f"{disposition_type}; filename={doc.get('original_filename') or 'document.pdf'}",
    }

    return Response(
        content=content,
        media_type=doc.get("mime_type") or "application/pdf",
        headers=headers,
    )
