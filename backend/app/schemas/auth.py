from datetime import date
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fullName: str = Field(min_length=2, max_length=120)
    dateOfBirth: date
    phone: str = Field(pattern=r"^\+[1-9]\d{7,14}$")
    aadhaarNumber: str = Field(pattern=r"^\d{12}$")
    password: str = Field(min_length=8, max_length=128)

class RegisterData(BaseModel):
    userId: str
    phone: str
    accountStatus: str = "pending_otp"
    otpSent: bool
    otpExpiresInSeconds: int
    debugOtp: Optional[str] = None

class EnvelopeMeta(BaseModel):
    requestId: Optional[str] = None
    serverTime: Optional[str] = None
    total: Optional[int] = None
    nextCursor: Optional[str] = None

class RegisterResponse(BaseModel):
    status: str = "success"
    message: str
    data: RegisterData
    meta: Optional[EnvelopeMeta] = None

class VerifyOTPRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    userId: str
    otp: str = Field(pattern=r"^\d{6}$")

class VerifyOTPData(BaseModel):
    userId: str
    phone: str
    accountStatus: str = "pending_admin_approval"
    phoneVerified: bool = True
    adminVerified: bool = False
    message: str = "Phone verified successfully. Awaiting administrator review."

class VerifyOTPResponse(BaseModel):
    status: str = "success"
    message: str
    data: VerifyOTPData
    meta: Optional[EnvelopeMeta] = None

class UserSummary(BaseModel):
    id: str
    fullName: str
    email: Optional[str] = None
    phone: str
    role: str = "patient"
    mediclaimId: Optional[str] = None
    doctorId: Optional[str] = None
    hospitalId: Optional[str] = None
    isActive: bool = True
    adminVerified: bool = False
    isProfileComplete: bool = False

class AuthData(BaseModel):
    accessToken: str
    tokenType: str = "Bearer"
    expiresIn: int
    user: UserSummary

class AuthResponse(BaseModel):
    status: str = "success"
    data: AuthData
    meta: Optional[EnvelopeMeta] = None

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    mediclaimId: Optional[str] = None
    doctorId: Optional[str] = None
    hospitalId: Optional[str] = None
    identifier: Optional[str] = None
    password: Optional[str] = Field(default=None, max_length=128)
    otp: Optional[str] = Field(default=None, pattern=r"^\d{6}$")

class AdminLoginRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    username: Optional[str] = None
    email: Optional[str] = None
    password: str = Field(min_length=4, max_length=128)

class RequestOTPRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    mediclaimId: Optional[str] = None
    doctorId: Optional[str] = None
    hospitalId: Optional[str] = None
    identifier: Optional[str] = None

class RequestOTPData(BaseModel):
    maskedPhone: str
    otpExpiresInSeconds: int
    debugOtp: Optional[str] = None

class RequestOTPResponse(BaseModel):
    status: str = "success"
    message: str
    data: RequestOTPData
    meta: Optional[EnvelopeMeta] = None

class ResendOTPRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    userId: str

class ResendOTPData(BaseModel):
    otpExpiresInSeconds: int

class ResendOTPResponse(BaseModel):
    status: str = "success"
    message: str
    data: ResendOTPData
    meta: Optional[EnvelopeMeta] = None

class MessageResponse(BaseModel):
    status: str = "success"
    message: str
    data: Optional[Dict[str, Any]] = None
    meta: Optional[EnvelopeMeta] = None
