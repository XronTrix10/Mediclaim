from datetime import datetime, timezone, timedelta
import logging
import secrets
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import status
from app.config import OTP_SECONDS, OTP_DEBUG, ACCESS_TOKEN_SECONDS
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import (
    AuthenticatedUser, format_mediclaim_id, normalize_mediclaim_id,
    hash_password, verify_password, generate_otp, hash_otp, verify_otp,
    generate_mediclaim_id, create_access_token,
    generate_doctor_id, normalize_doctor_id
)
from app.services.audit_service import record_audit
from app.schemas.records import KindType, MedicationItem

logger = logging.getLogger("mediclaim.doctor")

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _mask_phone(phone: str) -> str:
    clean = phone.strip()
    if len(clean) >= 8:
        return f"{clean[:3]} XXXXX {clean[-5:]}"
    return clean

def _format_iso(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(dt)

def _format_date(dt: Any) -> str:
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return str(dt)

def _new_public_id(prefix: str = "doc") -> str:
    rand = secrets.token_hex(6)
    return rand[:12]

def _get_unique_doctor_id(conn) -> str:
    for _ in range(50):
        candidate = generate_doctor_id()
        exists = conn.execute(
            "SELECT 1 FROM users WHERE doctor_id = %s UNION SELECT 1 FROM practitioner_profiles WHERE doctor_id = %s",
            (candidate, candidate)
        ).fetchone()
        if not exists:
            return candidate
    return f"DR-{secrets.randbelow(90000) + 10000}"

def ensure_practitioner_profile(doctor_user: AuthenticatedUser) -> str:
    """Ensures a practitioner_profiles row exists for doctor_user and returns its id."""
    raw_user_id = doctor_user.raw_uuid
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id, doctor_id FROM practitioner_profiles WHERE user_id = %s",
            (raw_user_id,)
        ).fetchone()
        if existing:
            if not existing["doctor_id"]:
                doc_id = _get_unique_doctor_id(conn)
                conn.execute(
                    "UPDATE practitioner_profiles SET doctor_id = %s WHERE id = %s",
                    (doc_id, str(existing["id"]))
                )
                conn.execute(
                    "UPDATE users SET doctor_id = %s WHERE id = %s AND doctor_id IS NULL",
                    (doc_id, raw_user_id)
                )
            return str(existing["id"])

        # Auto-provision baseline practitioner profile
        doc_uuid = uuid.uuid4()
        public_id = _new_public_id("doc")
        reg_no = f"MCI-{secrets.randbelow(900000) + 100000}"
        doc_id = _get_unique_doctor_id(conn)

        conn.execute("""
            INSERT INTO practitioner_profiles (
                id, public_id, doctor_id, user_id, registration_number, specialization,
                qualification, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, 'General Medicine',
                'MBBS', now()
            )
        """, (str(doc_uuid), public_id, doc_id, raw_user_id, reg_no))

        conn.execute(
            "UPDATE users SET doctor_id = %s WHERE id = %s AND doctor_id IS NULL",
            (doc_id, raw_user_id)
        )

    return str(doc_uuid)

def list_doctor_patients(doctor_user: AuthenticatedUser) -> List[Dict[str, Any]]:
    now = _now_utc()
    raw_doc_id = doctor_user.raw_uuid

    with get_db() as conn:
        if doctor_user.has_role("admin"):
            where_clause = "g.status = 'active' AND g.expires_at >= %s"
            params: List[Any] = [now]
        elif doctor_user.has_role("hospital_admin", "organization"):
            where_clause = """
                (g.organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = %s AND is_active = true)
                 OR g.grantee_user_id = %s)
                AND g.status = 'active' AND g.expires_at >= %s
            """
            params = [raw_doc_id, raw_doc_id, now]
        else:
            where_clause = """
                (g.grantee_user_id = %s
                 OR g.organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = %s AND is_active = true))
                AND g.status = 'active' AND g.expires_at >= %s
            """
            params = [raw_doc_id, raw_doc_id, now]

        rows = conn.execute(f"""
            SELECT g.id AS grant_id, g.expires_at,
                   p.id AS patient_profile_id, p.date_of_birth, p.gender, p.blood_group,
                   u.mediclaim_id, u.full_name,
                   COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{{}}') AS scopes
            FROM patient_access_grants g
            JOIN patient_profiles p ON p.id = g.patient_id
            JOIN users u ON u.id = p.user_id
            LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
            WHERE {where_clause}
            GROUP BY g.id, g.expires_at, p.id, p.date_of_birth, p.gender, p.blood_group, u.mediclaim_id, u.full_name
            ORDER BY g.expires_at DESC
        """, tuple(params)).fetchall()

    result = []
    for r in rows:
        result.append({
            "patientProfileId": f"pat_{r['patient_profile_id']}",
            "mediclaimId": format_mediclaim_id(r["mediclaim_id"] or ""),
            "fullName": r["full_name"],
            "gender": r["gender"],
            "dateOfBirth": _format_date(r["date_of_birth"]),
            "bloodGroup": r["blood_group"],
            "grantId": f"grt_{r['grant_id']}",
            "approvedScopes": r["scopes"] or [],
            "expiresAt": _format_iso(r["expires_at"]),
        })

    return result

