from datetime import datetime, timezone, timedelta
import secrets
import uuid
from typing import Any, Dict, List, Optional
from fastapi import status
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import AuthenticatedUser, format_mediclaim_id, normalize_mediclaim_id
from app.services.audit_service import record_audit
from app.schemas.records import KindType, MedicationItem

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

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

def ensure_practitioner_profile(doctor_user: AuthenticatedUser) -> str:
    """Ensures a practitioner_profiles row exists for doctor_user and returns its id."""
    raw_user_id = doctor_user.raw_uuid
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM practitioner_profiles WHERE user_id = %s",
            (raw_user_id,)
        ).fetchone()
        if existing:
            return str(existing["id"])

        # Auto-provision baseline practitioner profile
        doc_uuid = uuid.uuid4()
        public_id = _new_public_id("doc")
        reg_no = f"MCI-{secrets.randbelow(900000) + 100000}"

        conn.execute("""
            INSERT INTO practitioner_profiles (
                id, public_id, user_id, registration_number, specialization,
                qualification, created_at
            ) VALUES (
                %s, %s, %s, %s, 'General Medicine',
                'MBBS', now()
            )
        """, (str(doc_uuid), public_id, raw_user_id, reg_no))

    return str(doc_uuid)

def list_doctor_patients(doctor_user: AuthenticatedUser) -> List[Dict[str, Any]]:
    now = _now_utc()
    raw_doc_id = doctor_user.raw_uuid

    with get_db() as conn:
        rows = conn.execute("""
            SELECT g.id AS grant_id, g.expires_at,
                   p.id AS patient_profile_id, p.date_of_birth, p.gender, p.blood_group,
                   u.mediclaim_id, u.full_name,
                   COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{}') AS scopes
            FROM patient_access_grants g
            JOIN patient_profiles p ON p.id = g.patient_id
            JOIN users u ON u.id = p.user_id
            LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
            WHERE g.grantee_user_id = %s
              AND g.status = 'active'
              AND g.expires_at >= %s
            GROUP BY g.id, g.expires_at, p.id, p.date_of_birth, p.gender, p.blood_group, u.mediclaim_id, u.full_name
            ORDER BY g.expires_at DESC
        """, (raw_doc_id, now)).fetchall()

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
    sql = """
        SELECT g.id, g.status, g.duration_hours, g.purpose, g.created_at, g.expires_at,
               u.mediclaim_id, u.full_name,
               COALESCE(array_agg(s.record_type) FILTER (WHERE s.record_type IS NOT NULL), '{}') AS scopes
        FROM patient_access_grants g
        JOIN patient_profiles p ON p.id = g.patient_id
        JOIN users u ON u.id = p.user_id
        LEFT JOIN access_grant_scopes s ON s.access_grant_id = g.id
        WHERE g.grantee_user_id = %s
    """
    params: List[Any] = [raw_doc_id]

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
            WHERE g.patient_id = %s AND g.grantee_user_id = %s
            GROUP BY g.id, g.status, g.expires_at, g.organization_id
            ORDER BY g.created_at DESC
            LIMIT 1
        """, (pat_profile_id, raw_doc_id)).fetchone()

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
