from datetime import datetime, timezone
import uuid
from typing import Any, Dict, Optional
from fastapi import status
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import format_mediclaim_id, normalize_mediclaim_id


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _format_date(dt: Any) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return str(dt)


def _format_timestamp(ts: Any) -> Optional[str]:
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts.strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(ts)


def get_patient_profile(user_id: str) -> Dict[str, Any]:
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    with get_db() as conn:
        row = conn.execute("""
            SELECT u.id AS user_id, u.mediclaim_id, u.aadhaar_number, u.full_name,
                   u.phone, u.profile_complete, u.created_at AS user_created_at,
                   p.id AS profile_id, p.date_of_birth, p.gender, p.blood_group,
                   p.address, p.emergency_contact_name, p.emergency_contact_phone,
                   p.emergency_contact_relation, p.created_at AS profile_created_at,
                   p.updated_at AS profile_updated_at
            FROM users u
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.id = %s
        """, (raw_user_id,)).fetchone()

    if not row:
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Profile Not Found",
            detail="Patient profile not found for authenticated user.",
            code="RECORD_NOT_FOUND"
        )

    full_name = row["full_name"]
    first_name = full_name.split()[0] if full_name else ""
    aadhaar_masked = None
    if row["aadhaar_number"]:
        aadhaar_masked = f"XXXX-XXXX-{row['aadhaar_number'][-4:]}"

    emergency_contact = None
    if row["emergency_contact_name"] or row["emergency_contact_phone"]:
        emergency_contact = {
            "name": row["emergency_contact_name"] or "",
            "phone": row["emergency_contact_phone"] or "",
            "relation": row["emergency_contact_relation"] or "Other"
        }

    return {
        "id": f"pat_{row['profile_id']}" if row["profile_id"] else f"pat_{row['user_id']}",
        "userId": f"usr_{row['user_id']}",
        "mediclaimId": format_mediclaim_id(row["mediclaim_id"] or ""),
        "aadhaarMasked": aadhaar_masked,
        "fullName": full_name,
        "firstName": first_name,
        "dateOfBirth": _format_date(row["date_of_birth"]) or "",
        "gender": row["gender"],
        "bloodGroup": row["blood_group"],
        "phone": row["phone"],
        "address": row["address"],
        "emergencyContact": emergency_contact,
        "isProfileComplete": bool(row["profile_complete"]),
        "createdAt": _format_timestamp(row["profile_created_at"] or row["user_created_at"]),
        "updatedAt": _format_timestamp(row["profile_updated_at"] or row["user_created_at"]),
    }


def complete_patient_profile(user_id: str, payload) -> Dict[str, Any]:
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    now = datetime.now(timezone.utc)
    now_str = _now_iso()

    with get_db() as conn:
        user = conn.execute("SELECT id FROM users WHERE id = %s", (raw_user_id,)).fetchone()
        if not user:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="User Not Found",
                detail="User account does not exist.",
                code="USER_NOT_FOUND"
            )

        # Update or insert patient profile
        pat_profile = conn.execute("SELECT id FROM patient_profiles WHERE user_id = %s", (raw_user_id,)).fetchone()
        if not pat_profile:
            import secrets
            pat_pub_id = f"pat{secrets.randbelow(900_000_000) + 100_000_000}"
            conn.execute("""
                INSERT INTO patient_profiles (
                    public_id, user_id, date_of_birth, gender, blood_group,
                    address, emergency_contact_name, emergency_contact_phone,
                    emergency_contact_relation, created_at, updated_at
                ) VALUES (
                    %s, %s, '1990-01-01', %s, %s,
                    %s, %s, %s, %s, %s, %s
                )
            """, (
                pat_pub_id, raw_user_id, payload.gender, payload.bloodGroup,
                payload.address, payload.emergencyName, payload.emergencyPhone,
                payload.emergencyRelation, now, now
            ))
        else:
            conn.execute("""
                UPDATE patient_profiles
                SET gender = %s,
                    blood_group = %s,
                    address = %s,
                    emergency_contact_name = %s,
                    emergency_contact_phone = %s,
                    emergency_contact_relation = %s,
                    updated_at = %s
                WHERE user_id = %s
            """, (
                payload.gender,
                payload.bloodGroup,
                payload.address,
                payload.emergencyName,
                payload.emergencyPhone,
                payload.emergencyRelation,
                now,
                raw_user_id
            ))

        # Mark user profile as complete
        conn.execute("""
            UPDATE users
            SET profile_complete = true, updated_at = %s
            WHERE id = %s
        """, (now, raw_user_id))

    return {
        "isProfileComplete": True,
        "updatedAt": now_str
    }


def update_permitted_details(user_id: str, payload) -> Dict[str, Any]:
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    now = datetime.now(timezone.utc)
    now_str = _now_iso()

    with get_db() as conn:
        user = conn.execute("SELECT id FROM users WHERE id = %s", (raw_user_id,)).fetchone()
        if not user:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="User Not Found",
                detail="User account does not exist.",
                code="USER_NOT_FOUND"
            )

        if payload.phone:
            duplicate = conn.execute(
                "SELECT id FROM users WHERE phone = %s AND id != %s", (payload.phone, raw_user_id)
            ).fetchone()
            if duplicate:
                raise APIProblemException(
                    status_code=status.HTTP_409_CONFLICT,
                    title="Phone Number Already Registered",
                    detail="This phone number is already registered to another account.",
                    code="CONFLICT"
                )
            conn.execute("UPDATE users SET phone = %s, updated_at = %s WHERE id = %s", (payload.phone, now, raw_user_id))

        if payload.address:
            conn.execute("UPDATE patient_profiles SET address = %s, updated_at = %s WHERE user_id = %s", (payload.address, now, raw_user_id))

        if payload.emergencyContact:
            conn.execute("""
                UPDATE patient_profiles
                SET emergency_contact_name = %s,
                    emergency_contact_phone = %s,
                    emergency_contact_relation = %s,
                    updated_at = %s
                WHERE user_id = %s
            """, (
                payload.emergencyContact.name,
                payload.emergencyContact.phone,
                payload.emergencyContact.relation,
                now,
                raw_user_id
            ))

        # If address and emergency contact are present, ensure profile_complete is set
        if payload.address and payload.emergencyContact:
            conn.execute("UPDATE users SET profile_complete = true, updated_at = %s WHERE id = %s", (now, raw_user_id))

    return get_patient_profile(user_id)
