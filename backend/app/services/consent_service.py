from datetime import datetime, timedelta, timezone
import uuid
from typing import Any, Dict, List, Optional
from fastapi import status
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import normalize_mediclaim_id, format_mediclaim_id, AuthenticatedUser
from app.services.audit_service import record_audit


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _format_iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _format_date(dt: Any) -> str:
    if not dt:
        return ""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return str(dt)


def create_access_request(doctor_user: AuthenticatedUser, payload) -> Dict[str, Any]:
    clean_med_id = normalize_mediclaim_id(payload.patientMediclaimId)
    now = _now_utc()
    req_expires = now + timedelta(hours=24)
    raw_doc_id = doctor_user.raw_uuid

    with get_db() as conn:
        patient = conn.execute("""
            SELECT p.id AS patient_id, u.id AS user_id
            FROM users u
            JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.mediclaim_id = %s OR u.public_id = %s
        """, (clean_med_id, clean_med_id)).fetchone()

        if not patient:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Patient Not Found",
                detail=f"No patient registered with Mediclaim ID {payload.patientMediclaimId}.",
                code="RECORD_NOT_FOUND"
            )

        grant_uuid = uuid.uuid4()
        grant_id = f"grt_{grant_uuid}"
        req_id = f"req_{grant_uuid}"

        doctor_role = "Practitioner"
        if doctor_user.practitioner_profile_id:
            doc_profile = conn.execute(
                "SELECT specialization FROM practitioner_profiles WHERE id = %s",
                (doctor_user.practitioner_profile_id,)
            ).fetchone()
            if doc_profile and doc_profile.get("specialization"):
                doctor_role = doc_profile["specialization"]

        conn.execute("""
            INSERT INTO patient_access_grants (
                id, patient_id, grantee_user_id, granted_by, purpose,
                status, valid_from, expires_at, grantee_name, grantee_role,
                duration_hours, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                'pending', %s, %s, %s, %s,
                %s, now()
            )
        """, (
            str(grant_uuid), str(patient["patient_id"]), raw_doc_id, str(patient["user_id"]),
            payload.purpose, now, req_expires, doctor_user.full_name, doctor_role,
            payload.durationHours
        ))

        # Insert requested scopes
        for scope_item in payload.scope:
            conn.execute("""
                INSERT INTO access_grant_scopes (id, access_grant_id, record_type, permission)
                VALUES (gen_random_uuid(), %s, %s, 'read')
                ON CONFLICT DO NOTHING
            """, (str(grant_uuid), scope_item))

    return {
        "requestId": req_id,
        "patientMediclaimId": format_mediclaim_id(clean_med_id),
        "expiresAt": _format_iso(req_expires)
    }


