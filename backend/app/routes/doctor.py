from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.auth import EnvelopeMeta
from app.schemas.doctor import (
    DoctorPatientsListResponse, DoctorAccessRequestInput, DoctorRequestsListResponse,
    DoctorEncounterInput, DoctorConditionInput, DoctorPrescriptionInput,
    DoctorReportInput, DoctorVaccinationInput,
    DoctorRegisterInput, DoctorRequestOtpInput, DoctorVerifyOtpInput, DoctorLoginInput,
)
from app.services.consent_service import doctor_access_patient, create_access_request
from app.services.doctor_service import (
    list_doctor_patients, list_doctor_requests,
    record_encounter, record_condition, record_prescription,
    record_report, record_vaccination,
    register_doctor, doctor_request_otp, doctor_verify_otp, doctor_login,
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


def _require_doctor(user: AuthenticatedUser) -> None:
    if not user.has_role("doctor", "practitioner", "admin", "hospital_admin", "organization"):
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Access Denied",
            detail="Practitioner, Hospital, or Administrator privileges required.",
            code="UNAUTHORIZED_ROLE",
        )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_practitioner(payload: DoctorRegisterInput):
    data = register_doctor(payload)
    return {
        "status": "success",
        "message": "Practitioner registration submitted. Pending administrator verification.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/login/request-otp", status_code=status.HTTP_200_OK)
def doctor_request_otp_route(payload: DoctorRequestOtpInput):
    data = doctor_request_otp(payload)
    return {
        "status": "success",
        "message": "Verification code sent.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/login/verify-otp", status_code=status.HTTP_200_OK)
def doctor_verify_otp_route(payload: DoctorVerifyOtpInput):
    data = doctor_verify_otp(payload)
    return {
        "status": "success",
        "message": "Practitioner authenticated successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/login", status_code=status.HTTP_200_OK)
def doctor_login_route(payload: DoctorLoginInput):
    data = doctor_login(payload)
    return {
        "status": "success",
        "message": "Practitioner authenticated successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.get("/patients", response_model=DoctorPatientsListResponse, status_code=status.HTTP_200_OK)
def get_authorized_patients(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
    patients = list_doctor_patients(current_user)
    return {
        "status": "success",
        "data": patients,
        "meta": _make_meta(total=len(patients)),
    }


@router.get("/patients/{mediclaim_id}", status_code=status.HTTP_200_OK)
def get_authorized_patient(
    mediclaim_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
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
    _require_doctor(current_user)
    clean_kind = kind if isinstance(kind, str) else None
    data = doctor_access_patient(current_user, mediclaim_id, requested_kind=clean_kind)
    return {
        "status": "success",
        "data": {
            "patient": data["patient"],
            "approvedScopes": data["approvedScopes"],
            "expiresAt": data["expiresAt"],
            "records": data["records"],
            "documents": data.get("documents", []),
        },
        "meta": _make_meta(total=len(data["records"])),
    }


@router.get("/patients/{mediclaim_id}/documents", status_code=status.HTTP_200_OK)
def get_authorized_documents(
    mediclaim_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
    data = doctor_access_patient(current_user, mediclaim_id)
    docs = data.get("documents", [])
    return {
        "status": "success",
        "data": {
            "patient": data["patient"],
            "documents": docs,
        },
        "meta": _make_meta(total=len(docs)),
    }


@router.post("/requests", status_code=status.HTTP_202_ACCEPTED)
def submit_access_request(
    payload: DoctorAccessRequestInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
    data = create_access_request(current_user, payload)
    return {
        "status": "success",
        "message": "Access request queued for patient authorization.",
        "data": data,
        "meta": _make_meta(),
    }


@router.get("/requests", response_model=DoctorRequestsListResponse, status_code=status.HTTP_200_OK)
def get_doctor_access_requests(
    status: Optional[str] = Query("all", description="all | pending | active | revoked"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
    clean_status = status if isinstance(status, str) else "all"
    requests = list_doctor_requests(current_user, status_filter=clean_status)
    return {
        "status": "success",
        "data": requests,
        "meta": _make_meta(total=len(requests)),
    }


@router.post("/patients/{mediclaim_id}/encounters", status_code=status.HTTP_201_CREATED)
def create_encounter(
    mediclaim_id: str,
    payload: DoctorEncounterInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
    data = record_encounter(current_user, mediclaim_id, payload)
    return {
        "status": "success",
        "message": "Encounter record saved.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/patients/{mediclaim_id}/conditions", status_code=status.HTTP_201_CREATED)
def create_condition(
    mediclaim_id: str,
    payload: DoctorConditionInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
    data = record_condition(current_user, mediclaim_id, payload)
    return {
        "status": "success",
        "message": "Condition diagnosed and recorded.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/patients/{mediclaim_id}/prescriptions", status_code=status.HTTP_201_CREATED)
def create_prescription(
    mediclaim_id: str,
    payload: DoctorPrescriptionInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
    data = record_prescription(current_user, mediclaim_id, payload)
    return {
        "status": "success",
        "message": "Prescription issued.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/patients/{mediclaim_id}/reports", status_code=status.HTTP_201_CREATED)
def create_report(
    mediclaim_id: str,
    payload: DoctorReportInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
    data = record_report(current_user, mediclaim_id, payload)
    return {
        "status": "success",
        "message": "Diagnostic report recorded.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/patients/{mediclaim_id}/vaccinations", status_code=status.HTTP_201_CREATED)
def create_vaccination(
    mediclaim_id: str,
    payload: DoctorVaccinationInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    _require_doctor(current_user)
    data = record_vaccination(current_user, mediclaim_id, payload)
    return {
        "status": "success",
        "message": "Vaccination record saved.",
        "data": data,
        "meta": _make_meta(),
    }