def list_doctor_requests(doctor_user: AuthenticatedUser, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    raw_doc_id = doctor_user.raw_uuid
    params: List[Any] = []

    if doctor_user.has_role("admin"):
        where_clause = "1=1"
    elif doctor_user.has_role("hospital_admin", "organization"):
        where_clause = "(g.organization_id IN (SELECT organization_id FROM organization_memberships WHERE user_id = %s AND is_active = true) OR g.grantee_user_id = %s)"
        params.extend([raw_doc_id, raw_doc_id])
    else:
        where_clause = "g.grantee_user_id = %s"
        params.append(raw_doc_id)

    sql = f"""
        SELECT g.id, g.status, g.duration_hours, g.purpose, g.created_at, g.expires_at,
               u.mediclaim_id, u.full_name,
               COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{{}}') AS scopes
        FROM patient_access_grants g
        JOIN patient_profiles p ON p.id = g.patient_id
        JOIN users u ON u.id = p.user_id
        LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
        WHERE {where_clause}
    """

    if status_filter and status_filter.lower() != "all":
        sql += " AND g.status = %s"
        params.append(status_filter.lower())

    sql += " GROUP BY g.id, g.status, g.duration_hours, g.purpose, g.created_at, g.expires_at, u.mediclaim_id, u.full_name ORDER BY g.created_at DESC"

    with get_db() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()

    requests = []
    for r in rows:
        requests.append({
            "id": f"req_{r['id']}",
            "patientMediclaimId": format_mediclaim_id(r["mediclaim_id"] or ""),
            "patientFullName": r["full_name"],
            "scope": r["scopes"] or [],
            "durationHours": r["duration_hours"] or 1,
            "purpose": r["purpose"],
            "status": r["status"],
            "requestedAt": _format_iso(r["created_at"]),
            "expiresAt": _format_iso(r["expires_at"]),
        })

    return requests

def _verify_doctor_consent_and_scope(
    doctor_user: AuthenticatedUser,
    mediclaim_id: str,
    required_scope: Optional[str] = None,
) -> Dict[str, Any]:
    clean_med_id = normalize_mediclaim_id(mediclaim_id)
    now = _now_utc()
    raw_doc_id = doctor_user.raw_uuid

    with get_db() as conn:
        patient = conn.execute("""
            SELECT p.id AS patient_profile_id, p.user_id, u.full_name, u.mediclaim_id
            FROM users u
            JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.mediclaim_id = %s OR u.public_id = %s
        """, (clean_med_id, clean_med_id)).fetchone()

        if not patient:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Patient Not Found",
                detail=f"No patient registered with Mediclaim ID {mediclaim_id}.",
                code="RECORD_NOT_FOUND",
            )

        pat_profile_id = str(patient["patient_profile_id"])

        grant = conn.execute("""
            SELECT g.id, g.status, g.expires_at, g.organization_id,
                   COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{}') AS scopes
            FROM patient_access_grants g
            LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
            WHERE g.patient_id = %s
              AND (g.grantee_user_id = %s OR g.organization_id IN (
                  SELECT organization_id FROM organization_memberships WHERE user_id = %s AND is_active = true
              ))
            GROUP BY g.id, g.status, g.expires_at, g.organization_id
            ORDER BY g.created_at DESC
            LIMIT 1
        """, (pat_profile_id, raw_doc_id, raw_doc_id)).fetchone()

        # If not found directly, check active_grant_id from doctor token if present
        if not grant and doctor_user.active_grant_id:
            raw_grt = doctor_user.active_grant_id.replace("grt_", "").replace("grt-", "")
            grant = conn.execute("""
                SELECT g.id, g.status, g.expires_at, g.organization_id,
                       COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{}') AS scopes
                FROM patient_access_grants g
                LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
                WHERE g.id::text = %s AND g.patient_id = %s
                GROUP BY g.id, g.status, g.expires_at, g.organization_id
                LIMIT 1
            """, (raw_grt, pat_profile_id)).fetchone()

        # System administrator bypass
        if not grant and doctor_user.has_role("admin"):
            grant = {
                "id": str(uuid.uuid4()),
                "status": "active",
                "expires_at": now + timedelta(days=365),
                "organization_id": None,
                "scopes": ["all", "allergy", "condition", "medication", "vaccination", "report"],
            }

        if not grant:
            raise APIProblemException(
                status_code=status.HTTP_403_FORBIDDEN,
                title="Access Denied",
                detail="No active authorization exists to access or write records for this patient.",
                code="CONSENT_EXPIRED",
            )

        if grant["status"] == "revoked":
            raise APIProblemException(
                status_code=status.HTTP_403_FORBIDDEN,
                title="Consent Revoked",
                detail="Authorization grant for this patient was revoked.",
                code="CONSENT_REVOKED",
            )

        exp = grant.get("expires_at")
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        if grant["status"] != "active" or (exp and exp < now):
            raise APIProblemException(
                status_code=status.HTTP_403_FORBIDDEN,
                title="Consent Expired",
                detail="The doctor access authorization session for this patient has expired.",
                code="CONSENT_EXPIRED",
            )

        approved_scopes = grant.get("scopes") or []
        if required_scope and ("all" not in approved_scopes and required_scope not in approved_scopes):
            raise APIProblemException(
                status_code=status.HTTP_403_FORBIDDEN,
                title="Scope Unauthorized",
                detail=f"Patient has not consented to '{required_scope}' records. Approved scopes: {', '.join(approved_scopes)}.",
                code="SCOPE_UNAUTHORIZED",
            )

    practitioner_id = ensure_practitioner_profile(doctor_user)

    return {
        "patientProfileId": pat_profile_id,
        "patientUserId": str(patient["user_id"]),
        "patientFullName": patient["full_name"],
        "mediclaimId": patient["mediclaim_id"],
        "grantId": str(grant["id"]),
        "organizationId": str(grant["organization_id"]) if grant.get("organization_id") else None,
        "practitionerId": practitioner_id,
        "approvedScopes": approved_scopes,
    }

