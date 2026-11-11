import secrets
import time
import uuid
from fastapi import HTTPException, status
from app.config import OTP_SECONDS, OTP_DEBUG, ACCESS_TOKEN_SECONDS
from app.database import get_db
from app.security import (
    hash_password, verify_password, generate_otp, hash_otp,
    verify_otp, normalize_mediclaim_id, create_access_token
)


def _new_mediclaim_id(conn) -> str:
    # Generate a unique 12-digit ID; uniqueness is also enforced by PostgreSQL.
    for _ in range(20):
        candidate = str(secrets.randbelow(900_000_000_000) + 100_000_000_000)
        exists = conn.execute(
            "SELECT 1 FROM users WHERE mediclaim_id = %s OR public_id = %s",
            (candidate, candidate)
        ).fetchone()
        if not exists:
            return candidate
    raise HTTPException(status_code=503, detail="Could not allocate Mediclaim ID. Retry.")


def register_user(payload):
    now = int(time.time())
    otp = generate_otp()
    user_uuid = uuid.uuid4()
    user_id = f"usr-{user_uuid}"

    with get_db() as conn:
        duplicate = conn.execute(
            "SELECT phone, aadhaar_number FROM users WHERE phone = %s OR aadhaar_number = %s",
            (payload.phone, payload.aadhaarNumber)
        ).fetchone()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "status": "error",
                    "code": "ACCOUNT_ALREADY_EXISTS",
                    "message": "An account with this phone number or Aadhaar number already exists."
                }
            )

        mediclaim_id = _new_mediclaim_id(conn)

        # Insert user into users table
        conn.execute("""
            INSERT INTO users (
                id, public_id, mediclaim_id, full_name, phone, aadhaar_number,
                password_hash, admin_verified, profile_complete,
                otp_hash, otp_expires_at, otp_attempts, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, false, false,
                %s, %s, 0, now(), now()
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

    # Development adapter: log OTP locally. Replace with an SMS provider before production.
    if OTP_DEBUG:
        print(f"[DEV ONLY] OTP for {payload.phone}: {otp} | Mediclaim ID: {mediclaim_id}")
    else:
        # Deliberately fail closed rather than pretending an SMS was sent.
        # Integrate an approved SMS provider here and return only after dispatch succeeds.
        print("[WARN] OTP_DEBUG is disabled but no SMS provider is configured.")

    return {
        "userId": user_id,
        "phone": payload.phone,
        "adminVerified": False,
        "otpSent": bool(OTP_DEBUG),
        "otpExpiresInSeconds": OTP_SECONDS,
    }


def verify_user_otp(payload):
    now = int(time.time())
    raw_user_id = payload.userId.replace("usr-", "")
    try:
        user_uuid = uuid.UUID(raw_user_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=404, detail={
            "status": "error", "code": "USER_NOT_FOUND", "message": "User not found."
        })

    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE id = %s", (str(user_uuid),)
        ).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail={
                "status": "error", "code": "USER_NOT_FOUND", "message": "User not found."
            })
        if not user["otp_hash"] or not user["otp_expires_at"] or now > user["otp_expires_at"]:
            raise HTTPException(status_code=400, detail={
                "status": "error", "code": "OTP_EXPIRED", "message": "OTP has expired. Register again or request a new OTP."
            })
        if user["otp_attempts"] >= 5:
            raise HTTPException(status_code=429, detail={
                "status": "error", "code": "OTP_ATTEMPTS_EXCEEDED", "message": "Too many incorrect OTP attempts."
            })
        if not verify_otp(payload.otp, user["otp_hash"]):
            conn.execute(
                "UPDATE users SET otp_attempts = otp_attempts + 1, updated_at = now() WHERE id = %s",
                (str(user_uuid),)
            )
            raise HTTPException(status_code=400, detail={
                "status": "error", "code": "INVALID_OTP", "message": "The OTP is incorrect."
            })

        conn.execute(
            "UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0, updated_at = now() WHERE id = %s",
            (str(user_uuid),)
        )
        formatted_user_id = f"usr-{user['id']}"
        token = create_access_token(formatted_user_id)
        return {
            "status": "success",
            "accessToken": token,
            "tokenType": "Bearer",
            "expiresIn": ACCESS_TOKEN_SECONDS,
            "user": {
                "id": formatted_user_id,
                "fullName": user["full_name"],
                "role": "patient",
                "adminVerified": bool(user["admin_verified"]),
                "isProfileComplete": bool(user["profile_complete"]),
            }
        }


def login_user(payload):
    mediclaim_id = normalize_mediclaim_id(payload.mediclaimId)
    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE mediclaim_id = %s OR public_id = %s",
            (mediclaim_id, mediclaim_id)
        ).fetchone()

    # Same error for unknown ID and wrong password to avoid account enumeration.
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail={
            "status": "error",
            "code": "INVALID_CREDENTIALS",
            "message": "Invalid Mediclaim ID or password."
        })

    formatted_user_id = f"usr-{user['id']}"
    med_id_val = user.get("mediclaim_id") or user.get("public_id") or mediclaim_id
    return {
        "status": "success",
        "accessToken": create_access_token(formatted_user_id),
        "tokenType": "Bearer",
        "expiresIn": ACCESS_TOKEN_SECONDS,
        "user": {
            "id": formatted_user_id,
            "fullName": user["full_name"],
            "role": "patient",
            "mediclaimId": f"{med_id_val[:4]} {med_id_val[4:8]} {med_id_val[8:]}",
            "isProfileComplete": bool(user["profile_complete"]),
        }
    }
