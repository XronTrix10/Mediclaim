from datetime import datetime, timezone
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple
from fastapi import status
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import AuthenticatedUser, format_mediclaim_id
from app.services.audit_service import record_audit

logger = logging.getLogger("mediclaim.admin")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _mask_aadhaar(aadhaar: Optional[str]) -> str:
    if not aadhaar:
        return "XXXX-XXXX-XXXX"
    clean = aadhaar.strip()
    return f"XXXX-XXXX-{clean[-4:]}" if len(clean) >= 4 else "XXXX-XXXX-XXXX"


def _clean_user_id(user_id: str) -> str:
    raw = user_id.replace("usr-", "").replace("usr_", "")
    try:
        return str(uuid.UUID(raw))
    except (ValueError, AttributeError):
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="User Not Found",
            detail=f"User identifier '{user_id}' is invalid or does not exist.",
            code="USER_NOT_FOUND"
        )


def list_pending_verifications(
    limit: int = 50,
    offset: int = 0,
    search_query: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    with get_db() as conn:
        base_sql = """
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'patient'
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.admin_verified = false AND u.is_active = true
        """
        params: List[Any] = []
        if search_query:
            base_sql += " AND (u.full_name ILIKE %s OR u.phone ILIKE %s OR u.aadhaar_number ILIKE %s)"
            q = f"%{search_query.strip()}%"
            params.extend([q, q, q])

        count_sql = f"SELECT COUNT(*) {base_sql}"
        total = conn.execute(count_sql, tuple(params)).fetchone()["count"]

        data_sql = f"""
            SELECT u.id, u.full_name, u.phone, u.aadhaar_number, u.created_at,
                   p.date_of_birth
            {base_sql}
            ORDER BY u.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        rows = conn.execute(data_sql, tuple(params)).fetchall()

    items = []
    for r in rows:
        dob_str = r["date_of_birth"].strftime("%Y-%m-%d") if r.get("date_of_birth") else ""
        items.append({
            "userId": f"usr_{r['id']}",
            "fullName": r["full_name"],
            "dateOfBirth": dob_str,
            "phone": r["phone"],
            "aadhaarMasked": _mask_aadhaar(r["aadhaar_number"]),
            "accountStatus": "pending_admin_approval",
            "phoneVerified": True,
            "adminVerified": False,
            "registeredAt": r["created_at"].strftime("%Y-%m-%dT%H:%M:%SZ") if r.get("created_at") else _now_iso(),
        })

    return items, total


def get_verification_detail(user_id: str) -> Dict[str, Any]:
    raw_uuid = _clean_user_id(user_id)
    with get_db() as conn:
        row = conn.execute("""
            SELECT u.id, u.full_name, u.phone, u.aadhaar_number, u.admin_verified, u.is_active, u.created_at,
                   p.id AS patient_id, p.date_of_birth, p.gender, p.blood_group, p.address,
                   p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation
            FROM users u
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.id = %s
        """, (raw_uuid,)).fetchone()

    if not row:
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="User Not Found",
            detail=f"Patient user '{user_id}' was not found.",
            code="USER_NOT_FOUND"
        )

    emergency_contact = None
    if row.get("emergency_contact_name"):
        emergency_contact = {
            "name": row["emergency_contact_name"],
            "phone": row.get("emergency_contact_phone") or "",
            "relation": row.get("emergency_contact_relation") or "Parent",
        }

    dob_str = row["date_of_birth"].strftime("%Y-%m-%d") if row.get("date_of_birth") else ""
    return {
        "userId": f"usr_{row['id']}",
        "fullName": row["full_name"],
        "dateOfBirth": dob_str,
        "phone": row["phone"],
        "aadhaarMasked": _mask_aadhaar(row["aadhaar_number"]),
        "accountStatus": "active" if row["admin_verified"] else "pending_admin_approval",
        "phoneVerified": True,
        "adminVerified": bool(row["admin_verified"]),
        "gender": row.get("gender"),
        "bloodGroup": row.get("blood_group"),
        "address": row.get("address"),
        "emergencyContact": emergency_contact,
        "registeredAt": row["created_at"].strftime("%Y-%m-%dT%H:%M:%SZ") if row.get("created_at") else _now_iso(),
    }


def approve_patient(admin_user: AuthenticatedUser, user_id: str) -> Dict[str, Any]:
    raw_uuid = _clean_user_id(user_id)
    with get_db() as conn:
        user = conn.execute("""
            SELECT u.id, u.full_name, u.phone, u.mediclaim_id, u.admin_verified,
                   p.id AS patient_profile_id
            FROM users u
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.id = %s
        """, (raw_uuid,)).fetchone()

        if not user:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="User Not Found",
                detail=f"Patient user '{user_id}' was not found.",
                code="USER_NOT_FOUND"
            )

        if user["admin_verified"]:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Already Verified",
                detail="This patient account is already verified and approved.",
                code="ALREADY_VERIFIED"
            )

        conn.execute("""
            UPDATE users
            SET admin_verified = true, updated_at = now()
            WHERE id = %s
        """, (raw_uuid,))

        # Immutable audit trail
        pat_prof_id = str(user["patient_profile_id"]) if user.get("patient_profile_id") else None
        formatted_med_id = format_mediclaim_id(user["mediclaim_id"])
        record_audit(
            actor_user_id=admin_user.id,
            patient_id=pat_prof_id,
            action="approve",
            what=f"Approved patient registration for {user['full_name']} and dispatched Mediclaim ID {formatted_med_id}",
            actor_name=admin_user.full_name,
            actor_role="admin",
        )

    logger.info(
        "[NOTIFICATION SENT] Dispatched Mediclaim ID %s to %s (%s)",
        formatted_med_id, user["full_name"], user["phone"]
    )

    return {
        "userId": f"usr_{user['id']}",
        "fullName": user["full_name"],
        "phone": user["phone"],
        "mediclaimId": formatted_med_id,
        "adminVerified": True,
        "notificationSent": True,
    }


def reject_patient(admin_user: AuthenticatedUser, user_id: str, reason: str) -> Dict[str, Any]:
    raw_uuid = _clean_user_id(user_id)
    with get_db() as conn:
        user = conn.execute("""
            SELECT u.id, u.full_name, u.phone, p.id AS patient_profile_id
            FROM users u
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.id = %s
        """, (raw_uuid,)).fetchone()

        if not user:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="User Not Found",
                detail=f"Patient user '{user_id}' was not found.",
                code="USER_NOT_FOUND"
            )

        conn.execute("""
            UPDATE users
            SET is_active = false, updated_at = now()
            WHERE id = %s
        """, (raw_uuid,))

        pat_prof_id = str(user["patient_profile_id"]) if user.get("patient_profile_id") else None
        record_audit(
            actor_user_id=admin_user.id,
            patient_id=pat_prof_id,
            action="revoke",
            what=f"Rejected patient registration for {user['full_name']}: {reason}",
            actor_name=admin_user.full_name,
            actor_role="admin",
        )

    logger.info("[NOTIFICATION SENT] Sent registration rejection notification to %s: %s", user["phone"], reason)
    return {"userId": f"usr_{user['id']}", "rejected": True, "reason": reason}


def get_admin_stats() -> Dict[str, int]:
    with get_db() as conn:
        total_patients = conn.execute(
            "SELECT COUNT(*) FROM patient_profiles"
        ).fetchone()["count"]

        pending_verifications = conn.execute("""
            SELECT COUNT(*) FROM users u
            JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'patient'
            WHERE u.admin_verified = false AND u.is_active = true
        """).fetchone()["count"]

        approved_patients = conn.execute("""
            SELECT COUNT(*) FROM users u
            JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'patient'
            WHERE u.admin_verified = true AND u.is_active = true
        """).fetchone()["count"]

        total_practitioners = conn.execute(
            "SELECT COUNT(*) FROM practitioner_profiles"
        ).fetchone()["count"]

        total_organizations = conn.execute(
            "SELECT COUNT(*) FROM healthcare_organizations"
        ).fetchone()["count"]

        total_break_glass = conn.execute(
            "SELECT COUNT(*) FROM audit_events WHERE action = 'emergency'"
        ).fetchone()["count"]

        total_records = conn.execute(
            "SELECT COUNT(*) FROM clinical_records WHERE deleted_at IS NULL"
        ).fetchone()["count"]

    return {
        "totalPatients": total_patients,
        "pendingVerifications": pending_verifications,
        "approvedPatients": approved_patients,
        "totalPractitioners": total_practitioners,
        "totalHealthcareOrganizations": total_organizations,
        "emergencyBreakGlassEvents": total_break_glass,
        "totalClinicalRecords": total_records,
    }


def list_all_patients(
    limit: int = 50,
    offset: int = 0,
    search_query: Optional[str] = None,
    verified_only: Optional[bool] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    with get_db() as conn:
        base_sql = """
            FROM patient_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE 1=1
        """
        params: List[Any] = []
        if search_query:
            base_sql += " AND (u.full_name ILIKE %s OR u.phone ILIKE %s OR u.mediclaim_id ILIKE %s)"
            q = f"%{search_query.strip()}%"
            params.extend([q, q, q])

        if verified_only is not None:
            base_sql += " AND u.admin_verified = %s"
            params.append(verified_only)

        count_sql = f"SELECT COUNT(*) {base_sql}"
        total = conn.execute(count_sql, tuple(params)).fetchone()["count"]

        data_sql = f"""
            SELECT p.id, p.public_id, p.date_of_birth,
                   u.id AS user_id, u.full_name, u.phone, u.mediclaim_id, u.admin_verified, u.is_active, u.created_at
            {base_sql}
            ORDER BY u.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        rows = conn.execute(data_sql, tuple(params)).fetchall()

    items = []
    for r in rows:
        dob_str = r["date_of_birth"].strftime("%Y-%m-%d") if r.get("date_of_birth") else ""
        items.append({
            "id": f"pat_{r['id']}",
            "userId": f"usr_{r['user_id']}",
            "mediclaimId": format_mediclaim_id(r.get("mediclaim_id") or r["public_id"]),
            "fullName": r["full_name"],
            "phone": r["phone"],
            "dateOfBirth": dob_str,
            "adminVerified": bool(r["admin_verified"]),
            "isActive": bool(r["is_active"]),
            "createdAt": r["created_at"].strftime("%Y-%m-%dT%H:%M:%SZ") if r.get("created_at") else _now_iso(),
        })

    return items, total


def list_global_emergency_events(limit: int = 50, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
    with get_db() as conn:
        count_sql = "SELECT COUNT(*) FROM audit_events WHERE action = 'emergency'"
        total = conn.execute(count_sql).fetchone()["count"]

        rows = conn.execute("""
            SELECT a.id, a.patient_id, a.actor_user_id, a.metadata, a.occurred_at,
                   u_doc.full_name AS doctor_name,
                   u_pat.full_name AS patient_name,
                   u_pat.mediclaim_id AS patient_mediclaim_id
            FROM audit_events a
            LEFT JOIN users u_doc ON u_doc.id = a.actor_user_id
            LEFT JOIN patient_profiles p ON p.id = a.patient_id
            LEFT JOIN users u_pat ON u_pat.id = p.user_id
            WHERE a.action = 'emergency'
            ORDER BY a.occurred_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset)).fetchall()

    items = []
    for r in rows:
        meta = r["metadata"] if isinstance(r.get("metadata"), dict) else {}
        items.append({
            "id": f"emg_{r['id']}",
            "patientId": f"pat_{r['patient_id']}" if r.get("patient_id") else None,
            "patientName": r.get("patient_name") or "Patient",
            "patientMediclaimId": format_mediclaim_id(r["patient_mediclaim_id"]) if r.get("patient_mediclaim_id") else None,
            "doctorName": r.get("doctor_name") or meta.get("requesterName") or "Emergency Practitioner",
            "reason": meta.get("emergencyType") or meta.get("reason") or "Critical Care",
            "justification": meta.get("clinicalJustification") or meta.get("justification"),
            "accessedAt": r["occurred_at"].strftime("%Y-%m-%dT%H:%M:%SZ") if r.get("occurred_at") else _now_iso(),
            "status": "audited",
        })

    return items, total