def record_encounter(
    doctor_user: AuthenticatedUser,
    mediclaim_id: str,
    payload,
) -> Dict[str, Any]:
    ctx = _verify_doctor_consent_and_scope(doctor_user, mediclaim_id, required_scope=None)
    enc_uuid = uuid.uuid4()
    public_id = _new_public_id("enc")
    now = _now_utc()
    start_time = datetime.fromisoformat(payload.startTime.replace("Z", "+00:00")) if payload.startTime else now
    end_time = datetime.fromisoformat(payload.endTime.replace("Z", "+00:00")) if payload.endTime else now

    with get_db() as conn:
        conn.execute("""
            INSERT INTO encounters (
                id, public_id, patient_id, practitioner_id, organization_id,
                encounter_type, start_time, end_time, reason, diagnosis_summary,
                status, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, now()
            )
        """, (
            str(enc_uuid), public_id, ctx["patientProfileId"], ctx["practitionerId"],
            ctx["organizationId"], payload.encounterType, start_time, end_time,
            payload.reason, payload.diagnosisSummary, payload.status
        ))

        # Also insert clinical record entry
        rec_uuid = uuid.uuid4()
        conn.execute("""
            INSERT INTO clinical_records (
                id, public_id, patient_id, encounter_id, created_by, record_type,
                title, status, description, recorded_at, created_at, updated_at,
                source, provider, fhir_resource_type, fhir_resource_id
            ) VALUES (
                %s, %s, %s, %s, %s, 'condition',
                %s, 'active', %s, %s, now(), now(),
                'practitioner', %s, 'Encounter', %s
            )
        """, (
            str(rec_uuid), _new_public_id("rec"), ctx["patientProfileId"], str(enc_uuid),
            doctor_user.raw_uuid, payload.diagnosisSummary or f"{payload.encounterType.title()} Encounter",
            payload.reason, start_time, doctor_user.full_name, f"enc-{str(enc_uuid)[:8]}"
        ))

    record_audit(
        actor_user_id=doctor_user.raw_uuid,
        patient_id=ctx["patientProfileId"],
        action="create_encounter",
        what=f"Recorded {payload.encounterType} encounter: {payload.reason}",
        actor_name=doctor_user.full_name,
        actor_role="doctor",
        resource_kinds=["encounter"],
        outcome="success",
        resource_table="encounters",
        resource_id=str(enc_uuid),
    )

    return {
        "id": f"enc_{enc_uuid}",
        "publicId": public_id,
        "encounterType": payload.encounterType,
        "reason": payload.reason,
        "diagnosisSummary": payload.diagnosisSummary,
        "startTime": _format_iso(start_time),
        "endTime": _format_iso(end_time),
        "status": payload.status,
        "practitioner": doctor_user.full_name,
    }

