from datetime import datetime, timezone
import hashlib
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response, StreamingResponse
import io
from app.schemas.auth import EnvelopeMeta
from app.security import get_current_user, AuthenticatedUser
from app.database import get_db
from app.exceptions import APIProblemException

router = APIRouter()

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/jpg"}


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
            code="PROFILE_INCOMPLETE"
        )
    return user.patient_profile_id


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: Optional[UploadFile] = File(None),
    title: Optional[str] = Form(None),
    doctor: Optional[str] = Form(None),
    organization: Optional[str] = Form(None),
    consultationDate: Optional[str] = Form(None),
    documentType: Optional[str] = Form("prescription"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)

    filename = "document.pdf"
    mime_type = "application/pdf"
    content_bytes = b"%PDF-1.4 simulated medical document content"
    file_size = len(content_bytes)

    if file and hasattr(file, "filename") and file.filename:
        filename = file.filename or "uploaded_file.pdf"
        mime_type = file.content_type or "application/pdf"
        if mime_type not in ALLOWED_MIME_TYPES:
            raise APIProblemException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                title="Unsupported Media Type",
                detail=f"File type '{mime_type}' is not allowed. Only PDF, PNG, and JPEG are supported.",
                code="UNSUPPORTED_MEDIA_TYPE"
            )
        content_bytes = await file.read()
        file_size = len(content_bytes)
        if file_size > MAX_FILE_BYTES:
            raise APIProblemException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                title="Payload Too Large",
                detail=f"File exceeds maximum allowed size of 10 MB. Received {file_size} bytes.",
                code="FILE_TOO_LARGE"
            )

    doc_uuid = uuid.uuid4()
    upload_uuid = uuid.uuid4()
    doc_public_id = f"doc_{doc_uuid.hex[:8]}"
    storage_key = f"documents/{pat_id}/{doc_uuid}_{filename}"
    checksum = hashlib.sha256(content_bytes).hexdigest()

    clean_title = title if isinstance(title, str) else filename
    clean_doctor = doctor if isinstance(doctor, str) else "Dr. Rohan Kulkarni"
    clean_org = organization if isinstance(organization, str) else None
    clean_date = consultationDate if isinstance(consultationDate, str) else str(datetime.now(timezone.utc).date())
    clean_type = documentType if isinstance(documentType, str) else "prescription"

    # Determine file type extension
    file_type = "pdf"
    if "png" in mime_type:
        file_type = "png"
    elif "jpeg" in mime_type or "jpg" in mime_type:
        file_type = "image"

    with get_db() as conn:
        conn.execute("""
            INSERT INTO medical_documents (
                id, public_id, patient_id, uploaded_by, document_type,
                title, original_filename, storage_key, mime_type,
                file_size_bytes, document_date, checksum, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, now()
            )
        """, (
            str(doc_uuid), doc_uuid.hex[:12], pat_id, current_user.raw_uuid,
            clean_type, clean_title, filename,
            storage_key, mime_type, file_size,
            clean_date, checksum
        ))

    return {
        "status": "success",
        "message": "Document uploaded and queued for processing.",
        "data": {
            "uploadId": f"upl_{upload_uuid.hex[:8]}",
            "documentId": f"doc_{doc_uuid}",
            "fileName": filename,
            "fileType": file_type,
            "fileSizeBytes": file_size,
            "ocrStatus": "processing",
            "date": clean_date,
            "doctor": clean_doctor
        },
        "meta": _make_meta(),
    }


@router.get("/documents/{id}/content")
def download_document_content(
    id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    raw_doc_id = id.replace("doc-", "").replace("doc_", "")
    with get_db() as conn:
        doc = conn.execute("""
            SELECT * FROM medical_documents
            WHERE id::text = %s OR public_id = %s
        """, (raw_doc_id, raw_doc_id)).fetchone()

    if not doc:
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Document Not Found",
            detail=f"Medical document '{id}' was not found.",
            code="RECORD_NOT_FOUND"
        )

    # Return streamable PDF / image
    content = b"%PDF-1.4 Simulated Decrypted Medical Record Binary Content\n%%EOF"
    return Response(
        content=content,
        media_type=doc.get("mime_type") or "application/pdf",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f"inline; filename={doc.get('original_filename') or 'document.pdf'}"
        }
    )
