from datetime import date
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import EnvelopeMeta

KindType = Literal["allergy", "condition", "medication", "vaccination", "report"]
RecordStatusType = Literal["active", "resolved", "inactive", "completed", "discontinued"]
RecordSourceType = Literal["self_reported", "uploaded", "practitioner"]
AllergyCategoryType = Literal["food", "medication", "environment", "biologic"]
AllergySeverityType = Literal["mild", "moderate", "severe", "life-threatening"]
AllergyCriticalityType = Literal["low", "high", "unable-to-assess"]

class MedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None

class HealthEvent(BaseModel):
    id: str
    kind: KindType
    title: str
    short: Optional[str] = None
    detail: str
    date: str
    provider: str
    status: Optional[RecordStatusType] = "active"
    source: Optional[RecordSourceType] = "self_reported"
    # Allergy fields
    severity: Optional[AllergySeverityType] = None
    criticality: Optional[AllergyCriticalityType] = None
    category: Optional[AllergyCategoryType] = None
    reaction: Optional[str] = None
    notes: Optional[str] = None
    # Prescription / file fields
    prescriptionId: Optional[str] = None
    fileType: Optional[str] = None
    fileName: Optional[str] = None
    fileSizeBytes: Optional[int] = None
    fileUrl: Optional[str] = None
    instructions: Optional[str] = None
    medications: Optional[List[MedicationItem]] = None
    # FHIR resource representation (optional in list, present in detail)
    fhirResource: Optional[Dict[str, Any]] = None

class RecordsListResponse(BaseModel):
    status: str = "success"
    data: List[HealthEvent]
    meta: EnvelopeMeta

class RecordDetailResponse(BaseModel):
    status: str = "success"
    data: HealthEvent
    meta: Optional[EnvelopeMeta] = None

class NewAllergyInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    allergen: str = Field(min_length=1, max_length=255)
    category: AllergyCategoryType
    severity: AllergySeverityType
    criticality: AllergyCriticalityType
    reaction: str = Field(min_length=1, max_length=500)
    provider: str = Field(min_length=1, max_length=255)
    notes: Optional[str] = None
    identifiedDate: Optional[date] = None

class NewConditionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    conditionName: str = Field(min_length=1, max_length=255)
    status: RecordStatusType = "active"
    severity: Optional[str] = None
    onsetDate: Optional[date] = None
    resolvedDate: Optional[date] = None
    provider: Optional[str] = None
    notes: Optional[str] = None

class NewMedicationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    medicationName: str = Field(min_length=1, max_length=255)
    dosage: Optional[str] = None
    startDate: Optional[date] = None
    endDate: Optional[date] = None
    status: RecordStatusType = "active"
    provider: Optional[str] = None
    instructions: Optional[str] = None

class NewVaccinationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vaccineName: str = Field(min_length=1, max_length=255)
    doseNumber: Optional[int] = 1
    administeredDate: date
    nextDueDate: Optional[date] = None
    batchNumber: Optional[str] = None
    provider: Optional[str] = None
    notes: Optional[str] = None

class NewReportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reportName: str = Field(min_length=1, max_length=255)
    reportType: Optional[str] = None
    reportDate: Optional[date] = None
    conclusion: Optional[str] = None
    provider: Optional[str] = None

class PrescriptionRecord(BaseModel):
    id: str
    kind: Optional[str] = "medication"
    title: str
    doctor: str
    organization: Optional[str] = None
    date: str
    status: Optional[RecordStatusType] = "active"
    fileType: Optional[str] = None
    fileName: Optional[str] = None
    fileSizeBytes: Optional[int] = None
    fileUrl: Optional[str] = None
    instructions: Optional[str] = None
    medications: Optional[List[MedicationItem]] = None

class NewPrescriptionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=255)
    doctor: str = Field(min_length=1, max_length=255)
    organization: Optional[str] = None
    date: date
    instructions: Optional[str] = None
    medications: Optional[List[MedicationItem]] = None
    fileType: Optional[str] = None
    fileName: Optional[str] = None
    fileSizeBytes: Optional[int] = None
    fileUrl: Optional[str] = None

class PrescriptionsListResponse(BaseModel):
    status: str = "success"
    data: List[PrescriptionRecord]
    meta: EnvelopeMeta
