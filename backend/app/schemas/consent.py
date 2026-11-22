from datetime import date
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import EnvelopeMeta
from app.schemas.records import KindType

class AccessRequestInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    patientMediclaimId: str = Field(min_length=5, max_length=30)
    scope: List[str] = Field(min_length=1)
    durationHours: int = Field(default=24, ge=1, le=720)
    purpose: Optional[str] = Field(default="Clinical Consultation", max_length=500)

class AccessRequest(BaseModel):
    id: str
    name: str
    role: str
    scope: List[str]
    durationHours: int
    purpose: Optional[str] = None
    status: str = "pending"
    requestedAt: Optional[str] = None

class AccessRequestsListResponse(BaseModel):
    status: str = "success"
    data: List[AccessRequest]
    meta: Optional[EnvelopeMeta] = None

class ApproveRequestInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    approvedScope: List[str] = Field(min_length=1)
    durationHours: int = Field(default=24, ge=1, le=720)

class AccessGrant(BaseModel):
    id: str
    grantId: Optional[str] = None
    name: str
    role: str
    scope: List[str]
    validFrom: Optional[str] = None
    expiresAt: str
    grantStatus: str = "active"

class AccessGrantsListResponse(BaseModel):
    status: str = "success"
    data: List[AccessGrant]
    meta: Optional[EnvelopeMeta] = None

class GiveAccessInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    practitionerId: Optional[str] = None
    name: str = Field(min_length=2, max_length=200)
    role: Optional[str] = Field(default="Practitioner", max_length=100)
    scope: List[str] = Field(min_length=1)
    durationHours: int = Field(default=24, ge=1, le=720)

class Caregiver(BaseModel):
    id: str
    name: str
    relation: str
    scope: List[KindType]
    since: str

class NewCaregiverInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=200)
    relation: str = Field(min_length=2, max_length=100)
    scope: List[KindType] = Field(min_length=1)

class CaregiversListResponse(BaseModel):
    status: str = "success"
    data: List[Caregiver]
    meta: Optional[EnvelopeMeta] = None

class GrantActionResponse(BaseModel):
    status: str = "success"
    message: str
    data: Optional[Dict[str, Any]] = None
    meta: Optional[EnvelopeMeta] = None
