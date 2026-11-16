from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.auth import EnvelopeMeta
from app.schemas.timeline import TimelineResponse, GraphResponse
from app.services.timeline_service import get_timeline, get_health_graph
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


@router.get("", response_model=TimelineResponse, status_code=status.HTTP_200_OK)
def get_patient_timeline(
    kind: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    limit: int = 100,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    clean_from = from_date if isinstance(from_date, str) else None
    clean_to = to_date if isinstance(to_date, str) else None
    clean_kind = kind if isinstance(kind, str) else None
    clean_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 100

    data = get_timeline(
        patient_profile_id=pat_id,
        kind=clean_kind,
        from_date=clean_from,
        to_date=clean_to,
        limit=clean_limit,
    )
    return {
        "status": "success",
        "data": data,
        "meta": _make_meta(total=data["totalEvents"]),
    }


@router.get("/graph", response_model=GraphResponse, status_code=status.HTTP_200_OK)
def get_graph(
    leaves: Optional[int] = Query(None, ge=1, le=50),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    clean_leaves = int(leaves) if isinstance(leaves, (int, str)) and str(leaves).isdigit() else None
    data = get_health_graph(patient_profile_id=pat_id, leaves=clean_leaves)
    return {
        "status": "success",
        "data": data,
        "meta": _make_meta(total=len(data["nodes"])),
    }
