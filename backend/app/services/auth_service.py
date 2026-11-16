from datetime import datetime, timezone
import logging
import secrets
import time
import uuid
from typing import Any, Dict, Optional
from fastapi import status
from app.config import OTP_SECONDS, OTP_DEBUG, ACCESS_TOKEN_SECONDS
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import (
    hash_password, verify_password, generate_otp, hash_otp,
    verify_otp, normalize_mediclaim_id, format_mediclaim_id,
    generate_mediclaim_id, create_access_token
)

logger = logging.getLogger("mediclaim.auth")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _mask_phone(phone: str) -> str:
    clean = phone.strip()
    if len(clean) >= 8:
        return f"{clean[:3]} XXXXX {clean[-5:]}"
    return clean


def _get_unique_mediclaim_id(conn) -> str:
    for _ in range(50):
        candidate = generate_mediclaim_id()
        exists = conn.execute(
            "SELECT 1 FROM users WHERE mediclaim_id = %s OR public_id = %s",
            (candidate, candidate)
        ).fetchone()
        if not exists:
            return candidate
    raise APIProblemException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        title="Service Unavailable",
        detail="Could not allocate Mediclaim ID. Please try again.",
        code="ID_ALLOCATION_FAILED"
    )


def register_user(payload) -> Dict[str, Any]:
    now = int(time.time())
    otp = generate_otp()
    user_uuid = uuid.uuid4()
    user_id = f"usr_{user_uuid}"

    with get_db() as conn:
        duplicate = conn.execute(
            "SELECT phone, aadhaar_number FROM users WHERE phone = %s OR aadhaar_number = %s",
            (payload.phone, payload.aadhaarNumber)
        ).fetchone()
        if duplicate:
            raise APIProblemException(
                status_code=status.HTTP_409_CONFLICT,
                title="Account Already Exists",
                detail="An account with this phone number or Aadhaar number already exists.",
                code="ACCOUNT_ALREADY_EXISTS"
            )

        mediclaim_id = _get_unique_mediclaim_id(conn)

        # Insert user into users table
        conn.execute("""
            INSERT INTO users (
                id, public_id, mediclaim_id, full_name, phone, aadhaar_number,
                password_hash, admin_verified, profile_complete,
                otp_hash, otp_expires_at, otp_attempts, is_active, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, false, false,
                %s, %s, 0, true, now(), now()
            )
        """, (
            str(user_uuid), mediclaim_id, mediclaim_id, payload.fullName,
            payload.phone, payload.aadhaarNumber,
            hash_password(payload.password), hash_otp(otp), now + OTP_SECONDS
        ))

        # Grant patient role in user_roles
        conn.execute("""
            INSERT INTO user_roles (user_id, role)
            VALUES (%s, 'patient')
            ON CONFLICT (user_id, role) DO NOTHING
        """, (str(user_uuid),))

        # Initialize patient_profiles with date of birth
        pat_profile_public_id = f"pat{secrets.randbelow(900_000_000) + 100_000_000}"
        conn.execute("""
            INSERT INTO patient_profiles (
                public_id, user_id, date_of_birth, created_at, updated_at
            ) VALUES (
                %s, %s, %s, now(), now()
            )
            ON CONFLICT (user_id) DO NOTHING
        """, (pat_profile_public_id, str(user_uuid), payload.dateOfBirth))

    formatted_mediclaim_id = format_mediclaim_id(mediclaim_id)
    if OTP_DEBUG:
        logger.info("[DEV ONLY] Registration OTP for %s: %s | Mediclaim ID: %s", payload.phone, otp, formatted_mediclaim_id)
        print(f"[DEV ONLY] Registration OTP for {payload.phone}: {otp} | Mediclaim ID: {formatted_mediclaim_id}")

    return {
        "userId": user_id,
        "mediclaimId": formatted_mediclaim_id,
        "phone": payload.phone,
        "accountStatus": "pending_otp",
        "otpSent": True,
        "otpExpiresInSeconds": OTP_SECONDS,
    }


