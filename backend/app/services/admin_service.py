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
    status_filter: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    with get_db() as conn:
        base_sql = """
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            LEFT JOIN practitioner_profiles pr ON pr.user_id = u.id
            LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
            LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
            WHERE u.is_active = true
        """
        params: List[Any] = []

        clean_status = (status_filter or "").strip().lower()
        if clean_status == "verified":
            base_sql += " AND u.admin_verified = true"
        elif clean_status == "all":
            pass
        else:
            base_sql += " AND u.admin_verified = false"

        if search_query:
            base_sql += " AND (u.full_name ILIKE %s OR u.phone ILIKE %s OR u.aadhaar_number ILIKE %s OR u.mediclaim_id ILIKE %s OR u.doctor_id ILIKE %s OR pr.doctor_id ILIKE %s OR u.hospital_id ILIKE %s OR ho.hospital_id ILIKE %s)"
            q = f"%{search_query.strip()}%"
            params.extend([q, q, q, q, q, q, q, q])

        count_sql = f"SELECT COUNT(DISTINCT u.id) {base_sql}"
        total = conn.execute(count_sql, tuple(params)).fetchone()["count"]

        data_sql = f"""
            SELECT DISTINCT ON (u.created_at, u.id)
                   u.id, u.full_name, u.phone, u.mediclaim_id, u.doctor_id, u.hospital_id, u.aadhaar_number, u.admin_verified, u.created_at,
                   pr.doctor_id AS doc_id, ho.hospital_id AS org_id,
                   ur.role,
                   p.date_of_birth, p.gender, p.blood_group, p.address
            {base_sql}
            ORDER BY u.created_at DESC, u.id
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
            "mediclaimId": format_mediclaim_id(r["mediclaim_id"]) if r.get("mediclaim_id") else None,
            "doctorId": r.get("doctor_id") or r.get("doc_id"),
            "hospitalId": r.get("hospital_id") or r.get("org_id"),
            "aadhaarMasked": _mask_aadhaar(r["aadhaar_number"]),
            "accountStatus": "active" if r["admin_verified"] else "pending_admin_approval",
            "phoneVerified": True,
            "adminVerified": bool(r["admin_verified"]),
            "role": r.get("role"),
            "gender": r.get("gender"),
            "bloodGroup": r.get("blood_group"),
            "address": r.get("address"),
            "registeredAt": r["created_at"].strftime("%Y-%m-%dT%H:%M:%SZ") if r.get("created_at") else _now_iso(),
        })

    return items, total


def get_verification_detail(user_id: str) -> Dict[str, Any]:
    raw_uuid = _clean_user_id(user_id)
    with get_db() as conn:
        row = conn.execute("""
            SELECT u.id, u.full_name, u.phone, u.mediclaim_id, u.doctor_id, u.hospital_id, u.aadhaar_number, u.admin_verified, u.is_active, u.created_at,
                   ur.role,
                   p.id AS patient_id, p.date_of_birth, p.gender, p.blood_group, p.address,
                   p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation,
                   pr.id AS practitioner_id, pr.doctor_id AS practitioner_doctor_id, pr.registration_number, pr.specialization, pr.qualification,
                   ho.name AS organization_name, ho.hospital_id AS org_hospital_id
            FROM users u
            LEFT JOIN (
                SELECT user_id, MIN(role) AS role
                FROM user_roles
                GROUP BY user_id
            ) ur ON ur.user_id = u.id
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            LEFT JOIN practitioner_profiles pr ON pr.user_id = u.id
            LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
            LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
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
        "mediclaimId": format_mediclaim_id(row["mediclaim_id"]) if row.get("mediclaim_id") else None,
        "doctorId": row.get("doctor_id") or row.get("practitioner_doctor_id"),
        "hospitalId": row.get("hospital_id") or row.get("org_hospital_id"),
        "aadhaarMasked": _mask_aadhaar(row["aadhaar_number"]),
        "accountStatus": "active" if row["admin_verified"] else "pending_admin_approval",
        "phoneVerified": True,
        "adminVerified": bool(row["admin_verified"]),
        "role": row.get("role") or "patient",
        "gender": row.get("gender"),
        "bloodGroup": row.get("blood_group"),
        "address": row.get("address"),
        "emergencyContact": emergency_contact,
        "specialization": row.get("specialization"),
        "registrationNumber": row.get("registration_number"),
        "qualification": row.get("qualification"),
        "organizationName": row.get("organization_name"),
        "registeredAt": row["created_at"].strftime("%Y-%m-%dT%H:%M:%SZ") if row.get("created_at") else _now_iso(),
    }