def record_condition(
    doctor_user: AuthenticatedUser,
    mediclaim_id: str,
    payload,
) -> Dict[str, Any]:
    ctx = _verify_doctor_consent_and_scope(doctor_user, mediclaim_id, required_scope="condition")
    rec_uuid = uuid.uuid4()
    public_id = _new_public_id("rec")
    onset = payload.onsetDate or _now_utc().date()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO clinical_records (
                id, public_id, patient_id, created_by, record_type, title,
                status, description, recorded_at, created_at, updated_at,
                source, provider, fhir_resource_type, fhir_resource_id
            ) VALUES (
                %s, %s, %s, %s, 'condition', %s,
                %s, %s, %s, now(), now(),
                'practitioner', %s, 'Condition', %s
            )
        """, (
            str(rec_uuid), public_id, ctx["patientProfileId"], doctor_user.raw_uuid,
            payload.conditionName, payload.status, payload.notes or payload.conditionName,
            onset, doctor_user.full_name, f"cond-{str(rec_uuid)[:8]}"
        ))

        conn.execute("""
            INSERT INTO conditions (
                id, patient_id, clinical_record_id, condition_name, severity,
                status, onset_date, resolved_date, notes, created_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s,
                %s, %s, %s, %s, now()
            )
        """, (
            ctx["patientProfileId"], str(rec_uuid), payload.conditionName, payload.severity,
            payload.status, onset, payload.resolvedDate, payload.notes
        ))

    record_audit(
        actor_user_id=doctor_user.raw_uuid,
        patient_id=ctx["patientProfileId"],
        action="create_condition",
        what=f"Diagnosed condition: {payload.conditionName}",
        actor_name=doctor_user.full_name,
        actor_role="doctor",
        resource_kinds=["condition"],
        outcome="success",
        resource_table="conditions",
        resource_id=str(rec_uuid),
    )

    return {
        "id": f"rec_{rec_uuid}",
        "kind": "condition",
        "title": payload.conditionName,
        "severity": payload.severity,
        "status": payload.status,
        "date": _format_date(onset),
        "provider": doctor_user.full_name,
        "fhirId": f"Condition/cond-{str(rec_uuid)[:8]}",
    }

def record_prescription(
    doctor_user: AuthenticatedUser,
    mediclaim_id: str,
    payload,
) -> Dict[str, Any]:
    ctx = _verify_doctor_consent_and_scope(doctor_user, mediclaim_id, required_scope="medication")
    rx_uuid = uuid.uuid4()
    public_id = _new_public_id("rx")
    prescribed_date = payload.date or _now_utc().date()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO prescriptions (
                id, public_id, patient_id, practitioner_id, organization_id,
                prescribed_at, status, instructions, title, doctor_name,
                file_type, file_name, file_size_bytes, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, 'active', %s, %s, %s,
                'pdf', %s, 102400, now()
            )
        """, (
            str(rx_uuid), public_id, ctx["patientProfileId"], ctx["practitionerId"],
            ctx["organizationId"], prescribed_date, payload.instructions,
            payload.title, doctor_user.full_name, f"rx_{str(rx_uuid)[:8]}.pdf"
        ))

        for med in payload.medications:
            conn.execute("""
                INSERT INTO prescription_items (
                    id, patient_id, prescription_id, medication_name, dosage,
                    frequency, duration, instructions
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s, %s,
                    %s, %s, %s
                )
            """, (
                ctx["patientProfileId"], str(rx_uuid), med.name, med.dosage,
                med.frequency, med.duration, med.instructions
            ))

        # Insert into clinical_records for timeline
        rec_uuid = uuid.uuid4()
        conn.execute("""
            INSERT INTO clinical_records (
                id, public_id, patient_id, created_by, record_type, title,
                status, description, recorded_at, created_at, updated_at,
                source, provider, fhir_resource_type, fhir_resource_id
            ) VALUES (
                %s, %s, %s, %s, 'medication', %s,
                'active', %s, %s, now(), now(),
                'practitioner', %s, 'MedicationStatement', %s
            )
        """, (
            str(rec_uuid), _new_public_id("rec"), ctx["patientProfileId"], doctor_user.raw_uuid,
            payload.title, payload.instructions or "Prescription", prescribed_date,
            doctor_user.full_name, f"med-{str(rx_uuid)[:8]}"
        ))

    record_audit(
        actor_user_id=doctor_user.raw_uuid,
        patient_id=ctx["patientProfileId"],
        action="create_prescription",
        what=f"Issued prescription: {payload.title}",
        actor_name=doctor_user.full_name,
        actor_role="doctor",
        resource_kinds=["medication"],
        outcome="success",
        resource_table="prescriptions",
        resource_id=str(rx_uuid),
    )

    return {
        "id": f"rx_{rx_uuid}",
        "title": payload.title,
        "doctor": doctor_user.full_name,
        "date": _format_date(prescribed_date),
        "status": "active",
        "instructions": payload.instructions,
        "medications": [m.model_dump() for m in payload.medications],
    }

