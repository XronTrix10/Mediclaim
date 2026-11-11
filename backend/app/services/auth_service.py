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
    # Generate a unique 12-digit ID; uniqueness is also enforced by SQLite.
    for _ in range(20):
        candidate = str(secrets.randbelow(900_000_000_000) + 100_000_000_000)
        exists = conn.execute(
            "SELECT 1 FROM users WHERE mediclaim_id = ?", (candidate,)
        ).fetchone()
        if not exists:
            return candidate
    raise HTTPException(status_code=503, detail="Could not allocate Mediclaim ID. Retry.")

def register_user(payload):
    now = int(time.time())
    otp = generate_otp()
    user_id = f"usr-{uuid.uuid4()}"
    with get_db() as conn:
        duplicate = conn.execute(
            "SELECT phone, aadhaar_number FROM users WHERE phone = ? OR aadhaar_number = ?",
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
        conn.execute("""
            INSERT INTO users (
                user_id, full_name, date_of_birth, phone, aadhaar_number,
                mediclaim_id, password_hash, admin_verified, profile_complete,
                otp_hash, otp_expires_at, otp_attempts, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 0, ?)
        """, (
            user_id, payload.fullName, payload.dateOfBirth.isoformat(),
            payload.phone, payload.aadhaarNumber, mediclaim_id,
            hash_password(payload.password), hash_otp(otp), now + OTP_SECONDS, now
        ))

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
        "otpSent": bool(OTP_DEBUG),  # True means delivered only in the development adapter.
        "otpExpiresInSeconds": OTP_SECONDS,
    }

def verify_user_otp(payload):
    now = int(time.time())
    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (payload.userId,)
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
            conn.execute("UPDATE users SET otp_attempts = otp_attempts + 1 WHERE user_id = ?", (payload.userId,))
            raise HTTPException(status_code=400, detail={
                "status": "error", "code": "INVALID_OTP", "message": "The OTP is incorrect."
            })
        conn.execute(
            "UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE user_id = ?",
            (payload.userId,)
        )
        token = create_access_token(user["user_id"])
        return {
            "status": "success",
            "accessToken": token,
            "tokenType": "Bearer",
            "expiresIn": ACCESS_TOKEN_SECONDS,
            "user": {
                "id": user["user_id"],
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
            "SELECT * FROM users WHERE mediclaim_id = ?", (mediclaim_id,)
        ).fetchone()
    # Same error for unknown ID and wrong password to avoid account enumeration.
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail={
            "status": "error",
            "code": "INVALID_CREDENTIALS",
            "message": "Invalid Mediclaim ID or password."
        })
    return {
        "status": "success",
        "accessToken": create_access_token(user["user_id"]),
        "tokenType": "Bearer",
        "expiresIn": ACCESS_TOKEN_SECONDS,
        "user": {
            "id": user["user_id"],
            "fullName": user["full_name"],
            "role": "patient",
            "mediclaimId": f"{mediclaim_id[:4]} {mediclaim_id[4:8]} {mediclaim_id[8:]}",
            "isProfileComplete": bool(user["profile_complete"]),
        }
    }
