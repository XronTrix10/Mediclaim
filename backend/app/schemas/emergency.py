from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import EnvelopeMeta

EmergencyType = Literal[
    "TRAUMA_RESUSCITATION",
    "ACUTE_CORONARY",
    "STROKE_THROMBOLYSIS",
    "MASS_CASUALTY",
    "OTHER_LIFE_THREATENING"
]

class EmergencyAccessInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patientMediclaimId: str = Field(min_length=10, max_length=20)
    emergencyType: EmergencyType
    clinicalJustification: str = Field(min_length=20, max_length=1000)

class EmergencyCriticalSummary(BaseModel):
    bloodGroup: Optional[str] = "Unknown"
    criticalAllergies: List[Dict[str, Any]] = []
    activeConditions: List[Dict[str, Any]] = []

class EmergencyAccessData(BaseModel):
    emergencyStatus: str = "emergency_granted"
    auditTrackingId: str
    expiresAt: str
    reviewMandatoryBefore: str
    criticalSummary: EmergencyCriticalSummary

class EmergencyAccessResponse(BaseModel):
    status: str = "success"
    message: str
    data: EmergencyAccessData
    meta: Optional[EnvelopeMeta] = None

class EmergencyEvent(BaseModel):
    id: str
    requesterName: str
    emergencyType: str
    clinicalJustification: str
    occurredAt: str

class EmergencyEventsResponse(BaseModel):
    status: str = "success"
    data: List[EmergencyEvent]
    meta: Optional[EnvelopeMeta] = None