def record_report(
    doctor_user: AuthenticatedUser,
    mediclaim_id: str,
    payload,
) -> Dict[str, Any]:
    ctx = _verify_doctor_consent_and_scope(doctor_user, mediclaim_id, required_scope="report")
    rep_uuid = uuid.uuid4()
    public_id = _new_public_id("rep")
    rep_date = payload.reportDate or _now_utc().date()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO diagnostic_reports (
                id, public_id, patient_id, ordered_by, organization_id,
                report_name, report_type, report_date, status, conclusion, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, now()
            )
        """, (
            str(rep_uuid), public_id, ctx["patientProfileId"], ctx["practitionerId"],
            ctx["organizationId"], payload.reportName, payload.reportType,
            rep_date, payload.status, payload.conclusion
        ))

        # Insert into clinical_records for timeline
        rec_uuid = uuid.uuid4()
        conn.execute("""
            INSERT INTO clinical_records (
                id, public_id, patient_id, created_by, record_type, title,
                status, description, recorded_at, created_at, updated_at,
                source, provider, fhir_resource_type, fhir_resource_id
            ) VALUES (
                %s, %s, %s, %s, 'report', %s,
                'active', %s, %s, now(), now(),
                'practitioner', %s, 'DiagnosticReport', %s
            )
        """, (
            str(rec_uuid), _new_public_id("rec"), ctx["patientProfileId"], doctor_user.raw_uuid,
            payload.reportName, payload.conclusion or "Diagnostic Report", rep_date,
            doctor_user.full_name, f"rep-{str(rep_uuid)[:8]}"
        ))

    record_audit(
        actor_user_id=doctor_user.raw_uuid,
        patient_id=ctx["patientProfileId"],
        action="create_report",
        what=f"Ordered diagnostic report: {payload.reportName}",
        actor_name=doctor_user.full_name,
        actor_role="doctor",
        resource_kinds=["report"],
        outcome="success",
        resource_table="diagnostic_reports",
        resource_id=str(rep_uuid),
    )

    return {
        "id": f"rep_{rep_uuid}",
        "kind": "report",
        "title": payload.reportName,
        "reportType": payload.reportType,
        "date": _format_date(rep_date),
        "status": payload.status,
        "conclusion": payload.conclusion,
        "provider": doctor_user.full_name,
        "fhirId": f"DiagnosticReport/rep-{str(rep_uuid)[:8]}",
    }

def record_vaccination(
    doctor_user: AuthenticatedUser,
    mediclaim_id: str,
    payload,
) -> Dict[str, Any]:
    ctx = _verify_doctor_consent_and_scope(doctor_user, mediclaim_id, required_scope="vaccination")
    rec_uuid = uuid.uuid4()
    vac_uuid = uuid.uuid4()
    public_id = _new_public_id("rec")
    vac_date = payload.administeredDate or _now_utc().date()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO clinical_records (
                id, public_id, patient_id, created_by, record_type, title,
                status, description, recorded_at, created_at, updated_at,
                source, provider, fhir_resource_type, fhir_resource_id
            ) VALUES (
                %s, %s, %s, %s, 'vaccination', %s,
                'active', %s, %s, now(), now(),
                'practitioner', %s, 'Immunization', %s
            )
        """, (
            str(rec_uuid), public_id, ctx["patientProfileId"], doctor_user.raw_uuid,
            payload.vaccineName, payload.notes or f"Dose {payload.doseNumber}",
            vac_date, doctor_user.full_name, f"imm-{str(rec_uuid)[:8]}"
        ))

        conn.execute("""
            INSERT INTO vaccinations (
                id, patient_id, clinical_record_id, vaccine_name, dose_number,
                administered_date, batch_number, administered_by, organization_id,
                notes, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, now()
            )
        """, (
            str(vac_uuid), ctx["patientProfileId"], str(rec_uuid), payload.vaccineName,
            payload.doseNumber, vac_date, payload.batchNumber, doctor_user.raw_uuid,
            ctx["organizationId"], payload.notes
        ))

    record_audit(
        actor_user_id=doctor_user.raw_uuid,
        patient_id=ctx["patientProfileId"],
        action="create_vaccination",
        what=f"Administered vaccination: {payload.vaccineName}",
        actor_name=doctor_user.full_name,
        actor_role="doctor",
        resource_kinds=["vaccination"],
        outcome="success",
        resource_table="vaccinations",
        resource_id=str(vac_uuid),
    )

    return {
        "id": f"rec_{rec_uuid}",
        "kind": "vaccination",
        "title": payload.vaccineName,
        "doseNumber": payload.doseNumber,
        "date": _format_date(vac_date),
        "batchNumber": payload.batchNumber,
        "status": "completed",
        "provider": doctor_user.full_name,
        "fhirId": f"Immunization/imm-{str(rec_uuid)[:8]}",
    }


