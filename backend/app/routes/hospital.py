from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.auth import EnvelopeMeta
from app.schemas.hospital import (
    OrganizationCreateInput, OrganizationsListResponse,
    PractitionerCreateInput, PractitionersListResponse,
)
from app.services.hospital_service import (
    list_organizations, get_organization, create_organization,
    list_practitioners, get_practitioner, create_practitioner,
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


def _require_admin_or_hospital(user: AuthenticatedUser) -> None:
    if not user.has_role("admin", "hospital_admin"):
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Access Denied",
            detail="Hospital Administrator or System Administrator privileges required.",
            code="UNAUTHORIZED_ROLE",
        )


@router.get("/organizations", response_model=OrganizationsListResponse, status_code=status.HTTP_200_OK)
def get_organizations(
    q: Optional[str] = Query(None, description="Search by name or registration number"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    clean_q = q if isinstance(q, str) else None
    clean_page = int(page) if isinstance(page, (int, str)) and str(page).isdigit() else 1
    clean_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 20
    res = list_organizations(query=clean_q, page=clean_page, limit=clean_limit)
    return {
        "status": "success",
        "data": res["organizations"],
        "meta": _make_meta(total=res["total"]),
    }


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
def register_organization(
    payload: OrganizationCreateInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_admin_or_hospital(current_user)
    data = create_organization(payload)
    return {
        "status": "success",
        "message": "Healthcare organization registered successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.get("/organizations/{org_id}", status_code=status.HTTP_200_OK)
def get_organization_detail(
    org_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    data = get_organization(org_id)
    return {
        "status": "success",
        "data": data,
        "meta": _make_meta(),
    }


@router.get("/practitioners", response_model=PractitionersListResponse, status_code=status.HTTP_200_OK)
def get_practitioners(
    organizationId: Optional[str] = Query(None, description="Filter by healthcare organization"),
    specialization: Optional[str] = Query(None, description="Filter by medical specialization"),
    q: Optional[str] = Query(None, description="Search doctor name or registration number"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    clean_org_id = organizationId if isinstance(organizationId, str) else None
    clean_spec = specialization if isinstance(specialization, str) else None
    clean_q = q if isinstance(q, str) else None
    clean_page = int(page) if isinstance(page, (int, str)) and str(page).isdigit() else 1
    clean_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 20
    res = list_practitioners(
        organization_id=clean_org_id,
        specialization=clean_spec,
        query=clean_q,
        page=clean_page,
        limit=clean_limit,
    )
    return {
        "status": "success",
        "data": res["practitioners"],
        "meta": _make_meta(total=res["total"]),
    }


@router.post("/practitioners", status_code=status.HTTP_201_CREATED)
def onboard_practitioner(
    payload: PractitionerCreateInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_admin_or_hospital(current_user)
    data = create_practitioner(payload, creator_user_id=current_user.raw_uuid)
    return {
        "status": "success",
        "message": "Practitioner onboarded successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.get("/practitioners/{practitioner_id}", status_code=status.HTTP_200_OK)
def get_practitioner_detail(
    practitioner_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    data = get_practitioner(practitioner_id)
    return {
        "status": "success",
        "data": data,
        "meta": _make_meta(),
    }