def list_access_requests(patient_profile_id: str, status_filter: str = "pending") -> List[Dict[str, Any]]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT g.*,
                   COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{}') AS scopes
            FROM patient_access_grants g
            LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
            WHERE g.patient_id = %s AND g.status = %s
            GROUP BY g.id
            ORDER BY g.created_at DESC
        """, (raw_pat_id, status_filter)).fetchall()

    requests = []
    for r in rows:
        requests.append({
            "id": f"req_{r['id']}",
            "name": r.get("grantee_name") or "Practitioner",
            "role": r.get("grantee_role") or "Doctor",
            "scope": r.get("scopes") or ["allergy", "medication"],
            "durationHours": r.get("duration_hours") or 2,
            "purpose": r.get("purpose") or "Clinical Consultation",
            "status": r["status"],
            "requestedAt": _format_iso(r["created_at"])
        })
    return requests


def approve_access_request(patient_profile_id: str, request_id: str, payload) -> Dict[str, Any]:
    raw_req_id = request_id.replace("req-", "").replace("req_", "").replace("grt-", "").replace("grt_", "")
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    now = _now_utc()
    expires = now + timedelta(hours=payload.durationHours)

    with get_db() as conn:
        grant = conn.execute("""
            SELECT * FROM patient_access_grants
            WHERE id::text = %s AND patient_id = %s
        """, (raw_req_id, raw_pat_id)).fetchone()

        if not grant:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Request Not Found",
                detail=f"Access request '{request_id}' not found.",
                code="RECORD_NOT_FOUND"
            )

        conn.execute("""
            UPDATE patient_access_grants
            SET status = 'active',
                valid_from = %s,
                expires_at = %s,
                duration_hours = %s
            WHERE id = %s
        """, (now, expires, payload.durationHours, raw_req_id))

        # Re-set approved scopes
        conn.execute("DELETE FROM access_grant_scopes WHERE access_grant_id = %s", (raw_req_id,))
        for sc in payload.approvedScope:
            conn.execute("""
                INSERT INTO access_grant_scopes (id, access_grant_id, record_type, permission)
                VALUES (gen_random_uuid(), %s, %s, 'read')
            """, (raw_req_id, sc))

    return {
        "id": f"grt_{raw_req_id}",
        "grantId": f"grt_{raw_req_id}",
        "grantStatus": "active",
        "name": grant.get("grantee_name") or "Doctor",
        "role": grant.get("grantee_role") or "Practitioner",
        "scope": payload.approvedScope,
        "validFrom": _format_iso(now),
        "expiresAt": _format_iso(expires)
    }


def decline_access_request(patient_profile_id: str, request_id: str) -> None:
    raw_req_id = request_id.replace("req-", "").replace("req_", "").replace("grt-", "").replace("grt_", "")
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")

    with get_db() as conn:
        res = conn.execute("""
            UPDATE patient_access_grants
            SET status = 'revoked', deleted_at = now()
            WHERE id::text = %s AND patient_id = %s
        """, (raw_req_id, raw_pat_id))
        if res.rowcount == 0:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Request Not Found",
                detail=f"Access request '{request_id}' not found.",
                code="RECORD_NOT_FOUND"
            )


def list_access_grants(patient_profile_id: str, status_filter: Optional[str] = "active") -> List[Dict[str, Any]]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    now = _now_utc()

    with get_db() as conn:
        # Check and update expired grants automatically
        conn.execute("""
            UPDATE patient_access_grants
            SET status = 'expired'
            WHERE patient_id = %s AND status = 'active' AND expires_at < %s
        """, (raw_pat_id, now))

        clean_status = (status_filter or "active").lower()
        if clean_status == "all":
            where_status = "g.status IN ('active', 'expired', 'revoked')"
            params: List[Any] = [raw_pat_id]
        elif clean_status == "active":
            where_status = "g.status = 'active' AND g.expires_at >= %s"
            params = [raw_pat_id, now]
        else:
            where_status = "g.status = %s"
            params = [raw_pat_id, clean_status]

        rows = conn.execute(f"""
            SELECT g.*,
                   COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{{}}') AS scopes
            FROM patient_access_grants g
            LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
            WHERE g.patient_id = %s AND {where_status}
            GROUP BY g.id
            ORDER BY g.created_at DESC
        """, tuple(params)).fetchall()

    grants = []
    for r in rows:
        grants.append({
            "id": f"grt_{r['id']}",
            "grantId": f"grt_{r['id']}",
            "name": r.get("grantee_name") or "Practitioner",
            "role": r.get("grantee_role") or "Practitioner",
            "scope": r.get("scopes") or [],
            "validFrom": _format_iso(r.get("valid_from")),
            "expiresAt": _format_iso(r.get("expires_at")) or _format_iso(now),
            "grantStatus": r["status"]
        })
    return grants


def directly_give_access(patient_profile_id: str, user_id: str, payload) -> Dict[str, Any]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    now = _now_utc()
    expires = now + timedelta(hours=payload.durationHours)
    grant_uuid = uuid.uuid4()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO patient_access_grants (
                id, patient_id, granted_by, purpose, status, valid_from,
                expires_at, grantee_name, grantee_role, duration_hours, created_at
            ) VALUES (
                %s, %s, %s, 'Direct Patient Authorized Access', 'active', %s,
                %s, %s, %s, %s, now()
            )
        """, (
            str(grant_uuid), raw_pat_id, raw_user_id, now, expires,
            payload.name, payload.role or "Practitioner", payload.durationHours
        ))

        for sc in payload.scope:
            conn.execute("""
                INSERT INTO access_grant_scopes (id, access_grant_id, record_type, permission)
                VALUES (gen_random_uuid(), %s, %s, 'read')
            """, (str(grant_uuid), sc))

    return {
        "id": f"grt_{grant_uuid}",
        "grantId": f"grt_{grant_uuid}",
        "name": payload.name,
        "role": payload.role or "Practitioner",
        "scope": payload.scope,
        "validFrom": _format_iso(now),
        "expiresAt": _format_iso(expires),
        "grantStatus": "active"
    }