def register_doctor(payload) -> Dict[str, Any]:
    with get_db() as conn:
        clean_phone = payload.phone.strip()
        clean_aadhaar = payload.aadhaarNumber.replace(" ", "").strip()

        # Check phone and aadhaar uniqueness
        dup = conn.execute(
            "SELECT phone, aadhaar_number FROM users WHERE phone = %s OR aadhaar_number = %s",
            (clean_phone, clean_aadhaar)
        ).fetchone()
        if dup:
            raise APIProblemException(
                status_code=status.HTTP_409_CONFLICT,
                title="Account Already Exists",
                detail="An account with this phone number or Aadhaar number already exists.",
                code="ACCOUNT_ALREADY_EXISTS",
            )

        # Check medical license uniqueness
        lic_dup = conn.execute(
            "SELECT id FROM practitioner_profiles WHERE registration_number = %s",
            (payload.medicalLicenseNumber.strip(),)
        ).fetchone()
        if lic_dup:
            raise APIProblemException(
                status_code=status.HTTP_409_CONFLICT,
                title="License Already Registered",
                detail=f"Medical license number '{payload.medicalLicenseNumber}' is already registered.",
                code="RECORD_CONFLICT",
            )

        # Allocate unique Doctor ID (starting with DR-XXXXX)
        doc_id = _get_unique_doctor_id(conn)

        user_uuid = uuid.uuid4()
        user_id_str = str(user_uuid)
        pub_id = secrets.token_hex(6)[:12]

        # Insert user (admin_verified=false per administrative verification workflow, mediclaim_id=null)
        conn.execute("""
            INSERT INTO users (
                id, public_id, doctor_id, full_name, phone, aadhaar_number,
                password_hash, admin_verified, profile_complete, is_active,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, false, true, true,
                now(), now()
            )
        """, (
            user_id_str, pub_id, doc_id, payload.fullName.strip(),
            clean_phone, clean_aadhaar,
            hash_password(payload.password)
        ))

        # Insert role in user_roles
        conn.execute("""
            INSERT INTO user_roles (user_id, role)
            VALUES (%s, 'practitioner')
            ON CONFLICT (user_id, role) DO NOTHING
        """, (user_id_str,))

        # Insert practitioner profile with doctor_id
        doc_prof_uuid = uuid.uuid4()
        qual = f"{payload.yearsOfExperience} yrs exp" if payload.yearsOfExperience else "MBBS"
        conn.execute("""
            INSERT INTO practitioner_profiles (
                id, public_id, doctor_id, user_id, registration_number, specialization,
                qualification, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, now()
            )
        """, (
            str(doc_prof_uuid), secrets.token_hex(6)[:12], doc_id, user_id_str,
            payload.medicalLicenseNumber.strip(), payload.specialization.strip(),
            qual
        ))

        # Optional hospital affiliation
        if payload.hospitalName and payload.hospitalName.strip():
            h_name = payload.hospitalName.strip()
            org = conn.execute(
                "SELECT id FROM healthcare_organizations WHERE name ILIKE %s LIMIT 1",
                (h_name,)
            ).fetchone()
            if not org:
                org_uuid = uuid.uuid4()
                org_pub = secrets.token_hex(6)[:12]
                conn.execute("""
                    INSERT INTO healthcare_organizations (
                        id, public_id, name, organization_type, created_at
                    ) VALUES (%s, %s, %s, 'hospital', now())
                """, (str(org_uuid), org_pub, h_name))
                org_id = str(org_uuid)
            else:
                org_id = str(org["id"])

            conn.execute("""
                INSERT INTO organization_memberships (
                    organization_id, user_id, designation, is_active, created_at
                ) VALUES (%s, %s, 'Consultant', true, now())
                ON CONFLICT (organization_id, user_id) DO NOTHING
            """, (org_id, user_id_str))

    return {
        "userId": f"usr_{user_uuid}",
        "doctorId": doc_id,
        "phone": clean_phone,
        "accountStatus": "pending_admin_approval",
        "otpSent": False,
        "otpExpiresInSeconds": OTP_SECONDS,
        "debugOtp": None,
    }


