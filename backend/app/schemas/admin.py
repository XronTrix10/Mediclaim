from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import EnvelopeMeta
from app.schemas.patient import EmergencyContact

class PendingVerificationItem(BaseModel):
    userId: str
    fullName: str
    dateOfBirth: str
    phone: str
    aadhaarMasked: str
    accountStatus: str = "pending_admin_approval"
    phoneVerified: bool = True
    adminVerified: bool = False
    registeredAt: str

class PendingVerificationDetail(BaseModel):
    userId: str
    fullName: str
    dateOfBirth: str
    phone: str
    aadhaarMasked: str
    accountStatus: str = "pending_admin_approval"
    phoneVerified: bool = True
    adminVerified: bool = False
    gender: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    emergencyContact: Optional[EmergencyContact] = None
    registeredAt: str

class PendingVerificationsResponse(BaseModel):
    status: str = "success"
    data: List[PendingVerificationItem]
    meta: EnvelopeMeta

class VerificationDetailResponse(BaseModel):
    status: str = "success"
    data: PendingVerificationDetail
    meta: Optional[EnvelopeMeta] = None

class ApprovePatientData(BaseModel):
    userId: str
    fullName: str
    phone: str
    mediclaimId: str
    adminVerified: bool = True
    notificationSent: bool = True

class ApprovePatientResponse(BaseModel):
    status: str = "success"
    message: str = "Patient verification approved. Mediclaim ID dispatched to user."
    data: ApprovePatientData
    meta: Optional[EnvelopeMeta] = None

class RejectPatientRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=5, max_length=500)

class AdminStats(BaseModel):
    totalPatients: int
    pendingVerifications: int
    approvedPatients: int
    totalPractitioners: int
    totalHealthcareOrganizations: int
    emergencyBreakGlassEvents: int
    totalClinicalRecords: int

class AdminStatsResponse(BaseModel):
    status: str = "success"
    data: AdminStats
    meta: EnvelopeMeta

class AdminPatientItem(BaseModel):
    id: str
    userId: str
    mediclaimId: str
    fullName: str
    phone: str
    dateOfBirth: str
    adminVerified: bool
    isActive: bool
    createdAt: str

class AdminPatientsResponse(BaseModel):
    status: str = "success"
    data: List[AdminPatientItem]
    meta: EnvelopeMeta

class EmergencyReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reviewNotes: str = Field(min_length=5, max_length=1000)
    isJustified: bool = True