def verify_user_otp(payload) -> Dict[str, Any]:
    now = int(time.time())
    raw_user_id = payload.userId.replace("usr-", "").replace("usr_", "")
    try:
        user_uuid = uuid.UUID(raw_user_id)
    except (ValueError, AttributeError):
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="User Not Found",
            detail="User identifier is invalid or not found.",
            code="USER_NOT_FOUND"
        )

    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE id = %s", (str(user_uuid),)
        ).fetchone()
        if not user:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="User Not Found",
                detail="User account not found.",
                code="USER_NOT_FOUND"
            )
        if not user["otp_hash"] or not user["otp_expires_at"] or now > user["otp_expires_at"]:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="OTP Expired",
                detail="Verification OTP has expired. Please request a new one.",
                code="OTP_EXPIRED"
            )
        if user["otp_attempts"] >= 5:
            raise APIProblemException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                title="Rate Limit Exceeded",
                detail="Maximum verification attempts exceeded. Please request a new OTP.",
                code="RATE_LIMIT_EXCEEDED"
            )
        if not verify_otp(payload.otp, user["otp_hash"]):
            conn.execute(
                "UPDATE users SET otp_attempts = otp_attempts + 1, updated_at = now() WHERE id = %s",
                (str(user_uuid),)
            )
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Invalid OTP",
                detail="The submitted OTP is incorrect.",
                code="INVALID_OTP"
            )

        conn.execute(
            "UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0, updated_at = now() WHERE id = %s",
            (str(user_uuid),)
        )
        formatted_user_id = f"usr_{user['id']}"
        med_id_val = user.get("mediclaim_id") or user.get("public_id")
        token = create_access_token(formatted_user_id, role="patient")

        return {
            "accessToken": token,
            "tokenType": "Bearer",
            "expiresIn": ACCESS_TOKEN_SECONDS,
            "user": {
                "id": formatted_user_id,
                "fullName": user["full_name"],
                "email": user.get("email"),
                "phone": user["phone"],
                "role": "patient",
                "mediclaimId": format_mediclaim_id(med_id_val) if med_id_val else None,
                "isActive": bool(user["is_active"]),
                "adminVerified": bool(user["admin_verified"]),
                "isProfileComplete": bool(user["profile_complete"]),
            }
        }


def login_user(payload) -> Dict[str, Any]:
    mediclaim_id = normalize_mediclaim_id(payload.mediclaimId)
    now = int(time.time())

    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE mediclaim_id = %s OR public_id = %s",
            (mediclaim_id, mediclaim_id)
        ).fetchone()

    # Avoid enumeration: generic credential error
    if not user:
        raise APIProblemException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            title="Invalid Credentials",
            detail="Invalid Mediclaim ID or credentials.",
            code="INVALID_CREDENTIALS"
        )

    # Check whether logging in via OTP or Password
    if payload.otp:
        if not user["otp_hash"] or not user["otp_expires_at"] or now > user["otp_expires_at"]:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="OTP Expired",
                detail="Login OTP has expired. Please request a new one.",
                code="OTP_EXPIRED"
            )
        if user["otp_attempts"] >= 5:
            raise APIProblemException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                title="Rate Limit Exceeded",
                detail="Too many incorrect login attempts. Please request a fresh OTP.",
                code="RATE_LIMIT_EXCEEDED"
            )
        if not verify_otp(payload.otp, user["otp_hash"]):
            with get_db() as conn:
                conn.execute(
                    "UPDATE users SET otp_attempts = otp_attempts + 1, updated_at = now() WHERE id = %s",
                    (str(user["id"]),)
                )
            raise APIProblemException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                title="Invalid OTP",
                detail="The one-time password is incorrect.",
                code="INVALID_CREDENTIALS"
            )
        # Clear used OTP
        with get_db() as conn:
            conn.execute(
                "UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0, updated_at = now() WHERE id = %s",
                (str(user["id"]),)
            )
    elif payload.password:
        if not verify_password(payload.password, user["password_hash"]):
            raise APIProblemException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                title="Invalid Credentials",
                detail="Invalid Mediclaim ID or password.",
                code="INVALID_CREDENTIALS"
            )
    else:
        raise APIProblemException(
            status_code=status.HTTP_400_BAD_REQUEST,
            title="Missing Credentials",
            detail="Either password or verification OTP must be provided.",
            code="BAD_REQUEST"
        )

    # Retrieve user's active role
    with get_db() as conn:
        role_row = conn.execute(
            "SELECT role FROM user_roles WHERE user_id = %s LIMIT 1", (str(user["id"]),)
        ).fetchone()
        role = role_row["role"] if role_row else "patient"

    formatted_user_id = f"usr_{user['id']}"
    med_id_val = user.get("mediclaim_id") or user.get("public_id") or mediclaim_id
    token = create_access_token(formatted_user_id, role=role)

    return {
        "accessToken": token,
        "tokenType": "Bearer",
        "expiresIn": ACCESS_TOKEN_SECONDS,
        "user": {
            "id": formatted_user_id,
            "fullName": user["full_name"],
            "email": user.get("email"),
            "phone": user["phone"],
            "role": role,
            "mediclaimId": format_mediclaim_id(med_id_val),
            "isActive": bool(user["is_active"]),
            "adminVerified": bool(user["admin_verified"]),
            "isProfileComplete": bool(user["profile_complete"]),
        }
    }


