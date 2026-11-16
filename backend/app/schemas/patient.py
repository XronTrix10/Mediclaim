from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import EnvelopeMeta

GenderType = Literal["Male", "Female", "Non-binary", "Other", "Prefer not to say"]
BloodGroupType = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"]
EmergencyRelationType = Literal["Parent", "Spouse", "Sibling", "Child", "Friend", "Guardian", "Other"]

class EmergencyContact(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(pattern=r"^\+[1-9]\d{7,14}$|^[\d\s\-\(\)\+]{7,20}$")
    relation: str = Field(min_length=1, max_length=50)

class PatientProfileData(BaseModel):
    id: str
    userId: str
    mediclaimId: str
    aadhaarMasked: Optional[str] = None
    fullName: str
    firstName: str
    dateOfBirth: str
    gender: Optional[str] = None
    bloodGroup: Optional[str] = None
    phone: str
    address: Optional[str] = None
    emergencyContact: Optional[EmergencyContact] = None
    isProfileComplete: bool
    createdAt: str
    updatedAt: str

class PatientProfileResponse(BaseModel):
    status: str = "success"
    data: PatientProfileData
    meta: Optional[EnvelopeMeta] = None

class CompleteProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    gender: GenderType
    bloodGroup: BloodGroupType
    address: str = Field(min_length=5, max_length=500)
    emergencyName: str = Field(min_length=2, max_length=200)
    emergencyPhone: str = Field(min_length=7, max_length=20)
    emergencyRelation: str = Field(min_length=2, max_length=50)

class CompleteProfileData(BaseModel):
    isProfileComplete: bool
    updatedAt: str

class CompleteProfileResponse(BaseModel):
    status: str = "success"
    message: str
    data: CompleteProfileData
    meta: Optional[EnvelopeMeta] = None

class PermittedDetailsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: Optional[str] = Field(default=None, pattern=r"^\+[1-9]\d{7,14}$|^[\d\s\-\(\)\+]{7,20}$")
    address: Optional[str] = Field(default=None, min_length=5, max_length=500)
    emergencyContact: Optional[EmergencyContact] = None

class PermittedDetailsUpdateResponse(BaseModel):
    status: str = "success"
    message: str
    data: Dict[str, Any]
    meta: Optional[EnvelopeMeta] = None