def doctor_request_otp(payload) -> Dict[str, Any]:
    now = int(time.time())
    otp = generate_otp()

    with get_db() as conn:
        if getattr(payload, "doctorId", None) and payload.doctorId.strip():
            clean_doc = normalize_doctor_id(payload.doctorId)
            user = conn.execute("""
                SELECT u.id, u.phone, u.full_name, u.admin_verified,
                       COALESCE(u.doctor_id, doc.doctor_id) AS doctor_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN practitioner_profiles doc ON doc.user_id = u.id
                WHERE (u.doctor_id = %s OR doc.doctor_id = %s)
                  AND ur.role IN ('practitioner', 'doctor')
                LIMIT 1
            """, (clean_doc, clean_doc)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail=f"No practitioner account found for Doctor ID '{payload.doctorId}'.",
                    code="INVALID_CREDENTIALS",
                )
        elif getattr(payload, "phone", None) and payload.phone.strip():
            clean_phone = payload.phone.strip()
            alt_phone = f"+91{clean_phone.replace('+91', '').strip()}"
            user = conn.execute("""
                SELECT u.id, u.phone, u.full_name, u.admin_verified,
                       COALESCE(u.doctor_id, doc.doctor_id) AS doctor_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN practitioner_profiles doc ON doc.user_id = u.id
                WHERE (u.phone = %s OR u.phone = %s)
                  AND ur.role IN ('practitioner', 'doctor')
                LIMIT 1
            """, (clean_phone, alt_phone)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail="No practitioner account found for this mobile number.",
                    code="INVALID_CREDENTIALS",
                )
        else:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Missing Identifier",
                detail="Doctor ID (DR-XXXXX) or registered mobile number is required.",
                code="BAD_REQUEST",
            )

        conn.execute("""
            UPDATE users
            SET otp_hash = %s, otp_expires_at = %s, otp_attempts = 0, updated_at = now()
            WHERE id = %s
        """, (hash_otp(otp), now + OTP_SECONDS, str(user["id"])))

    if OTP_DEBUG:
        logger.info("[DEV ONLY] Doctor Login OTP for %s: %s", user["phone"], otp)
        print(f"[DEV ONLY] Doctor Login OTP for {user['phone']}: {otp}")

    return {
        "maskedPhone": _mask_phone(user["phone"]),
        "otpExpiresInSeconds": OTP_SECONDS,
        "debugOtp": otp if OTP_DEBUG else None,
    }


def doctor_verify_otp(payload) -> Dict[str, Any]:
    now = int(time.time())

    with get_db() as conn:
        if getattr(payload, "doctorId", None) and payload.doctorId.strip():
            clean_doc = normalize_doctor_id(payload.doctorId)
            user = conn.execute("""
                SELECT u.*,
                       COALESCE(u.doctor_id, doc.doctor_id) AS resolved_doctor_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN practitioner_profiles doc ON doc.user_id = u.id
                WHERE (u.doctor_id = %s OR doc.doctor_id = %s)
                  AND ur.role IN ('practitioner', 'doctor')
                LIMIT 1
            """, (clean_doc, clean_doc)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail=f"No practitioner account found for Doctor ID '{payload.doctorId}'.",
                    code="INVALID_CREDENTIALS",
                )
        elif getattr(payload, "phone", None) and payload.phone.strip():
            clean_phone = payload.phone.strip()
            alt_phone = f"+91{clean_phone.replace('+91', '').strip()}"
            user = conn.execute("""
                SELECT u.*,
                       COALESCE(u.doctor_id, doc.doctor_id) AS resolved_doctor_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN practitioner_profiles doc ON doc.user_id = u.id
                WHERE (u.phone = %s OR u.phone = %s)
                  AND ur.role IN ('practitioner', 'doctor')
                LIMIT 1
            """, (clean_phone, alt_phone)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail="No practitioner account found for this mobile number.",
                    code="INVALID_CREDENTIALS",
                )
        else:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Missing Identifier",
                detail="Doctor ID (DR-XXXXX) or registered mobile number is required.",
                code="BAD_REQUEST",
            )

        if not user["otp_hash"] or not user["otp_expires_at"] or now > user["otp_expires_at"]:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="OTP Expired",
                detail="Login verification code has expired. Please request a new one.",
                code="OTP_EXPIRED",
            )

        if user["otp_attempts"] >= 5:
            raise APIProblemException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                title="Rate Limit Exceeded",
                detail="Too many incorrect login attempts. Please request a fresh OTP.",
                code="RATE_LIMIT_EXCEEDED",
            )

        if not verify_otp(payload.otp, user["otp_hash"]):
            conn.execute(
                "UPDATE users SET otp_attempts = otp_attempts + 1, updated_at = now() WHERE id = %s",
                (str(user["id"]),)
            )
            raise APIProblemException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                title="Invalid OTP",
                detail="The one-time verification code is incorrect.",
                code="INVALID_CREDENTIALS",
            )

        # Clear used OTP
        conn.execute(
            "UPDATE users SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0, updated_at = now() WHERE id = %s",
            (str(user["id"]),)
        )

    if not user.get("admin_verified"):
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Account Pending Verification",
            detail="Your practitioner account is awaiting verification by an administrator.",
            code="ACCOUNT_PENDING_APPROVAL",
        )

    formatted_user_id = f"usr_{user['id']}"
    token = create_access_token(formatted_user_id, role="practitioner")
    doc_id_val = user.get("resolved_doctor_id") or user.get("doctor_id")

    return {
        "accessToken": token,
        "tokenType": "Bearer",
        "expiresIn": ACCESS_TOKEN_SECONDS,
        "user": {
            "id": formatted_user_id,
            "fullName": user["full_name"],
            "email": user.get("email"),
            "phone": user["phone"],
            "role": "practitioner",
            "doctorId": doc_id_val,
            "mediclaimId": None,
            "isActive": bool(user["is_active"]),
            "adminVerified": bool(user["admin_verified"]),
            "isProfileComplete": bool(user["profile_complete"]),
        }
    }


