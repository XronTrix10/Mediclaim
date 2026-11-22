from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.auth import EnvelopeMeta, MessageResponse
from app.schemas.consent import (
    AccessRequestInput, AccessRequestsListResponse, ApproveRequestInput,
    AccessGrantsListResponse, GiveAccessInput, CaregiversListResponse,
    NewCaregiverInput, GrantActionResponse
)
from app.services.consent_service import (
    create_access_request, list_access_requests, approve_access_request,
    decline_access_request, list_access_grants, directly_give_access,
    revoke_access_grant, list_caregivers, add_caregiver, remove_caregiver
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
    if user.patient_profile_id:
        return user.patient_profile_id.replace("pat-", "").replace("pat_", "")
    # Ensure patient profile exists for authenticated user
    raw_uid = user.raw_uuid
    from app.database import get_db
    import secrets
    with get_db() as conn:
        row = conn.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (raw_uid,)).fetchone()
        if row:
            return str(row["id"])
        new_uuid = uuid.uuid4()
        pub_id = f"pat{secrets.randbelow(900_000_000) + 100_000_000}"
        conn.execute("""
            INSERT INTO patient_profiles (id, public_id, user_id, created_at, updated_at)
            VALUES (%s, %s, %s, now(), now())
            ON CONFLICT (user_id) DO NOTHING
        """, (str(new_uuid), raw_uid, pub_id))
        return str(new_uuid)


# --- Doctor Initiated Access Requests ---
@router.post("/requests", status_code=status.HTTP_202_ACCEPTED)
def request_access(
    payload: AccessRequestInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    data = create_access_request(current_user, payload)
    return {
        "status": "success",
        "message": "Access request queued for patient authorization.",
        "data": data,
        "meta": _make_meta(),
    }


# --- Patient Access Request Review ---
@router.get("/requests", response_model=AccessRequestsListResponse, status_code=status.HTTP_200_OK)
def get_requests(
    status: Optional[str] = Query("pending", description="pending | approved | revoked"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    requests = list_access_requests(pat_id, status_filter=status or "pending")
    return {
        "status": "success",
        "data": requests,
        "meta": _make_meta(total=len(requests)),
    }


@router.post("/requests/{id}/approve", status_code=status.HTTP_200_OK)
def approve_request(
    id: str,
    payload: ApproveRequestInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = approve_access_request(pat_id, id, payload)
    return {
        "status": "success",
        "message": "Doctor access approved.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/requests/{id}/decline", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def decline_request(
    id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    decline_access_request(pat_id, id)
    return {
        "status": "success",
        "message": "Access request declined.",
        "meta": _make_meta(),
    }


# --- Grants Management ---
@router.get("/grants", response_model=AccessGrantsListResponse, status_code=status.HTTP_200_OK)
def get_grants(
    status: Optional[str] = Query("active", description="active | expired | revoked | all"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    grants = list_access_grants(pat_id, status_filter=status)
    return {
        "status": "success",
        "data": grants,
        "meta": _make_meta(total=len(grants)),
    }


@router.post("/grants", status_code=status.HTTP_201_CREATED)
def give_access(
    payload: GiveAccessInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = directly_give_access(pat_id, current_user.id, payload)
    return {
        "status": "success",
        "message": "Access granted.",
        "data": data,
        "meta": _make_meta(),
    }


@router.delete("/grants/{id}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def revoke_grant(
    id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    revoke_access_grant(pat_id, id)
    return {
        "status": "success",
        "message": "Doctor access revoked immediately. Session terminated.",
        "meta": _make_meta(),
    }


# --- Caregivers ---
@router.get("/caregivers", response_model=CaregiversListResponse, status_code=status.HTTP_200_OK)
def get_caregivers(current_user: AuthenticatedUser = Depends(get_current_user)):
    pat_id = _get_patient_id(current_user)
    caregivers = list_caregivers(pat_id)
    return {
        "status": "success",
        "data": caregivers,
        "meta": _make_meta(total=len(caregivers)),
    }


@router.post("/caregivers", status_code=status.HTTP_201_CREATED)
def create_caregiver(
    payload: NewCaregiverInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = add_caregiver(pat_id, payload)
    return {
        "status": "success",
        "message": "Caregiver added successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.delete("/caregivers/{id}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def delete_caregiver(
    id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    remove_caregiver(pat_id, id)
    return {
        "status": "success",
        "message": "Caregiver removed successfully.",
        "meta": _make_meta(),
    }
