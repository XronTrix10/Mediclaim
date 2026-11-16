from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import EnvelopeMeta
from app.schemas.records import KindType, MedicationItem, RecordStatusType

class DoctorPatientSummary(BaseModel):
    patientProfileId: str
    mediclaimId: str
    fullName: str
    gender: Optional[str] = None
    dateOfBirth: Optional[str] = None
    bloodGroup: Optional[str] = None
    grantId: str
    approvedScopes: List[str]
    expiresAt: str

class DoctorPatientsListResponse(BaseModel):
    status: str = "success"
    data: List[DoctorPatientSummary]
    meta: EnvelopeMeta

class DoctorAccessRequestInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patientMediclaimId: str = Field(min_length=10, max_length=20)
    scope: List[KindType] = Field(min_length=1)
    durationHours: int = Field(ge=1, le=24)
    purpose: str = Field(min_length=5, max_length=500)

class DoctorAccessRequestSummary(BaseModel):
    id: str
    patientMediclaimId: str
    patientFullName: Optional[str] = None
    scope: List[KindType]
    durationHours: int
    purpose: Optional[str] = None
    status: str
    requestedAt: Optional[str] = None
    expiresAt: Optional[str] = None

class DoctorRequestsListResponse(BaseModel):
    status: str = "success"
    data: List[DoctorAccessRequestSummary]
    meta: Optional[EnvelopeMeta] = None

class DoctorEncounterInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    encounterType: Literal["outpatient", "emergency", "inpatient", "telehealth"] = "outpatient"
    reason: str = Field(min_length=2, max_length=500)
    diagnosisSummary: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    status: Literal["planned", "in_progress", "completed", "cancelled"] = "completed"

class DoctorConditionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    conditionName: str = Field(min_length=1, max_length=255)
    severity: Optional[Literal["mild", "moderate", "severe"]] = "moderate"
    status: Literal["active", "resolved", "inactive", "discontinued"] = "active"
    onsetDate: Optional[date] = None
    resolvedDate: Optional[date] = None
    notes: Optional[str] = None

class DoctorPrescriptionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=255)
    instructions: Optional[str] = None
    date: Optional[date] = None
    medications: List[MedicationItem] = Field(min_length=1)

class DoctorReportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reportName: str = Field(min_length=1, max_length=255)
    reportType: Optional[str] = "Laboratory"
    reportDate: Optional[date] = None
    conclusion: Optional[str] = None
    status: Literal["draft", "final", "amended", "cancelled"] = "final"

class DoctorVaccinationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vaccineName: str = Field(min_length=1, max_length=255)
    doseNumber: Optional[int] = 1
    administeredDate: Optional[date] = None
    batchNumber: Optional[str] = None
    notes: Optional[str] = None
