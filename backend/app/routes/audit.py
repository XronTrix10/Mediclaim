from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.auth import EnvelopeMeta
from app.schemas.audit import AuditLogsResponse
from app.services.audit_service import list_audit_logs
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


@router.get("", response_model=AuditLogsResponse, status_code=status.HTTP_200_OK)
@router.get("/", response_model=AuditLogsResponse, status_code=status.HTTP_200_OK)
@router.get("/logs", response_model=AuditLogsResponse, status_code=status.HTTP_200_OK)
def get_audit_logs(
    limit: int = 50,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    action: Optional[str] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    clean_from = from_date if isinstance(from_date, str) else None
    clean_to = to_date if isinstance(to_date, str) else None
    clean_action = action if isinstance(action, str) else None
    clean_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 50

    logs = list_audit_logs(
        patient_profile_id=pat_id,
        limit=clean_limit,
        from_date=clean_from,
        to_date=clean_to,
        action_filter=clean_action,
    )
    return {
        "status": "success",
        "data": logs,
        "meta": _make_meta(total=len(logs)),
    }