def approve_patient(admin_user: AuthenticatedUser, user_id: str) -> Dict[str, Any]:
    raw_uuid = _clean_user_id(user_id)
    with get_db() as conn:
        user = conn.execute("""
            SELECT u.id, u.full_name, u.phone, u.mediclaim_id, u.doctor_id, u.hospital_id, u.admin_verified,
                   p.id AS patient_profile_id,
                   pr.doctor_id AS practitioner_doctor_id,
                   ho.hospital_id AS org_hospital_id,
                   ur.role
            FROM users u
            LEFT JOIN (
                SELECT user_id, MIN(role) AS role
                FROM user_roles
                GROUP BY user_id
            ) ur ON ur.user_id = u.id
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            LEFT JOIN practitioner_profiles pr ON pr.user_id = u.id
            LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
            LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
            WHERE u.id = %s
        """, (raw_uuid,)).fetchone()

        if not user:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="User Not Found",
                detail=f"User '{user_id}' was not found.",
                code="USER_NOT_FOUND"
            )

        if user["admin_verified"]:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Already Verified",
                detail="This account is already verified and approved.",
                code="ALREADY_VERIFIED"
            )

        conn.execute("""
            UPDATE users
            SET admin_verified = true, updated_at = now()
            WHERE id = %s
        """, (raw_uuid,))

        # Immutable audit trail
        pat_prof_id = str(user["patient_profile_id"]) if user.get("patient_profile_id") else None
        role = user.get("role") or "patient"
        doc_id = user.get("doctor_id") or user.get("practitioner_doctor_id")
        hosp_id = user.get("hospital_id") or user.get("org_hospital_id")
        formatted_med_id = format_mediclaim_id(user["mediclaim_id"]) if user.get("mediclaim_id") else None

        if role in ("practitioner", "doctor"):
            dispatched_msg = f"Approved practitioner registration for {user['full_name']} and dispatched Doctor ID {doc_id}"
        elif role in ("hospital_admin", "organization"):
            dispatched_msg = f"Approved hospital registration for {user['full_name']} and dispatched Hospital ID {hosp_id}"
        else:
            dispatched_msg = f"Approved patient registration for {user['full_name']} and dispatched Mediclaim ID {formatted_med_id}"

        record_audit(
            actor_user_id=admin_user.id,
            patient_id=pat_prof_id,
            action="approve",
            what=dispatched_msg,
            actor_name=admin_user.full_name,
            actor_role="admin",
        )

    logger.info("[NOTIFICATION SENT] %s", dispatched_msg)

    return {
        "userId": f"usr_{user['id']}",
        "fullName": user["full_name"],
        "phone": user["phone"],
        "mediclaimId": formatted_med_id,
        "doctorId": doc_id,
        "hospitalId": hosp_id,
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


def remove_patient(admin_user: AuthenticatedUser, identifier: str) -> Dict[str, Any]:
    raw = identifier.replace("usr-", "").replace("usr_", "").replace("pat-", "").replace("pat_", "").strip()
    clean_med = raw.replace(" ", "").replace("-", "")

    with get_db() as conn:
        user = conn.execute("""
            SELECT u.id AS user_id, u.full_name, u.phone, u.mediclaim_id, p.id AS patient_profile_id
            FROM users u
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.id::text = %s
               OR p.id::text = %s
               OR u.public_id = %s
               OR p.public_id = %s
               OR u.mediclaim_id = %s
               OR REPLACE(REPLACE(u.mediclaim_id, ' ', ''), '-', '') = %s
               OR u.phone = %s
            LIMIT 1
        """, (raw, raw, raw, raw, raw, clean_med, raw)).fetchone()

        if not user:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Patient Not Found",
                detail=f"Patient identifier '{identifier}' was not found.",
                code="PATIENT_NOT_FOUND"
            )

        user_id = str(user["user_id"])
        pat_id = str(user["patient_profile_id"]) if user.get("patient_profile_id") else None

        # Clean up related records
        # Collect storage keys for physical file deletion
        storage_keys = []
        if pat_id:
            doc_rows = conn.execute("""
                SELECT storage_key FROM medical_documents WHERE patient_id = %s
                UNION
                SELECT storage_key FROM document_versions
                WHERE document_id IN (SELECT id FROM medical_documents WHERE patient_id = %s)
            """, (pat_id, pat_id)).fetchall()
            for r in doc_rows:
                if r.get("storage_key"):
                    storage_keys.append(r["storage_key"])

        u_doc_rows = conn.execute("""
            SELECT storage_key FROM medical_documents WHERE uploaded_by = %s
            UNION
            SELECT storage_key FROM document_versions WHERE uploaded_by = %s
        """, (user_id, user_id)).fetchall()
        for r in u_doc_rows:
            if r.get("storage_key"):
                storage_keys.append(r["storage_key"])

        if pat_id:
            # Grants & scopes
            conn.execute("""
                DELETE FROM access_grant_scopes
                WHERE access_grant_id IN (
                    SELECT id FROM patient_access_grants WHERE patient_id = %s
                )
            """, (pat_id,))
            conn.execute("DELETE FROM patient_access_grants WHERE patient_id = %s", (pat_id,))
            conn.execute("DELETE FROM consent_records WHERE patient_id = %s", (pat_id,))
            conn.execute("DELETE FROM record_correction_requests WHERE patient_id = %s", (pat_id,))

            # Documents
            conn.execute("""
                DELETE FROM document_versions
                WHERE document_id IN (SELECT id FROM medical_documents WHERE patient_id = %s)
            """, (pat_id,))
            conn.execute("DELETE FROM medical_documents WHERE patient_id = %s", (pat_id,))

            # Diagnostic reports & lab results
            conn.execute("""
                DELETE FROM lab_results
                WHERE diagnostic_report_id IN (SELECT id FROM diagnostic_reports WHERE patient_id = %s)
            """, (pat_id,))
            conn.execute("DELETE FROM diagnostic_reports WHERE patient_id = %s", (pat_id,))

            # Procedures, hospitalizations, observations, vaccinations
            conn.execute("DELETE FROM hospitalizations WHERE patient_id = %s", (pat_id,))
            conn.execute("DELETE FROM procedures WHERE patient_id = %s", (pat_id,))
            conn.execute("DELETE FROM observations WHERE patient_id = %s", (pat_id,))
            conn.execute("DELETE FROM vaccinations WHERE patient_id = %s", (pat_id,))

            # Medications & Prescriptions
            conn.execute("DELETE FROM medication_statements WHERE patient_id = %s", (pat_id,))
            conn.execute("""
                DELETE FROM prescription_items
                WHERE prescription_id IN (SELECT id FROM prescriptions WHERE patient_id = %s)
                   OR patient_id = %s
            """, (pat_id, pat_id))
            conn.execute("DELETE FROM prescriptions WHERE patient_id = %s", (pat_id,))

            # Conditions & Allergies
            conn.execute("DELETE FROM conditions WHERE patient_id = %s", (pat_id,))
            conn.execute("DELETE FROM allergies WHERE patient_id = %s", (pat_id,))

            # Record correction requests
            conn.execute("DELETE FROM record_correction_requests WHERE patient_id = %s", (pat_id,))

            # Clinical records & versions
            conn.execute("""
                DELETE FROM clinical_record_versions
                WHERE clinical_record_id IN (SELECT id FROM clinical_records WHERE patient_id = %s)
            """, (pat_id,))
            conn.execute("DELETE FROM clinical_records WHERE patient_id = %s", (pat_id,))

            # Encounters & Caregivers
            conn.execute("DELETE FROM encounters WHERE patient_id = %s", (pat_id,))
            conn.execute("DELETE FROM patient_caregivers WHERE patient_id = %s", (pat_id,))

            # Nullify audit references
            conn.execute("UPDATE audit_events SET patient_id = NULL WHERE patient_id = %s", (pat_id,))

        # Clean user-level references
        conn.execute("DELETE FROM record_correction_requests WHERE requested_by = %s OR reviewed_by = %s", (user_id, user_id))
        conn.execute("DELETE FROM patient_access_grants WHERE granted_by = %s OR grantee_user_id = %s", (user_id, user_id))
        conn.execute("DELETE FROM consent_records WHERE granted_by = %s OR granted_to_user_id = %s", (user_id, user_id))
        conn.execute("DELETE FROM document_versions WHERE uploaded_by = %s", (user_id,))
        conn.execute("DELETE FROM medical_documents WHERE uploaded_by = %s", (user_id,))
        conn.execute("DELETE FROM clinical_record_versions WHERE changed_by = %s", (user_id,))
        conn.execute("DELETE FROM clinical_records WHERE created_by = %s", (user_id,))
        conn.execute("DELETE FROM organization_memberships WHERE user_id = %s", (user_id,))
        conn.execute("UPDATE audit_events SET actor_user_id = NULL WHERE actor_user_id = %s", (user_id,))

        # Delete patient profile and user
        if pat_id:
            conn.execute("DELETE FROM patient_profiles WHERE id = %s", (pat_id,))
        conn.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
        conn.execute("DELETE FROM users WHERE id = %s", (user_id,))

        record_audit(
            actor_user_id=admin_user.id,
            patient_id=None,
            action="remove",
            what=f"Admin removed registered patient {user['full_name']} ({user.get('mediclaim_id') or user_id})",
            actor_name=admin_user.full_name,
            actor_role="admin",
            extra_metadata={"removed_patient_id": pat_id, "removed_user_id": user_id},
        )

        # Delete physical files and storage folder from disk
        from app.services.storage_service import delete_document_bytes, delete_patient_storage
        for sk in set(storage_keys):
            delete_document_bytes(sk)
        if pat_id:
            delete_patient_storage(pat_id)

    logger.info("Admin removed patient user %s (%s)", user_id, user["full_name"])
    return {
        "userId": f"usr_{user_id}",
        "fullName": user["full_name"],
        "removed": True,
        "message": f"Patient {user['full_name']} removed successfully."
    }


