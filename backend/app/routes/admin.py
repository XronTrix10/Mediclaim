from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.auth import EnvelopeMeta, MessageResponse
from app.schemas.admin import (
    PendingVerificationsResponse, VerificationDetailResponse,
    ApprovePatientResponse, RejectPatientRequest,
    AdminStatsResponse, AdminPatientsResponse
)
from app.services.admin_service import (
    list_pending_verifications, get_verification_detail, approve_patient,
    reject_patient, get_admin_stats, list_all_patients, list_global_emergency_events
)
from app.security import require_role, AuthenticatedUser

router = APIRouter()


def _make_meta(total: Optional[int] = None, next_cursor: Optional[str] = None) -> EnvelopeMeta:
    return EnvelopeMeta(
        requestId=f"req_{uuid.uuid4().hex[:12]}",
        serverTime=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        total=total,
        nextCursor=next_cursor,
    )


@router.get("/verifications", response_model=PendingVerificationsResponse, status_code=status.HTTP_200_OK)
def get_pending_verifications(
    limit: int = 50,
    offset: int = 0,
    query: Optional[str] = Query(None, description="Search by full name, phone, Aadhaar, or Mediclaim ID"),
    status: Optional[str] = Query(None, description="Filter by status: pending | verified | all"),
    current_user: AuthenticatedUser = Depends(require_role("admin", "hospital_admin")),
):
    clean_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 50
    clean_offset = int(offset) if isinstance(offset, (int, str)) and str(offset).isdigit() else 0
    clean_query = query if isinstance(query, str) else None
    clean_status = status.lower().strip() if isinstance(status, str) else None

    items, total = list_pending_verifications(
        limit=clean_limit,
        offset=clean_offset,
        search_query=clean_query,
        status_filter=clean_status,
    )
    return {
        "status": "success",
        "data": items,
        "meta": _make_meta(total=total),
    }


@router.get("/verifications/{user_id}", response_model=VerificationDetailResponse, status_code=status.HTTP_200_OK)
def get_patient_verification_detail(
    user_id: str,
    current_user: AuthenticatedUser = Depends(require_role("admin", "hospital_admin")),
):
    data = get_verification_detail(user_id)
    return {
        "status": "success",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/verifications/{user_id}/approve", response_model=ApprovePatientResponse, status_code=status.HTTP_200_OK)
def approve_patient_verification(
    user_id: str,
    current_user: AuthenticatedUser = Depends(require_role("admin", "hospital_admin")),
):
    data = approve_patient(current_user, user_id)
    return {
        "status": "success",
        "message": "Patient verification approved. Mediclaim ID dispatched to user.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/verifications/{user_id}/reject", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def reject_patient_verification(
    user_id: str,
    payload: RejectPatientRequest,
    current_user: AuthenticatedUser = Depends(require_role("admin", "hospital_admin")),
):
    reject_patient(current_user, user_id, payload.reason)
    return {
        "status": "success",
        "message": f"Patient registration rejected: {payload.reason}",
        "meta": _make_meta(),
    }


@router.get("/stats", response_model=AdminStatsResponse, status_code=status.HTTP_200_OK)
def get_system_stats(
    current_user: AuthenticatedUser = Depends(require_role("admin", "hospital_admin")),
):
    stats_data = get_admin_stats()
    return {
        "status": "success",
        "data": stats_data,
        "meta": _make_meta(),
    }


@router.get("/patients", response_model=AdminPatientsResponse, status_code=status.HTTP_200_OK)
def get_all_patients(
    limit: int = 50,
    offset: int = 0,
    query: Optional[str] = None,
    verified_only: Optional[bool] = None,
    current_user: AuthenticatedUser = Depends(require_role("admin", "hospital_admin")),
):
    clean_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 50
    clean_offset = int(offset) if isinstance(offset, (int, str)) and str(offset).isdigit() else 0
    clean_query = query if isinstance(query, str) else None

    items, total = list_all_patients(
        limit=clean_limit,
        offset=clean_offset,
        search_query=clean_query,
        verified_only=verified_only,
    )
    return {
        "status": "success",
        "data": items,
        "meta": _make_meta(total=total),
    }


@router.get("/emergency-events", status_code=status.HTTP_200_OK)
def get_emergency_events(
    limit: int = 50,
    offset: int = 0,
    current_user: AuthenticatedUser = Depends(require_role("admin", "hospital_admin")),
):
    clean_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 50
    clean_offset = int(offset) if isinstance(offset, (int, str)) and str(offset).isdigit() else 0

    items, total = list_global_emergency_events(limit=clean_limit, offset=clean_offset)
    return {
        "status": "success",
        "data": items,
        "meta": _make_meta(total=total),
    }
