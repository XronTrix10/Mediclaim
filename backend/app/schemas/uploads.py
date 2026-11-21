import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.records import (
    AllergyCategoryType,
    AllergyCriticalityType,
    AllergySeverityType,
    MedicationItem,
    RecordStatusType,
)

ParsedDocumentType = Literal[
    "prescription",
    "vaccination",
    "lab_report",
    "discharge_summary",
    "allergy_note",
    "other",
]

OCRStatusType = Literal[
    "pending",
    "processing",
    "needs_review",
    "completed",
    "failed",
]


class ParsedLabResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    testName: str = Field(min_length=1, max_length=255)
    testCode: Optional[str] = None
    resultValue: Optional[str] = None
    unit: Optional[str] = None
    referenceRange: Optional[str] = None
    interpretation: Optional[str] = None  # normal | high | low | abnormal
    notes: Optional[str] = None


class ParsedPrescription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = Field(min_length=1, max_length=255)
    doctor: str = Field(default="Unknown Practitioner", max_length=255)
    organization: Optional[str] = None
    date: Optional[datetime.date] = None
    instructions: Optional[str] = None
    medications: List[MedicationItem] = Field(default_factory=list)


class ParsedVaccination(BaseModel):
    model_config = ConfigDict(extra="ignore")
    vaccineName: str = Field(min_length=1, max_length=255)
    doseNumber: Optional[int] = 1
    administeredDate: Optional[datetime.date] = None
    nextDueDate: Optional[datetime.date] = None
    batchNumber: Optional[str] = None
    provider: Optional[str] = None
    notes: Optional[str] = None


class ParsedAllergy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    allergen: str = Field(min_length=1, max_length=255)
    category: Optional[AllergyCategoryType] = "medication"
    severity: Optional[AllergySeverityType] = "moderate"
    criticality: Optional[AllergyCriticalityType] = "low"
    reaction: str = Field(default="Reported reaction", max_length=500)
    provider: Optional[str] = None
    identifiedDate: Optional[datetime.date] = None
    notes: Optional[str] = None


class ParsedCondition(BaseModel):
    model_config = ConfigDict(extra="ignore")
    conditionName: str = Field(min_length=1, max_length=255)
    status: Optional[RecordStatusType] = "active"
    severity: Optional[str] = "mild"
    onsetDate: Optional[datetime.date] = None
    resolvedDate: Optional[datetime.date] = None
    provider: Optional[str] = None
    notes: Optional[str] = None


class ParsedMedication(BaseModel):
    model_config = ConfigDict(extra="ignore")
    medicationName: str = Field(min_length=1, max_length=255)
    dosage: Optional[str] = None
    startDate: Optional[datetime.date] = None
    endDate: Optional[datetime.date] = None
    status: Optional[RecordStatusType] = "active"
    provider: Optional[str] = None
    instructions: Optional[str] = None


class ParsedReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    reportName: str = Field(min_length=1, max_length=255)
    reportType: Optional[str] = "lab"
    reportDate: Optional[datetime.date] = None
    conclusion: Optional[str] = None
    provider: Optional[str] = None
    labResults: List[ParsedLabResult] = Field(default_factory=list)


class ParsedDocumentPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    documentType: ParsedDocumentType = "other"
    title: Optional[str] = None
    documentDate: Optional[datetime.date] = None
    provider: Optional[str] = None
    organization: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    prescriptions: List[ParsedPrescription] = Field(default_factory=list)
    vaccinations: List[ParsedVaccination] = Field(default_factory=list)
    allergies: List[ParsedAllergy] = Field(default_factory=list)
    conditions: List[ParsedCondition] = Field(default_factory=list)
    medications: List[ParsedMedication] = Field(default_factory=list)
    reports: List[ParsedReport] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class CommitParsedDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payload: Optional[ParsedDocumentPayload] = None


class CommitSummary(BaseModel):
    documentId: str
    ocrStatus: OCRStatusType
    createdCount: int
    createdRecords: Dict[str, List[Dict[str, Any]]]