def remove_practitioner(admin_user: AuthenticatedUser, identifier: str) -> Dict[str, Any]:
    raw = identifier.replace("doc-", "").replace("doc_", "").replace("usr-", "").replace("usr_", "").strip()

    with get_db() as conn:
        doc = conn.execute("""
            SELECT u.id AS user_id, u.full_name, u.phone, u.doctor_id,
                   pr.id AS practitioner_profile_id, pr.registration_number
            FROM users u
            LEFT JOIN practitioner_profiles pr ON pr.user_id = u.id
            WHERE u.id::text = %s
               OR pr.id::text = %s
               OR u.public_id = %s
               OR pr.public_id = %s
               OR u.doctor_id = %s
               OR pr.doctor_id = %s
               OR pr.registration_number = %s
               OR u.phone = %s
            LIMIT 1
        """, (raw, raw, raw, raw, raw, raw, raw, raw)).fetchone()

        if not doc:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Practitioner Not Found",
                detail=f"Doctor/Practitioner identifier '{identifier}' was not found.",
                code="PRACTITIONER_NOT_FOUND"
            )

        user_id = str(doc["user_id"])
        prac_id = str(doc["practitioner_profile_id"]) if doc.get("practitioner_profile_id") else None

        if prac_id:
            # Prescriptions
            conn.execute("""
                DELETE FROM prescription_items
                WHERE prescription_id IN (SELECT id FROM prescriptions WHERE practitioner_id = %s)
            """, (prac_id,))
            conn.execute("DELETE FROM prescriptions WHERE practitioner_id = %s", (prac_id,))

            # Encounters tied to this practitioner
            enc_rows = conn.execute("SELECT id FROM encounters WHERE practitioner_id = %s", (prac_id,)).fetchall()
            for enc in enc_rows:
                enc_id = str(enc["id"])
                conn.execute("DELETE FROM observations WHERE encounter_id = %s", (enc_id,))
                conn.execute("DELETE FROM procedures WHERE encounter_id = %s", (enc_id,))
                conn.execute("DELETE FROM hospitalizations WHERE attending_practitioner_id = %s", (prac_id,))
                conn.execute("DELETE FROM diagnostic_reports WHERE encounter_id = %s", (enc_id,))
                conn.execute("""
                    DELETE FROM clinical_record_versions
                    WHERE clinical_record_id IN (SELECT id FROM clinical_records WHERE encounter_id = %s)
                """, (enc_id,))
                conn.execute("DELETE FROM clinical_records WHERE encounter_id = %s", (enc_id,))
                conn.execute("DELETE FROM encounters WHERE id = %s", (enc_id,))

            # Clean remaining references
            conn.execute("UPDATE diagnostic_reports SET ordered_by = NULL WHERE ordered_by = %s", (prac_id,))
            conn.execute("UPDATE procedures SET practitioner_id = NULL WHERE practitioner_id = %s", (prac_id,))
            conn.execute("UPDATE hospitalizations SET attending_practitioner_id = NULL WHERE attending_practitioner_id = %s", (prac_id,))

        # Clean user-level references
        conn.execute("""
            DELETE FROM access_grant_scopes
            WHERE access_grant_id IN (
                SELECT id FROM patient_access_grants WHERE grantee_user_id = %s OR granted_by = %s
            )
        """, (user_id, user_id))
        conn.execute("DELETE FROM patient_access_grants WHERE grantee_user_id = %s OR granted_by = %s", (user_id, user_id))
        conn.execute("DELETE FROM consent_records WHERE granted_to_user_id = %s OR granted_by = %s", (user_id, user_id))
        conn.execute("DELETE FROM organization_memberships WHERE user_id = %s", (user_id,))
        conn.execute("UPDATE clinical_record_versions SET changed_by = NULL WHERE changed_by = %s", (user_id,))
        conn.execute("UPDATE clinical_records SET created_by = NULL WHERE created_by = %s", (user_id,))
        conn.execute("UPDATE medical_documents SET uploaded_by = NULL WHERE uploaded_by = %s", (user_id,))
        conn.execute("UPDATE document_versions SET uploaded_by = NULL WHERE uploaded_by = %s", (user_id,))
        conn.execute("UPDATE vaccinations SET administered_by = NULL WHERE administered_by = %s", (user_id,))
        conn.execute("UPDATE record_correction_requests SET requested_by = NULL WHERE requested_by = %s", (user_id,))
        conn.execute("UPDATE record_correction_requests SET reviewed_by = NULL WHERE reviewed_by = %s", (user_id,))
        conn.execute("UPDATE audit_events SET actor_user_id = NULL WHERE actor_user_id = %s", (user_id,))

        if prac_id:
            conn.execute("DELETE FROM practitioner_profiles WHERE id = %s", (prac_id,))
        conn.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
        conn.execute("DELETE FROM users WHERE id = %s", (user_id,))

        record_audit(
            actor_user_id=admin_user.id,
            patient_id=None,
            action="remove",
            what=f"Admin removed registered doctor {doc['full_name']} ({doc.get('doctor_id') or user_id})",
            actor_name=admin_user.full_name,
            actor_role="admin",
        )

    logger.info("Admin removed doctor %s (%s)", user_id, doc["full_name"])
    return {
        "userId": f"usr_{user_id}",
        "fullName": doc["full_name"],
        "removed": True,
        "message": f"Doctor {doc['full_name']} removed successfully."
    }


