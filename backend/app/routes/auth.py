from fastapi import APIRouter, status
from app.schemas.auth import (
    RegisterRequest, RegisterResponse, VerifyOTPRequest, VerifyOTPResponse,
    LoginRequest, LoginResponse
)
from app.services.auth_service import register_user, verify_user_otp, login_user

router = APIRouter()

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    return {
        "status": "success",
        "message": "Account created. Verification OTP dispatched.",
        "data": register_user(payload),
    }

@router.post("/verify-otp", response_model=VerifyOTPResponse, status_code=status.HTTP_200_OK)
def verify_otp(payload: VerifyOTPRequest):
    return verify_user_otp(payload)

@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(payload: LoginRequest):
    return login_user(payload)
