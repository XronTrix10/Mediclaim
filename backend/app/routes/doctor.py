from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.auth import EnvelopeMeta
from app.services.consent_service import doctor_access_patient
from app.security import get_current_user, AuthenticatedUser

router = APIRouter()


def _make_meta(total: Optional[int] = None) -> EnvelopeMeta:
    return EnvelopeMeta(
        requestId=f"req_{uuid.uuid4().hex[:12]}",
        serverTime=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        total=total,
    )


@router.get("/patients/{mediclaim_id}", status_code=status.HTTP_200_OK)
def get_authorized_patient(
    mediclaim_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    data = doctor_access_patient(current_user, mediclaim_id)
    return {
        "status": "success",
        "data": data["patient"],
        "meta": _make_meta(),
    }


@router.get("/patients/{mediclaim_id}/records", status_code=status.HTTP_200_OK)
def get_authorized_records(
    mediclaim_id: str,
    kind: Optional[str] = Query(None, description="Optional kind filter; must be within approved scope"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    clean_kind = kind if isinstance(kind, str) else None
    data = doctor_access_patient(current_user, mediclaim_id, requested_kind=clean_kind)
    return {
        "status": "success",
        "data": {
            "patient": data["patient"],
            "approvedScopes": data["approvedScopes"],
            "expiresAt": data["expiresAt"],
            "records": data["records"]
        },
        "meta": _make_meta(total=len(data["records"])),
    }