def doctor_login(payload) -> Dict[str, Any]:
    if payload.otp and (getattr(payload, "doctorId", None) or getattr(payload, "phone", None)):
        return doctor_verify_otp(payload)

    with get_db() as conn:
        if getattr(payload, "doctorId", None) and payload.doctorId.strip():
            clean_d = normalize_doctor_id(payload.doctorId)
            clause = "(u.doctor_id = %s OR doc.doctor_id = %s)"
            query_params: tuple = (clean_d, clean_d)
        elif payload.phone:
            clean_p = payload.phone.strip()
            alt_p = f"+91{clean_p.replace('+91', '').strip()}"
            clause = "(u.phone = %s OR u.phone = %s)"
            query_params = (clean_p, alt_p)
        elif payload.email:
            clause = "u.email ILIKE %s"
            query_params = (payload.email.strip(),)
        elif getattr(payload, "mediclaimId", None) and payload.mediclaimId:
            clean_m = normalize_mediclaim_id(payload.mediclaimId)
            clause = "(u.mediclaim_id = %s OR u.public_id = %s)"
            query_params = (clean_m, clean_m)
        else:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Missing Identifier",
                detail="Doctor ID (DR-XXXXX), phone number, or email is required.",
                code="BAD_REQUEST",
            )

        user = conn.execute(f"""
            SELECT u.*,
                   COALESCE(u.doctor_id, doc.doctor_id) AS resolved_doctor_id
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN practitioner_profiles doc ON doc.user_id = u.id
            WHERE {clause}
              AND ur.role IN ('practitioner', 'doctor')
            LIMIT 1
        """, query_params).fetchone()

        if not user:
            raise APIProblemException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                title="Invalid Credentials",
                detail="Invalid practitioner credentials.",
                code="INVALID_CREDENTIALS",
            )

        if not payload.password or not verify_password(payload.password, user["password_hash"]):
            raise APIProblemException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                title="Invalid Credentials",
                detail="Invalid practitioner password.",
                code="INVALID_CREDENTIALS",
            )

    if not user.get("admin_verified"):
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Account Pending Verification",
            detail="Your practitioner account is awaiting verification by an administrator.",
            code="ACCOUNT_PENDING_APPROVAL",
        )

    formatted_user_id = f"usr_{user['id']}"
    token = create_access_token(formatted_user_id, role="practitioner")
    doc_id_val = user.get("resolved_doctor_id") or user.get("doctor_id")

    return {
        "accessToken": token,
        "tokenType": "Bearer",
        "expiresIn": ACCESS_TOKEN_SECONDS,
        "user": {
            "id": formatted_user_id,
            "fullName": user["full_name"],
            "email": user.get("email"),
            "phone": user["phone"],
            "role": "practitioner",
            "doctorId": doc_id_val,
            "mediclaimId": None,
            "isActive": bool(user["is_active"]),
            "adminVerified": bool(user["admin_verified"]),
            "isProfileComplete": bool(user["profile_complete"]),
        }
    }