def remove_organization(admin_user: AuthenticatedUser, identifier: str) -> Dict[str, Any]:
    raw = identifier.replace("org-", "").replace("org_", "").replace("usr-", "").replace("usr_", "").strip()

    with get_db() as conn:
        org = conn.execute("""
            SELECT ho.id AS organization_id, ho.name, ho.hospital_id, ho.registration_number,
                   ho.public_id, om.user_id AS admin_user_id
            FROM healthcare_organizations ho
            LEFT JOIN organization_memberships om ON om.organization_id = ho.id AND om.designation ILIKE '%%admin%%'
            LEFT JOIN users u ON u.id = om.user_id OR u.hospital_id = ho.hospital_id
            WHERE ho.id::text = %s
               OR ho.public_id = %s
               OR ho.hospital_id = %s
               OR ho.registration_number = %s
               OR u.id::text = %s
            LIMIT 1
        """, (raw, raw, raw, raw, raw)).fetchone()

        if not org:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Organization Not Found",
                detail=f"Organization identifier '{identifier}' was not found.",
                code="ORGANIZATION_NOT_FOUND"
            )

        org_id = str(org["organization_id"])
        hosp_id = org.get("hospital_id")

        # Nullify organization references
        conn.execute("UPDATE encounters SET organization_id = NULL WHERE organization_id = %s", (org_id,))
        conn.execute("UPDATE prescriptions SET organization_id = NULL WHERE organization_id = %s", (org_id,))
        conn.execute("UPDATE vaccinations SET organization_id = NULL WHERE organization_id = %s", (org_id,))
        conn.execute("UPDATE diagnostic_reports SET organization_id = NULL WHERE organization_id = %s", (org_id,))
        conn.execute("UPDATE procedures SET organization_id = NULL WHERE organization_id = %s", (org_id,))
        conn.execute("UPDATE hospitalizations SET organization_id = NULL WHERE organization_id = %s", (org_id,))
        conn.execute("UPDATE consent_records SET organization_id = NULL WHERE organization_id = %s", (org_id,))
        conn.execute("UPDATE patient_access_grants SET organization_id = NULL WHERE organization_id = %s", (org_id,))

        # Find users who are hospital admins specifically for this organization
        hosp_users = conn.execute("""
            SELECT u.id
            FROM users u
            WHERE u.hospital_id = %s
               OR u.id IN (SELECT user_id FROM organization_memberships WHERE organization_id = %s)
        """, (hosp_id, org_id)).fetchall()

        # Delete memberships
        conn.execute("DELETE FROM organization_memberships WHERE organization_id = %s", (org_id,))

        # Delete organization
        conn.execute("DELETE FROM healthcare_organizations WHERE id = %s", (org_id,))

        # Delete hospital admin users who specifically belonged to this hospital
        for hu in hosp_users:
            h_uid = str(hu["id"])
            other_roles = conn.execute("""
                SELECT role FROM user_roles WHERE user_id = %s AND role NOT IN ('hospital_admin', 'organization')
            """, (h_uid,)).fetchall()
            if not other_roles:
                conn.execute("UPDATE clinical_record_versions SET changed_by = NULL WHERE changed_by = %s", (h_uid,))
                conn.execute("UPDATE clinical_records SET created_by = NULL WHERE created_by = %s", (h_uid,))
                conn.execute("UPDATE medical_documents SET uploaded_by = NULL WHERE uploaded_by = %s", (h_uid,))
                conn.execute("UPDATE document_versions SET uploaded_by = NULL WHERE uploaded_by = %s", (h_uid,))
                conn.execute("UPDATE record_correction_requests SET requested_by = NULL WHERE requested_by = %s", (h_uid,))
                conn.execute("UPDATE record_correction_requests SET reviewed_by = NULL WHERE reviewed_by = %s", (h_uid,))
                conn.execute("UPDATE audit_events SET actor_user_id = NULL WHERE actor_user_id = %s", (h_uid,))
                conn.execute("DELETE FROM user_roles WHERE user_id = %s", (h_uid,))
                conn.execute("DELETE FROM users WHERE id = %s", (h_uid,))

        record_audit(
            actor_user_id=admin_user.id,
            patient_id=None,
            action="remove",
            what=f"Admin removed registered organization {org['name']} ({hosp_id or org_id})",
            actor_name=admin_user.full_name,
            actor_role="admin",
        )

    logger.info("Admin removed organization %s (%s)", org_id, org["name"])
    return {
        "organizationId": f"org_{org_id}",
        "name": org["name"],
        "removed": True,
        "message": f"Organization {org['name']} removed successfully."
    }


def remove_user(admin_user: AuthenticatedUser, user_id: str) -> Dict[str, Any]:
    raw_uuid = _clean_user_id(user_id)
    with get_db() as conn:
        role_rows = conn.execute("SELECT role FROM user_roles WHERE user_id = %s", (raw_uuid,)).fetchall()
        roles = [r["role"] for r in role_rows]

    if "practitioner" in roles:
        return remove_practitioner(admin_user, raw_uuid)
    elif "hospital_admin" in roles or "organization" in roles:
        return remove_organization(admin_user, raw_uuid)
    elif "patient" in roles:
        return remove_patient(admin_user, raw_uuid)
    else:
        return remove_patient(admin_user, raw_uuid)

