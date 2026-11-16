from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, status
from app.schemas.auth import EnvelopeMeta
from app.schemas.emergency import (
    EmergencyAccessInput, EmergencyAccessResponse, EmergencyEventsResponse
)
from app.services.emergency_service import trigger_emergency_access, list_emergency_events
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
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Profile Incomplete",
            detail="User does not have an active patient profile.",
            code="PROFILE_INCOMPLETE"
        )
    return user.patient_profile_id


@router.post("/access", response_model=EmergencyAccessResponse, status_code=status.HTTP_200_OK)
def emergency_access(
    payload: EmergencyAccessInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    data = trigger_emergency_access(current_user, payload)
    return {
        "status": "success",
        "message": "Emergency access authorized under break-glass protocol.",
        "data": data,
        "meta": _make_meta(),
    }


@router.get("/events", response_model=EmergencyEventsResponse, status_code=status.HTTP_200_OK)
def get_emergency_events(current_user: AuthenticatedUser = Depends(get_current_user)):
    pat_id = _get_patient_id(current_user)
    events = list_emergency_events(pat_id)
    return {
        "status": "success",
        "data": events,
        "meta": _make_meta(total=len(events)),
    }
