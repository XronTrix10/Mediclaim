from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import EnvelopeMeta

class HospitalRegisterInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=2, max_length=255)
    registrationNumber: str = Field(min_length=2, max_length=100)
    type: str = Field(default="hospital")
    address: Optional[str] = None
    phone: str = Field(min_length=8, max_length=20)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8)

class HospitalLoginInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    hospitalId: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    otp: Optional[str] = None

class HospitalRequestOtpInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    hospitalId: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class HospitalVerifyOtpInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    hospitalId: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    otp: str = Field(min_length=4, max_length=10)

class OrganizationCreateInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(min_length=2, max_length=255)
    organizationType: Literal["hospital", "clinic", "pharmacy", "diagnostic_lab"] = "hospital"
    registrationNumber: str = Field(min_length=2, max_length=100)
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class OrganizationSummary(BaseModel):
    id: str
    publicId: str
    hospitalId: Optional[str] = None
    name: str
    organizationType: str
    registrationNumber: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    practitionersCount: Optional[int] = 0
    createdAt: str

class OrganizationsListResponse(BaseModel):
    status: str = "success"
    data: List[OrganizationSummary]
    meta: EnvelopeMeta

class PractitionerCreateInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    fullName: str = Field(min_length=2, max_length=200)
    phone: str = Field(pattern=r"^\+?[0-9\s\-]{8,20}$")
    email: Optional[str] = None
    password: str = Field(min_length=8)
    registrationNumber: str = Field(min_length=3, max_length=100)
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    organizationId: Optional[str] = None
    designation: Optional[str] = "Consultant"

class PractitionerSummary(BaseModel):
    id: str
    publicId: str
    doctorId: Optional[str] = None
    fullName: str
    registrationNumber: str
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    phone: str
    email: Optional[str] = None
    organization: Optional[Dict[str, Any]] = None
    createdAt: str

class PractitionersListResponse(BaseModel):
    status: str = "success"
    data: List[PractitionerSummary]
    meta: EnvelopeMeta
