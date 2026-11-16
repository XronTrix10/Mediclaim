from datetime import datetime, timezone
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.auth import EnvelopeMeta, MessageResponse
from app.schemas.records import (
    RecordsListResponse, RecordDetailResponse, PrescriptionsListResponse,
    NewAllergyInput, NewConditionInput, NewMedicationInput, NewVaccinationInput,
    NewReportInput, NewPrescriptionInput
)
from app.services.records_service import (
    list_patient_records, get_record_by_id, create_allergy,
    create_condition, create_medication, create_vaccination, create_report,
    list_prescriptions, create_prescription, retract_prescription
)
from app.security import get_current_user, AuthenticatedUser
from app.exceptions import APIProblemException

router = APIRouter()


def _make_meta(total: Optional[int] = None, next_cursor: Optional[str] = None) -> EnvelopeMeta:
    return EnvelopeMeta(
        requestId=f"req_{uuid.uuid4().hex[:12]}",
        serverTime=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        total=total,
        nextCursor=next_cursor,
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


@router.get("", response_model=RecordsListResponse, status_code=status.HTTP_200_OK)
def get_records(
    kind: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    limit: int = 50,
    cursor: Optional[str] = None,
    include: Optional[str] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    include_fhir = (include == "fhir")
    clean_from = from_date if isinstance(from_date, str) else None
    clean_to = to_date if isinstance(to_date, str) else None
    clean_kind = kind if isinstance(kind, str) else None
    clean_status = status if isinstance(status, str) else None
    clean_q = q if isinstance(q, str) else None
    clean_limit = int(limit) if isinstance(limit, (int, str)) and str(limit).isdigit() else 50
    clean_cursor = cursor if isinstance(cursor, str) else None

    res = list_patient_records(
        patient_profile_id=pat_id,
        kind=clean_kind,
        status_filter=clean_status,
        search_q=clean_q,
        from_date=clean_from,
        to_date=clean_to,
        limit=clean_limit,
        cursor=clean_cursor,
        include_fhir=include_fhir,
    )
    return {
        "status": "success",
        "data": res["records"],
        "meta": _make_meta(total=res["total"], next_cursor=res["nextCursor"]),
    }


@router.get("/prescriptions", response_model=PrescriptionsListResponse, status_code=status.HTTP_200_OK)
def get_prescriptions(current_user: AuthenticatedUser = Depends(get_current_user)):
    pat_id = _get_patient_id(current_user)
    rx_list = list_prescriptions(pat_id)
    return {
        "status": "success",
        "data": rx_list,
        "meta": _make_meta(total=len(rx_list)),
    }


@router.post("/prescriptions", status_code=status.HTTP_201_CREATED)
def add_prescription(
    payload: NewPrescriptionInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = create_prescription(pat_id, current_user.id, payload)
    return {
        "status": "success",
        "message": "Prescription recorded successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.delete("/prescriptions/{id}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def delete_prescription(
    id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    retract_prescription(pat_id, id)
    return {
        "status": "success",
        "message": "Prescription retracted successfully.",
        "meta": _make_meta(),
    }


@router.get("/{id}", response_model=RecordDetailResponse, status_code=status.HTTP_200_OK)
def get_record(
    id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    record = get_record_by_id(id, patient_profile_id=pat_id)
    return {
        "status": "success",
        "data": record,
        "meta": _make_meta(),
    }


@router.post("/allergies", status_code=status.HTTP_201_CREATED)
def record_allergy(
    payload: NewAllergyInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = create_allergy(pat_id, current_user.id, payload)
    return {
        "status": "success",
        "message": "Allergy recorded successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/conditions", status_code=status.HTTP_201_CREATED)
def record_condition(
    payload: NewConditionInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = create_condition(pat_id, current_user.id, payload)
    return {
        "status": "success",
        "message": "Condition recorded successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/medications", status_code=status.HTTP_201_CREATED)
def record_medication(
    payload: NewMedicationInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = create_medication(pat_id, current_user.id, payload)
    return {
        "status": "success",
        "message": "Medication recorded successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/vaccinations", status_code=status.HTTP_201_CREATED)
def record_vaccination(
    payload: NewVaccinationInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = create_vaccination(pat_id, current_user.id, payload)
    return {
        "status": "success",
        "message": "Vaccination recorded successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/reports", status_code=status.HTTP_201_CREATED)
def record_report(
    payload: NewReportInput,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    pat_id = _get_patient_id(current_user)
    data = create_report(pat_id, current_user.id, payload)
    return {
        "status": "success",
        "message": "Diagnostic report recorded successfully.",
        "data": data,
        "meta": _make_meta(),
    }