def revoke_access_grant(patient_profile_id: str, grant_id: str) -> None:
    raw_grant_id = (
        grant_id.replace("grt-", "")
        .replace("grt_", "")
        .replace("req-", "")
        .replace("req_", "")
    )
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")

    with get_db() as conn:
        grant = conn.execute("""
            SELECT id, grantee_name, grantee_role, status
            FROM patient_access_grants
            WHERE id::text = %s AND patient_id = %s
        """, (raw_grant_id, raw_pat_id)).fetchone()

        if not grant:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Grant Not Found",
                detail=f"Access grant '{grant_id}' not found.",
                code="RECORD_NOT_FOUND"
            )

        conn.execute("""
            UPDATE patient_access_grants
            SET status = 'revoked', revoked_at = now()
            WHERE id::text = %s AND patient_id = %s
        """, (raw_grant_id, raw_pat_id))

    grantee_name = grant["grantee_name"] if grant and grant.get("grantee_name") else "Doctor"
    record_audit(
        patient_profile_id=raw_pat_id,
        actor_name="Patient",
        actor_role="patient",
        action="revoke",
        description=f"Revoked access grant for {grantee_name}",
        meta={"grantId": f"grt_{raw_grant_id}"}
    )


# --- Caregiver Management ---
def list_caregivers(patient_profile_id: str) -> List[Dict[str, Any]]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, name, relation, scope, since
            FROM patient_caregivers
            WHERE patient_id = %s AND deleted_at IS NULL
            ORDER BY created_at DESC
        """, (raw_pat_id,)).fetchall()

    caregivers = []
    for r in rows:
        caregivers.append({
            "id": f"cg_{r['id']}",
            "name": r["name"],
            "relation": r["relation"],
            "scope": r.get("scope") or [],
            "since": _format_date(r["since"])
        })
    return caregivers


def add_caregiver(patient_profile_id: str, payload) -> Dict[str, Any]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    cg_uuid = uuid.uuid4()
    now_date = datetime.now(timezone.utc).date()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO patient_caregivers (
                id, patient_id, name, relation, scope, since, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, now()
            )
        """, (
            str(cg_uuid), raw_pat_id, payload.name, payload.relation,
            payload.scope, now_date
        ))

    return {
        "id": f"cg_{cg_uuid}",
        "name": payload.name,
        "relation": payload.relation,
        "scope": payload.scope,
        "since": _format_date(now_date)
    }


def remove_caregiver(patient_profile_id: str, caregiver_id: str) -> None:
    raw_cg_id = caregiver_id.replace("cg-", "").replace("cg_", "")
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")

    with get_db() as conn:
        res = conn.execute("""
            UPDATE patient_caregivers
            SET deleted_at = now()
            WHERE id::text = %s AND patient_id = %s
        """, (raw_cg_id, raw_pat_id))

        if res.rowcount == 0:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Caregiver Not Found",
                detail=f"Caregiver '{caregiver_id}' not found.",
                code="RECORD_NOT_FOUND"
            )


