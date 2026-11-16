from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, status
from app.schemas.auth import EnvelopeMeta
from app.schemas.patient import (
    PatientProfileResponse, CompleteProfileRequest, CompleteProfileResponse,
    PermittedDetailsUpdateRequest, PermittedDetailsUpdateResponse
)
from app.services.patient_service import (
    get_patient_profile, complete_patient_profile, update_permitted_details
)
from app.security import get_current_user, AuthenticatedUser

router = APIRouter()


def _make_meta() -> EnvelopeMeta:
    return EnvelopeMeta(
        requestId=f"req_{uuid.uuid4().hex[:12]}",
        serverTime=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


@router.get("/me", response_model=PatientProfileResponse, status_code=status.HTTP_200_OK)
def get_my_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    data = get_patient_profile(current_user.id)
    return {
        "status": "success",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/me/complete-profile", response_model=CompleteProfileResponse, status_code=status.HTTP_200_OK)
@router.post("/me/complete", response_model=CompleteProfileResponse, status_code=status.HTTP_200_OK)
def complete_profile(
    payload: CompleteProfileRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    data = complete_patient_profile(current_user.id, payload)
    return {
        "status": "success",
        "message": "Patient profile completed successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.patch("/me/permitted-details", response_model=PermittedDetailsUpdateResponse, status_code=status.HTTP_200_OK)
@router.patch("/me", response_model=PermittedDetailsUpdateResponse, status_code=status.HTTP_200_OK)
def update_details(
    payload: PermittedDetailsUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    data = update_permitted_details(current_user.id, payload)
    return {
        "status": "success",
        "message": "Permitted details updated successfully.",
        "data": data,
        "meta": _make_meta(),
    }
