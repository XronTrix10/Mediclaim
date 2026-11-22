from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import EnvelopeMeta
from app.schemas.records import KindType, MedicationItem, RecordStatusType

class DoctorRegisterInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    fullName: str = Field(min_length=2, max_length=200)
    dateOfBirth: Optional[str] = None
    phone: str = Field(min_length=8, max_length=20)
    aadhaarNumber: str = Field(min_length=12, max_length=16)
    password: str = Field(min_length=8)
    medicalLicenseNumber: str = Field(min_length=3, max_length=100)
    specialization: str = Field(min_length=2, max_length=150)
    yearsOfExperience: Optional[int] = None
    hospitalName: Optional[str] = None

class DoctorRequestOtpInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    doctorId: Optional[str] = None
    phone: Optional[str] = None

class DoctorVerifyOtpInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    doctorId: Optional[str] = None
    phone: Optional[str] = None
    otp: str = Field(min_length=4, max_length=10)

class DoctorLoginInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    doctorId: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    mediclaimId: Optional[str] = None
    password: Optional[str] = None
    otp: Optional[str] = None

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
    model_config = ConfigDict(extra="ignore")
    patientMediclaimId: str = Field(min_length=10, max_length=20)
    scope: List[str] = Field(min_length=1)
    durationHours: int = Field(default=24, ge=1, le=720)
    purpose: Optional[str] = Field(default="Clinical Consultation", max_length=500)

class DoctorAccessRequestSummary(BaseModel):
    id: str
    patientMediclaimId: str
    patientFullName: Optional[str] = None
    scope: List[str]
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
    model_config = ConfigDict(extra="ignore")
    encounterType: Literal["outpatient", "emergency", "inpatient", "telehealth"] = "outpatient"
    reason: str = Field(min_length=2, max_length=500)
    diagnosisSummary: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    status: Literal["planned", "in_progress", "completed", "cancelled"] = "completed"

class DoctorConditionInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    conditionName: str = Field(min_length=1, max_length=255)
    severity: Optional[Literal["mild", "moderate", "severe"]] = "moderate"
    status: Literal["active", "resolved", "inactive", "discontinued"] = "active"
    onsetDate: Optional[Union[date, str]] = None
    resolvedDate: Optional[Union[date, str]] = None
    notes: Optional[str] = None

class DoctorPrescriptionInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = Field(min_length=1, max_length=255)
    instructions: Optional[str] = None
    date: Optional[Union[date, str]] = None
    medications: List[MedicationItem] = Field(min_length=1)

class DoctorReportInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    reportName: str = Field(min_length=1, max_length=255)
    reportType: Optional[str] = "Laboratory"
    reportDate: Optional[Union[date, str]] = None
    conclusion: Optional[str] = None
    status: Literal["draft", "final", "amended", "cancelled"] = "final"

class DoctorVaccinationInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    vaccineName: str = Field(min_length=1, max_length=255)
    doseNumber: Optional[int] = 1
    administeredDate: Optional[Union[date, str]] = None
    batchNumber: Optional[str] = None
    notes: Optional[str] = None