def request_login_otp(payload) -> Dict[str, Any]:
    mediclaim_id = normalize_mediclaim_id(payload.mediclaimId)
    now = int(time.time())
    otp = generate_otp()

    with get_db() as conn:
        user = conn.execute(
            "SELECT id, phone FROM users WHERE mediclaim_id = %s OR public_id = %s",
            (mediclaim_id, mediclaim_id)
        ).fetchone()

        if not user:
            # Mask timing to prevent enumeration
            time.sleep(0.05)
            return {
                "maskedPhone": "+91 XXXXX XXXXX",
                "otpExpiresInSeconds": OTP_SECONDS,
            }

        conn.execute("""
            UPDATE users
            SET otp_hash = %s, otp_expires_at = %s, otp_attempts = 0, updated_at = now()
            WHERE id = %s
        """, (hash_otp(otp), now + OTP_SECONDS, str(user["id"])))

    if OTP_DEBUG:
        logger.info("[DEV ONLY] Login OTP for %s: %s", user["phone"], otp)
        print(f"[DEV ONLY] Login OTP for {user['phone']}: {otp}")

    return {
        "maskedPhone": _mask_phone(user["phone"]),
        "otpExpiresInSeconds": OTP_SECONDS,
    }


def resend_otp(payload) -> Dict[str, Any]:
    now = int(time.time())
    otp = generate_otp()
    raw_user_id = payload.userId.replace("usr-", "").replace("usr_", "")
    try:
        user_uuid = uuid.UUID(raw_user_id)
    except (ValueError, AttributeError):
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="User Not Found",
            detail="User identifier not found.",
            code="USER_NOT_FOUND"
        )

    with get_db() as conn:
        user = conn.execute(
            "SELECT id, phone FROM users WHERE id = %s", (str(user_uuid),)
        ).fetchone()
        if not user:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="User Not Found",
                detail="User account not found.",
                code="USER_NOT_FOUND"
            )

        conn.execute("""
            UPDATE users
            SET otp_hash = %s, otp_expires_at = %s, otp_attempts = 0, updated_at = now()
            WHERE id = %s
        """, (hash_otp(otp), now + OTP_SECONDS, str(user["id"])))

    if OTP_DEBUG:
        logger.info("[DEV ONLY] Resent OTP for %s: %s", user["phone"], otp)
        print(f"[DEV ONLY] Resent OTP for {user['phone']}: {otp}")

    return {
        "otpExpiresInSeconds": OTP_SECONDS
    }
