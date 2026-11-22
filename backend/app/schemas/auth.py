import re
from datetime import date
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

NAME_REGEX = re.compile(r"^[A-Za-z]+(?:(?:\. |\.|'|-|\s)[A-Za-z]+)*\.?$")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fullName: str = Field(min_length=3, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    dateOfBirth: date
    phone: str
    aadhaarNumber: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("fullName")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Full name is required.")
        if len(clean) < 3:
            raise ValueError("Name must contain at least 3 characters.")
        if len(clean) > 100:
            raise ValueError("Name must not exceed 100 characters.")
        if not NAME_REGEX.match(clean) or any(ch.isdigit() for ch in clean):
            raise ValueError("Please enter a valid name.")
        return clean

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean:
            raise ValueError("Email address is required.")
        if len(clean) > 254 or not EMAIL_REGEX.match(clean):
            raise ValueError("Please enter a valid email address.")
        return clean

    @field_validator("dateOfBirth")
    @classmethod
    def validate_dob(cls, v: date) -> date:
        today = date.today()
        if v > today:
            raise ValueError("Date of birth cannot be in the future.")
        if v.year < 1900:
            raise ValueError("Please enter a valid date of birth.")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = re.sub(r"[\s-]+", "", str(v).strip())
        if not clean:
            raise ValueError("Mobile number is required.")
        if clean.startswith("+91"):
            digits = clean[3:]
        elif clean.startswith("91") and len(clean) == 12:
            digits = clean[2:]
        else:
            digits = clean
        if len(digits) != 10:
            raise ValueError("Mobile number must contain exactly 10 digits.")
        if not digits.isdigit() or digits[0] not in "6789":
            raise ValueError("Please enter a valid Indian mobile number.")
        return f"+91{digits}"

    @field_validator("aadhaarNumber")
    @classmethod
    def validate_aadhaar(cls, v: str) -> str:
        clean = re.sub(r"[\s-]+", "", str(v))
        if not clean:
            raise ValueError("Aadhaar number is required.")
        if len(clean) != 12:
            raise ValueError("Aadhaar number must contain exactly 12 digits.")
        if not clean.isdigit() or len(set(clean)) == 1:
            raise ValueError("Please enter a valid Aadhaar number.")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v:
            raise ValueError("Password is required.")
        if len(v) < 8:
            raise ValueError("Password must contain at least 8 characters.")
        return v

class RegisterData(BaseModel):
    userId: str
    phone: str
    email: Optional[str] = None
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
