from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, status
from app.schemas.auth import (
    RegisterRequest, RegisterResponse, VerifyOTPRequest, VerifyOTPResponse, AuthResponse,
    LoginRequest, AdminLoginRequest, RequestOTPRequest, RequestOTPResponse, ResendOTPRequest,
    ResendOTPResponse, MessageResponse
)
from app.services.auth_service import (
    register_user, verify_user_otp, login_user, login_admin, request_login_otp, resend_otp
)
from app.security import get_current_user, AuthenticatedUser, create_access_token

router = APIRouter()


def _make_meta(total: int = None, next_cursor: str = None) -> dict:
    return {
        "requestId": f"req_{uuid.uuid4().hex[:12]}",
        "serverTime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total": total,
        "nextCursor": next_cursor,
    }


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    data = register_user(payload)
    return {
        "status": "success",
        "message": "Account created. Verification OTP dispatched.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/verify-otp", response_model=VerifyOTPResponse, status_code=status.HTTP_200_OK)
def verify_otp(payload: VerifyOTPRequest):
    data = verify_user_otp(payload)
    return {
        "status": "success",
        "message": data.get("message", "Phone verified successfully. Awaiting administrator review."),
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
def login(payload: LoginRequest):
    data = login_user(payload)
    return {
        "status": "success",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/admin/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
def admin_login(payload: AdminLoginRequest):
    data = login_admin(payload)
    return {
        "status": "success",
        "data": data,
        "meta": _make_meta(),
    }


@router.get("/me", response_model=AuthResponse, status_code=status.HTTP_200_OK)
def get_current_user_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    return {
        "status": "success",
        "data": {
            "accessToken": "",
            "tokenType": "Bearer",
            "expiresIn": 86400,
            "user": {
                "id": current_user.id,
                "fullName": current_user.full_name,
                "email": current_user.email,
                "phone": current_user.phone,
                "role": current_user.token_role or (current_user.roles[0] if current_user.roles else "patient"),
                "mediclaimId": current_user.mediclaim_id,
                "doctorId": current_user.doctor_id,
                "hospitalId": current_user.hospital_id,
                "isActive": current_user.is_active,
                "adminVerified": current_user.admin_verified,
                "isProfileComplete": current_user.profile_complete,
            },
        },
        "meta": _make_meta(),
    }


@router.post("/otp/request", response_model=RequestOTPResponse, status_code=status.HTTP_200_OK)
@router.post("/request-otp", response_model=RequestOTPResponse, status_code=status.HTTP_200_OK)
def request_otp(payload: RequestOTPRequest):
    data = request_login_otp(payload)
    return {
        "status": "success",
        "message": "Login OTP dispatched to registered mobile number.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/resend-otp", response_model=ResendOTPResponse, status_code=status.HTTP_200_OK)
def resend_user_otp(payload: ResendOTPRequest):
    data = resend_otp(payload)
    return {
        "status": "success",
        "message": "New OTP dispatched successfully.",
        "data": data,
        "meta": _make_meta(),
    }


@router.post("/refresh", response_model=AuthResponse, status_code=status.HTTP_200_OK)
def refresh_token(current_user: AuthenticatedUser = Depends(get_current_user)):
    new_token = create_access_token(
        current_user.id,
        role=current_user.token_role or (current_user.roles[0] if current_user.roles else "patient"),
        grant_id=current_user.active_grant_id,
    )
    return {
        "status": "success",
        "data": {
            "accessToken": new_token,
            "tokenType": "Bearer",
            "expiresIn": 86400,
            "user": {
                "id": current_user.id,
                "fullName": current_user.full_name,
                "email": current_user.email,
                "phone": current_user.phone,
                "role": current_user.token_role or (current_user.roles[0] if current_user.roles else "patient"),
                "mediclaimId": current_user.mediclaim_id,
                "doctorId": current_user.doctor_id,
                "hospitalId": current_user.hospital_id,
                "isActive": current_user.is_active,
                "adminVerified": current_user.admin_verified,
                "isProfileComplete": current_user.profile_complete,
            }
        },
        "meta": _make_meta(),
    }


@router.post("/logout", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def logout(current_user: AuthenticatedUser = Depends(get_current_user)):
    return {
        "status": "success",
        "message": "Successfully logged out.",
        "meta": _make_meta(),
    }
