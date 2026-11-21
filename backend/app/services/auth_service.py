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
        "phone": payload.phone,
        "accountStatus": "pending_otp",
        "otpSent": True,
        "otpExpiresInSeconds": OTP_SECONDS,
        "debugOtp": otp if OTP_DEBUG else None,
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

        return {
            "userId": formatted_user_id,
            "phone": user["phone"],
            "accountStatus": "pending_admin_approval",
            "phoneVerified": True,
            "adminVerified": bool(user["admin_verified"]),
            "message": "Phone number verified successfully. Your account is pending admin verification.",
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

    # Verify administrator verification status
    if not user.get("admin_verified"):
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Account Pending Approval",
            detail="Your account is pending verification by an administrator. You will receive your Mediclaim ID via email or SMS once approved.",
            code="ACCOUNT_PENDING_APPROVAL"
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
        "debugOtp": otp if OTP_DEBUG else None,
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


def seed_admin_user(conn=None) -> Dict[str, Any]:
    from app.config import ADMIN_EMAIL, ADMIN_PASSWORD
    from app.security import hash_password, verhoeff_calc_check_digit

    admin_uuid = "00000000-0000-0000-0000-000000000001"
    admin_pub_id = "ADMIN0000001"
    base_11 = "10000000000"
    check = verhoeff_calc_check_digit(base_11)
    admin_mediclaim_id = f"{base_11}{check}"

    def _do_seed(db):
        existing = db.execute(
            "SELECT id FROM users WHERE id = %s OR email = %s",
            (admin_uuid, ADMIN_EMAIL)
        ).fetchone()

        pwd_hash = hash_password(ADMIN_PASSWORD)

        if not existing:
            db.execute("""
                INSERT INTO users (
                    id, public_id, mediclaim_id, full_name, email, phone,
                    aadhaar_number, password_hash, admin_verified, profile_complete,
                    is_active, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, 'System Administrator', %s, '+910000000000',
                    '000000000000', %s, true, true,
                    true, now(), now()
                )
                ON CONFLICT (id) DO NOTHING
            """, (admin_uuid, admin_pub_id, admin_mediclaim_id, ADMIN_EMAIL, pwd_hash))
            db_id = admin_uuid
        else:
            db_id = str(existing["id"])
            db.execute("""
                UPDATE users
                SET password_hash = %s, admin_verified = true, is_active = true, updated_at = now()
                WHERE id = %s
            """, (pwd_hash, db_id))

        for r in ("admin", "hospital_admin"):
            db.execute("""
                INSERT INTO user_roles (user_id, role)
                VALUES (%s, %s)
                ON CONFLICT (user_id, role) DO NOTHING
            """, (db_id, r))

    if conn is not None:
        _do_seed(conn)
    else:
        with get_db() as db:
            _do_seed(db)

    return {"email": ADMIN_EMAIL, "mediclaimId": admin_mediclaim_id}


def login_admin(payload) -> Dict[str, Any]:
    from app.config import ADMIN_EMAIL, ADMIN_PASSWORD
    from app.security import verify_password, create_access_token, format_mediclaim_id

    seed_admin_user()

    identifier = (payload.username or payload.email or "").strip()
    provided_password = payload.password or ""

    if not identifier or not provided_password:
        raise APIProblemException(
            status_code=status.HTTP_400_BAD_REQUEST,
            title="Missing Credentials",
            detail="Username/email and password are required.",
            code="BAD_REQUEST",
        )

    with get_db() as conn:
        if identifier.lower() in ("admin", "administrator", ADMIN_EMAIL.lower()):
            user = conn.execute(
                "SELECT * FROM users WHERE email = %s OR id = '00000000-0000-0000-0000-000000000001'",
                (ADMIN_EMAIL,)
            ).fetchone()
        else:
            user = conn.execute("""
                SELECT * FROM users
                WHERE lower(email) = %s OR phone = %s OR mediclaim_id = %s OR public_id = %s
            """, (identifier.lower(), identifier, identifier, identifier)).fetchone()

    if not user:
        raise APIProblemException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            title="Invalid Credentials",
            detail="Invalid administrator credentials.",
            code="INVALID_CREDENTIALS",
        )

    is_valid_pwd = (provided_password == ADMIN_PASSWORD) or verify_password(provided_password, user["password_hash"])
    if not is_valid_pwd:
        raise APIProblemException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            title="Invalid Credentials",
            detail="Invalid administrator credentials.",
            code="INVALID_CREDENTIALS",
        )

    with get_db() as conn:
        roles_rows = conn.execute(
            "SELECT role FROM user_roles WHERE user_id = %s", (str(user["id"]),)
        ).fetchall()
        roles = [r["role"] for r in roles_rows]

    if "admin" not in roles and "hospital_admin" not in roles:
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Access Denied",
            detail="This account does not have administrator privileges.",
            code="ROLE_UNAUTHORIZED",
        )

    formatted_user_id = f"usr_{user['id']}"
    med_id_val = user.get("mediclaim_id") or user.get("public_id") or "ADMIN0000001"
    token = create_access_token(formatted_user_id, role="admin")

    return {
        "accessToken": token,
        "tokenType": "Bearer",
        "expiresIn": ACCESS_TOKEN_SECONDS,
        "user": {
            "id": formatted_user_id,
            "fullName": user["full_name"],
            "email": user.get("email"),
            "phone": user["phone"],
            "role": "admin",
            "mediclaimId": format_mediclaim_id(med_id_val) if med_id_val.isdigit() and len(med_id_val) == 12 else med_id_val,
            "isActive": bool(user["is_active"]),
            "adminVerified": bool(user["admin_verified"]),
            "isProfileComplete": bool(user["profile_complete"]),
        },
    }

