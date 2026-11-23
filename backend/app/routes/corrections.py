from datetime import datetime, timezone
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, status
from app.schemas.auth import EnvelopeMeta, MessageResponse
from app.schemas.corrections import (
    CorrectionRequestInput, CorrectionReviewInput,
    CorrectionRequestsResponse, CorrectionDetailResponse
)
from app.services.corrections_service import (
    create_correction, list_corrections, list_doctor_corrections, list_admin_corrections,
    get_correction_by_id, review_correction, withdraw_correction, get_record_history
)
from app.security import get_current_user, AuthenticatedUser
from app.exceptions import APIProblemException

router = APIRouter()


def _make_meta(total: Optional[int] = None) -> EnvelopeMeta:
    return EnvelopeMeta(
        requestId=f"req_{uuid.uuid4().hex[:12]}",
        serverTime=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        total=total,
    )


def _get_patient_id(user: AuthenticatedUser) -> str:
    if not user.patient_profile_id:
        from app.database import get_db
        with get_db() as conn:
            p_row = conn.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (user.raw_uuid,)).fetchone()
            if p_row:
                return str(p_row["id"])
            new_p_id = uuid.uuid4()
            pub_id = f"pat{new_p_id.hex[:9]}"
            conn.execute("""
                INSERT INTO patient_profiles (id, public_id, user_id, created_at, updated_at)
                VALUES (%s, %s, %s, now(), now())
            """, (str(new_p_id), pub_id, user.raw_uuid))
            return str(new_p_id)
    return user.patient_profile_id


@router.post("", status_code=status.HTTP_201_CREATED)
def request_correction(
    payload: CorrectionRequestInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = create_correction(pat_id, current_user.id, payload)
    return {
        "status": "success",
        "message": "Correction request submitted for clinical review.",
        "data": data,
        "meta": _make_meta(),
    }


@router.get("", response_model=CorrectionRequestsResponse, status_code=status.HTTP_200_OK)
def get_my_corrections(
    status: Optional[str] = None,
    patientMediclaimId: Optional[str] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if current_user.has_role("admin"):
        corrections = list_admin_corrections(status_filter=status, patient_mediclaim_id=patientMediclaimId)
    elif current_user.has_role("practitioner", "doctor", "hospital_admin") or current_user.practitioner_profile_id:
        corrections = list_doctor_corrections(current_user, status_filter=status, patient_mediclaim_id=patientMediclaimId)
    elif current_user.patient_profile_id:
        corrections = list_corrections(current_user.patient_profile_id)
    else:
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Profile Incomplete",
            detail="User does not have an active profile or role.",
            code="PROFILE_INCOMPLETE"
        )
    return {
        "status": "success",
        "data": corrections,
        "meta": _make_meta(total=len(corrections)),
    }


@router.get("/{id}", response_model=CorrectionDetailResponse, status_code=status.HTTP_200_OK)
def get_correction(
    id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    data = get_correction_by_id(id)
    return {
        "status": "success",
        "data": data,
        "meta": _make_meta(),
    }


@router.patch("/{id}", status_code=status.HTTP_200_OK)
def review_patient_correction(
    id: str,
    payload: CorrectionReviewInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    data = review_correction(current_user, id, payload)
    return {
        "status": "success",
        "message": f"Correction request {payload.status}.",
        "data": data,
        "meta": _make_meta(),
    }


@router.delete("/{id}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def withdraw_patient_correction(
    id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    withdraw_correction(pat_id, id)
    return {
        "status": "success",
        "message": "Correction request withdrawn.",
        "meta": _make_meta(),
    }


@router.get("/records/{record_id}/history", status_code=status.HTTP_200_OK)
def record_history(
    record_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    history = get_record_history(record_id)
    return {
        "status": "success",
        "data": history,
        "meta": _make_meta(total=len(history)),
    }
