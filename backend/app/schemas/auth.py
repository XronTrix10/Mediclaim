from datetime import date
from pydantic import BaseModel, Field, ConfigDict

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fullName: str = Field(min_length=2, max_length=120)
    dateOfBirth: date
    phone: str = Field(pattern=r"^\+[1-9]\d{7,14}$")
    aadhaarNumber: str = Field(pattern=r"^\d{12}$")
    password: str = Field(min_length=12, max_length=128)

class RegisterData(BaseModel):
    userId: str
    phone: str
    adminVerified: bool
    otpSent: bool
    otpExpiresInSeconds: int

class RegisterResponse(BaseModel):
    status: str
    message: str
    data: RegisterData

class VerifyOTPRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    userId: str
    otp: str = Field(pattern=r"^\d{6}$")

class AuthUser(BaseModel):
    id: str
    fullName: str
    role: str = "patient"
    adminVerified: bool | None = None
    isProfileComplete: bool
    mediclaimId: str | None = None

class VerifyOTPResponse(BaseModel):
    status: str
    accessToken: str
    tokenType: str = "Bearer"
    expiresIn: int
    user: AuthUser

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mediclaimId: str = Field(pattern=r"^[\d ]{12,14}$")
    password: str = Field(min_length=1, max_length=128)

class LoginResponse(BaseModel):
    status: str
    accessToken: str
    tokenType: str = "Bearer"
    expiresIn: int
    user: AuthUser