# --- Doctor Scoped Patient Access ---
def doctor_access_patient(doctor_user: AuthenticatedUser, mediclaim_id: str, requested_kind: Optional[str] = None) -> Dict[str, Any]:
    clean_med_id = normalize_mediclaim_id(mediclaim_id)
    now = _now_utc()
    raw_doc_id = doctor_user.raw_uuid

    with get_db() as conn:
        patient = conn.execute("""
            SELECT p.id AS patient_profile_id, u.full_name, p.date_of_birth, p.gender, p.blood_group
            FROM users u
            JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.mediclaim_id = %s OR u.public_id = %s
        """, (clean_med_id, clean_med_id)).fetchone()

        if not patient:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Patient Not Found",
                detail=f"No patient registered with Mediclaim ID {mediclaim_id}.",
                code="RECORD_NOT_FOUND"
            )

        pat_profile_id = str(patient["patient_profile_id"])

        # Check for active grant
        grant = conn.execute("""
            SELECT g.id, g.expires_at,
                   COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{}') AS scopes
            FROM patient_access_grants g
            LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
            WHERE g.patient_id = %s
              AND (g.grantee_user_id = %s OR g.organization_id IN (
                  SELECT organization_id FROM organization_memberships WHERE user_id = %s AND is_active = true
              ))
              AND g.status = 'active' AND g.expires_at >= %s
            GROUP BY g.id, g.expires_at
            LIMIT 1
        """, (pat_profile_id, raw_doc_id, raw_doc_id, now)).fetchone()

        # If not matched by grantee_user_id, check if doctor's token has active_grant_id
        if not grant and doctor_user.active_grant_id:
            raw_grt = doctor_user.active_grant_id.replace("grt_", "").replace("grt-", "")
            grant = conn.execute("""
                SELECT g.id, g.expires_at,
                       COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{}') AS scopes
                FROM patient_access_grants g
                LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
                WHERE g.id::text = %s AND g.patient_id = %s
                  AND g.status = 'active' AND g.expires_at >= %s
                GROUP BY g.id, g.expires_at
            """, (raw_grt, pat_profile_id, now)).fetchone()

        if not grant and doctor_user.has_role("admin"):
            grant = {
                "id": str(uuid.uuid4()),
                "expires_at": now + timedelta(days=365),
                "scopes": ["all", "allergy", "condition", "medication", "vaccination", "report"],
            }

        if not grant:
            raise APIProblemException(
                status_code=status.HTTP_403_FORBIDDEN,
                title="Access Denied",
                detail="No active authorization exists to access this patient's medical records.",
                code="CONSENT_EXPIRED"
            )

        approved_scopes = grant.get("scopes") or []

        # If doctor explicitly queried an unapproved scope
        if requested_kind and requested_kind not in ("document", "documents") and "all" not in approved_scopes and requested_kind not in approved_scopes:
            raise APIProblemException(
                status_code=status.HTTP_403_FORBIDDEN,
                title="Scope Unauthorized",
                detail=f"Patient has not consented to share '{requested_kind}' records. Approved scopes: {', '.join(approved_scopes)}.",
                code="SCOPE_UNAUTHORIZED"
            )

        # Retrieve all uploaded medical documents for this patient
        raw_pat_id = pat_profile_id.replace("pat-", "").replace("pat_", "")
        docs_rows = conn.execute("""
            SELECT id, public_id, title, original_filename, document_type, mime_type,
                   file_size_bytes, document_date, ocr_status, created_at
            FROM medical_documents
            WHERE patient_id = %s AND deleted_at IS NULL
            ORDER BY created_at DESC
        """, (raw_pat_id,)).fetchall()

    documents = []
    for d in docs_rows:
        doc_id_str = str(d["id"])
        mime = (d.get("mime_type") or "application/pdf").lower()
        documents.append({
            "id": f"doc_{doc_id_str}",
            "documentId": f"doc_{doc_id_str}",
            "title": d.get("title") or d.get("original_filename") or "Medical Document",
            "fileName": d.get("original_filename") or "document.pdf",
            "fileType": "pdf" if "pdf" in mime else "image",
            "fileSizeBytes": d.get("file_size_bytes"),
            "fileUrl": f"/api/v1/documents/doc_{doc_id_str}/content",
            "documentType": d.get("document_type") or "other",
            "date": _format_date(d.get("document_date") or d.get("created_at")),
            "createdAt": _format_iso(d.get("created_at")),
            "ocrStatus": d.get("ocr_status") or "completed",
        })

    from app.services.records_service import list_patient_records
    # Retrieve records restricted to approved scopes
    all_scoped_records = []
    if requested_kind in ("document", "documents"):
        all_scoped_records = []
    elif "all" in approved_scopes and not requested_kind:
        res = list_patient_records(patient_profile_id=pat_profile_id, kind=None)
        all_scoped_records = res["records"]
    else:
        for sc in (approved_scopes if not requested_kind else [requested_kind]):
            res = list_patient_records(patient_profile_id=pat_profile_id, kind=sc)
            all_scoped_records.extend(res["records"])

    return {
        "patient": {
            "fullName": patient["full_name"],
            "mediclaimId": format_mediclaim_id(clean_med_id),
            "dateOfBirth": _format_date(patient["date_of_birth"]),
            "gender": patient["gender"],
            "bloodGroup": patient["blood_group"],
        },
        "approvedScopes": approved_scopes,
        "expiresAt": _format_iso(grant["expires_at"]),
        "records": all_scoped_records,
        "documents": documents,
    }
