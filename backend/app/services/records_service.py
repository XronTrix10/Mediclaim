from datetime import datetime, timezone
import json
import secrets
import uuid
from typing import Any, Dict, List, Optional
from fastapi import status
from app.database import get_db
from app.exceptions import APIProblemException


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _format_date(dt: Any) -> str:
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return str(dt)


def _new_public_id(prefix: str = "rec") -> str:
    # 12 alphanumeric characters matching regex ^[A-Za-z0-9]{12}$
    rand_part = secrets.token_hex(6)[:12 - len(prefix)]
    return f"{prefix}{rand_part}".lower()


def _build_fhir_resource(record: Dict[str, Any], kind: str) -> Dict[str, Any]:
    rec_id = str(record.get("id", ""))
    patient_ref = f"Patient/{record.get('patient_id')}"
    
    if kind == "allergy":
        return {
            "resourceType": "AllergyIntolerance",
            "id": f"ai-{rec_id[:8]}",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    "code": record.get("status") or "active"
                }]
            },
            "verificationStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                    "code": "confirmed" if record.get("source") == "practitioner" else "unconfirmed"
                }]
            },
            "category": [record.get("category") or "medication"],
            "criticality": record.get("criticality") or "high",
            "code": {
                "text": record.get("allergen") or record.get("title")
            },
            "patient": {"reference": patient_ref},
            "reaction": [{
                "manifestation": [{"text": record.get("reaction") or ""}],
                "severity": record.get("severity") or "moderate"
            }],
            "recordedDate": _format_date(record.get("recorded_at")),
            "note": [{"text": record.get("notes") or ""}] if record.get("notes") else []
        }
    elif kind == "condition":
        return {
            "resourceType": "Condition",
            "id": f"cond-{rec_id[:8]}",
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": record.get("status") or "active"
                }]
            },
            "code": {
                "text": record.get("condition_name") or record.get("title")
            },
            "subject": {"reference": patient_ref},
            "onsetDateTime": _format_date(record.get("onset_date") or record.get("recorded_at")),
            "note": [{"text": record.get("notes") or ""}] if record.get("notes") else []
        }
    elif kind == "medication":
        return {
            "resourceType": "MedicationStatement",
            "id": f"med-{rec_id[:8]}",
            "status": record.get("status") or "active",
            "medicationCodeableConcept": {
                "text": record.get("medication_name") or record.get("title")
            },
            "subject": {"reference": patient_ref},
            "effectiveDateTime": _format_date(record.get("recorded_at")),
            "dosage": [{"text": record.get("dosage") or ""}] if record.get("dosage") else []
        }
    elif kind == "vaccination":
        return {
            "resourceType": "Immunization",
            "id": f"imm-{rec_id[:8]}",
            "status": "completed",
            "vaccineCode": {
                "text": record.get("vaccine_name") or record.get("title")
            },
            "patient": {"reference": patient_ref},
            "occurrenceDateTime": _format_date(record.get("administered_date") or record.get("recorded_at")),
            "lotNumber": record.get("batch_number") or ""
        }
    elif kind == "report":
        return {
            "resourceType": "DiagnosticReport",
            "id": f"diag-{rec_id[:8]}",
            "status": "final",
            "code": {
                "text": record.get("report_name") or record.get("title")
            },
            "subject": {"reference": patient_ref},
            "effectiveDateTime": _format_date(record.get("report_date") or record.get("recorded_at")),
            "conclusion": record.get("conclusion") or ""
        }
    return {
        "resourceType": "Basic",
        "id": rec_id,
        "code": {"text": record.get("title")}
    }


def _record_to_view_model(r: Dict[str, Any], include_fhir: bool = False) -> Dict[str, Any]:
    kind = r.get("record_type") or "condition"
    rec_id = f"rec_{r['id']}"
    title = r.get("title") or ""
    date_val = _format_date(r.get("recorded_at"))
    provider = r.get("provider") or "Lifeline Healthcare"
    status_val = r.get("status") or "active"
    source = r.get("source") or "self_reported"
    detail = r.get("description") or title

    item: Dict[str, Any] = {
        "id": rec_id,
        "kind": kind,
        "title": title,
        "short": title.split()[0] if title else "",
        "detail": detail,
        "date": date_val,
        "provider": provider,
        "status": status_val,
        "source": source,
    }

    if kind == "allergy":
        item["allergen"] = r.get("allergen") or title
        item["category"] = r.get("category") or "medication"
        item["severity"] = r.get("severity") or "moderate"
        item["criticality"] = r.get("criticality") or "high"
        item["reaction"] = r.get("reaction") or ""
        item["notes"] = r.get("notes") or ""
    elif kind == "medication":
        item["dosage"] = r.get("dosage") or ""
        item["instructions"] = r.get("instructions") or ""

    if include_fhir:
        item["fhirResource"] = _build_fhir_resource(r, kind)

    return item


def list_patient_records(
    patient_profile_id: str,
    kind: Optional[str] = None,
    status_filter: Optional[str] = None,
    search_q: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 50,
    cursor: Optional[str] = None,
    include_fhir: bool = False,
) -> Dict[str, Any]:
    raw_patient_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    query = """
        SELECT c.*,
               a.allergen, a.reaction, a.severity, a.category, a.criticality, a.notes AS allergy_notes,
               cond.condition_name, cond.onset_date, cond.resolved_date, cond.notes AS condition_notes,
               m.dosage, m.adherence_notes AS instructions,
               v.vaccine_name, v.administered_date, v.batch_number,
               dr.report_name, dr.report_date, dr.conclusion
        FROM clinical_records c
        LEFT JOIN allergies a ON a.clinical_record_id = c.id
        LEFT JOIN conditions cond ON cond.clinical_record_id = c.id
        LEFT JOIN medication_statements m ON m.patient_id = c.patient_id AND m.medication_name = c.title
        LEFT JOIN vaccinations v ON v.clinical_record_id = c.id
        LEFT JOIN diagnostic_reports dr ON dr.patient_id = c.patient_id AND dr.report_name = c.title
        WHERE c.patient_id = %s AND c.deleted_at IS NULL
    """
    params: List[Any] = [raw_patient_id]

    if kind:
        query += " AND c.record_type = %s"
        params.append(kind)

    if status_filter:
        query += " AND c.status = %s"
        params.append(status_filter)

    if from_date:
        query += " AND c.recorded_at >= %s"
        params.append(from_date)

    if to_date:
        query += " AND c.recorded_at <= %s"
        params.append(f"{to_date} 23:59:59")

    if search_q:
        query += " AND (c.title ILIKE %s OR c.description ILIKE %s OR c.provider ILIKE %s)"
        like_param = f"%{search_q}%"
        params.extend([like_param, like_param, like_param])

    query += " ORDER BY c.recorded_at DESC LIMIT %s"
    params.append(limit + 1)

    with get_db() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()

    has_more = len(rows) > limit
    rows_to_return = rows[:limit]
    events = [_record_to_view_model(r, include_fhir=include_fhir) for r in rows_to_return]

    next_cursor = str(rows_to_return[-1]["id"]) if (has_more and rows_to_return) else None

    return {
        "records": events,
        "total": len(events),
        "nextCursor": next_cursor
    }


def get_record_by_id(record_id: str, patient_profile_id: Optional[str] = None) -> Dict[str, Any]:
    raw_id = record_id.replace("rec-", "").replace("rec_", "")
    try:
        rec_uuid = str(uuid.UUID(raw_id))
        id_clause = "c.id = %s"
        id_param = rec_uuid
    except ValueError:
        id_clause = "c.public_id = %s"
        id_param = raw_id

    query = f"""
        SELECT c.*,
               a.allergen, a.reaction, a.severity, a.category, a.criticality, a.notes AS allergy_notes,
               cond.condition_name, cond.onset_date, cond.resolved_date, cond.notes AS condition_notes,
               m.dosage, m.adherence_notes AS instructions,
               v.vaccine_name, v.administered_date, v.batch_number,
               dr.report_name, dr.report_date, dr.conclusion
        FROM clinical_records c
        LEFT JOIN allergies a ON a.clinical_record_id = c.id
        LEFT JOIN conditions cond ON cond.clinical_record_id = c.id
        LEFT JOIN medication_statements m ON m.patient_id = c.patient_id AND m.medication_name = c.title
        LEFT JOIN vaccinations v ON v.clinical_record_id = c.id
        LEFT JOIN diagnostic_reports dr ON dr.patient_id = c.patient_id AND dr.report_name = c.title
        WHERE {id_clause} AND c.deleted_at IS NULL
    """
    params: List[Any] = [id_param]
    if patient_profile_id:
        raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
        query += " AND c.patient_id = %s"
        params.append(raw_pat_id)

    with get_db() as conn:
        row = conn.execute(query, tuple(params)).fetchone()

    if not row:
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Record Not Found",
            detail=f"Clinical record '{record_id}' does not exist or has been retracted.",
            code="RECORD_NOT_FOUND"
        )

    return _record_to_view_model(row, include_fhir=True)


def create_allergy(patient_profile_id: str, user_id: str, payload) -> Dict[str, Any]:
    raw_patient_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    rec_uuid = uuid.uuid4()
    public_id = _new_public_id("rec")
    now = datetime.now(timezone.utc)
    rec_date = payload.identifiedDate or now.date()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO clinical_records (
                id, public_id, patient_id, created_by, record_type, title,
                status, description, recorded_at, created_at, updated_at,
                source, provider, fhir_resource_type, fhir_resource_id
            ) VALUES (
                %s, %s, %s, %s, 'allergy', %s,
                'active', %s, %s, now(), now(),
                'self_reported', %s, 'AllergyIntolerance', %s
            )
        """, (
            str(rec_uuid), public_id, raw_patient_id, raw_user_id, payload.allergen,
            payload.reaction, rec_date, payload.provider, f"ai-{str(rec_uuid)[:8]}"
        ))

        conn.execute("""
            INSERT INTO allergies (
                id, patient_id, clinical_record_id, allergen, reaction,
                severity, status, identified_date, notes, category, criticality, created_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s,
                %s, 'active', %s, %s, %s, %s, now()
            )
        """, (
            raw_patient_id, str(rec_uuid), payload.allergen, payload.reaction,
            payload.severity, rec_date, payload.notes, payload.category, payload.criticality
        ))

    return {
        "id": f"rec_{rec_uuid}",
        "kind": "allergy",
        "title": payload.allergen,
        "category": payload.category,
        "severity": payload.severity,
        "criticality": payload.criticality,
        "reaction": payload.reaction,
        "status": "active",
        "source": "self_reported",
        "date": _format_date(rec_date),
        "provider": payload.provider,
        "notes": payload.notes,
        "fhirId": f"AllergyIntolerance/ai-{str(rec_uuid)[:8]}"
    }


def create_condition(patient_profile_id: str, user_id: str, payload) -> Dict[str, Any]:
    raw_patient_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    rec_uuid = uuid.uuid4()
    public_id = _new_public_id("rec")
    onset = payload.onsetDate or datetime.now(timezone.utc).date()

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
            str(rec_uuid), public_id, raw_patient_id, raw_user_id, payload.conditionName,
            payload.status, payload.notes or payload.conditionName, onset,
            payload.provider or "Practitioner", f"cond-{str(rec_uuid)[:8]}"
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
            raw_patient_id, str(rec_uuid), payload.conditionName, payload.severity,
            payload.status, onset, payload.resolvedDate, payload.notes
        ))

    return {
        "id": f"rec_{rec_uuid}",
        "kind": "condition",
        "title": payload.conditionName,
        "status": payload.status,
        "date": _format_date(onset),
        "provider": payload.provider or "Practitioner",
        "fhirId": f"Condition/cond-{str(rec_uuid)[:8]}"
    }


def create_medication(patient_profile_id: str, user_id: str, payload) -> Dict[str, Any]:
    raw_patient_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    rec_uuid = uuid.uuid4()
    public_id = _new_public_id("rec")
    start = payload.startDate or datetime.now(timezone.utc).date()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO clinical_records (
                id, public_id, patient_id, created_by, record_type, title,
                status, description, recorded_at, created_at, updated_at,
                source, provider, fhir_resource_type, fhir_resource_id
            ) VALUES (
                %s, %s, %s, %s, 'medication', %s,
                %s, %s, %s, now(), now(),
                'practitioner', %s, 'MedicationStatement', %s
            )
        """, (
            str(rec_uuid), public_id, raw_patient_id, raw_user_id, payload.medicationName,
            payload.status, payload.instructions or payload.dosage, start,
            payload.provider or "Practitioner", f"med-{str(rec_uuid)[:8]}"
        ))

        conn.execute("""
            INSERT INTO medication_statements (
                id, patient_id, medication_name, dosage, start_date, end_date,
                status, adherence_notes, created_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s,
                %s, %s, now()
            )
        """, (
            raw_patient_id, payload.medicationName, payload.dosage, start,
            payload.endDate, payload.status, payload.instructions
        ))

    return {
        "id": f"rec_{rec_uuid}",
        "kind": "medication",
        "title": payload.medicationName,
        "dosage": payload.dosage,
        "status": payload.status,
        "date": _format_date(start),
        "provider": payload.provider or "Practitioner",
        "fhirId": f"MedicationStatement/med-{str(rec_uuid)[:8]}"
    }


def create_vaccination(patient_profile_id: str, user_id: str, payload) -> Dict[str, Any]:
    raw_patient_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    rec_uuid = uuid.uuid4()
    public_id = _new_public_id("rec")

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
            str(rec_uuid), public_id, raw_patient_id, raw_user_id, payload.vaccineName,
            payload.notes or f"Dose {payload.doseNumber}", payload.administeredDate,
            payload.provider or "Practitioner", f"imm-{str(rec_uuid)[:8]}"
        ))

        conn.execute("""
            INSERT INTO vaccinations (
                id, patient_id, clinical_record_id, vaccine_name, dose_number,
                administered_date, next_due_date, batch_number, notes, created_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s,
                %s, %s, %s, %s, now()
            )
        """, (
            raw_patient_id, str(rec_uuid), payload.vaccineName, payload.doseNumber,
            payload.administeredDate, payload.nextDueDate, payload.batchNumber, payload.notes
        ))

    return {
        "id": f"rec_{rec_uuid}",
        "kind": "vaccination",
        "title": payload.vaccineName,
        "date": _format_date(payload.administeredDate),
        "provider": payload.provider or "Practitioner",
        "fhirId": f"Immunization/imm-{str(rec_uuid)[:8]}"
    }


def create_report(patient_profile_id: str, user_id: str, payload) -> Dict[str, Any]:
    raw_patient_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    rec_uuid = uuid.uuid4()
    diag_uuid = uuid.uuid4()
    public_id = _new_public_id("rec")
    diag_public_id = _new_public_id("doc")
    rep_date = payload.reportDate or datetime.now(timezone.utc).date()

    with get_db() as conn:
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
            str(rec_uuid), public_id, raw_patient_id, raw_user_id, payload.reportName,
            payload.conclusion or payload.reportName, rep_date,
            payload.provider or "Diagnostic Centre", f"diag-{str(rec_uuid)[:8]}"
        ))

        conn.execute("""
            INSERT INTO diagnostic_reports (
                id, public_id, patient_id, report_name, report_type,
                report_date, status, conclusion, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, 'final', %s, now()
            )
        """, (
            str(diag_uuid), diag_public_id, raw_patient_id, payload.reportName,
            payload.reportType or "lab", rep_date, payload.conclusion
        ))

    return {
        "id": f"rec_{rec_uuid}",
        "kind": "report",
        "title": payload.reportName,
        "date": _format_date(rep_date),
        "provider": payload.provider or "Diagnostic Centre",
        "fhirId": f"DiagnosticReport/diag-{str(rec_uuid)[:8]}"
    }


# --- Prescriptions Service ---
def list_prescriptions(patient_profile_id: str) -> List[Dict[str, Any]]:
    raw_patient_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    with get_db() as conn:
        rx_rows = conn.execute("""
            SELECT p.*,
                   doc.registration_number,
                   u.full_name AS doctor_full_name,
                   o.name AS org_full_name
            FROM prescriptions p
            LEFT JOIN practitioner_profiles doc ON doc.id = p.practitioner_id
            LEFT JOIN users u ON u.id = doc.user_id
            LEFT JOIN healthcare_organizations o ON o.id = p.organization_id
            WHERE p.patient_id = %s AND p.deleted_at IS NULL
            ORDER BY p.prescribed_at DESC
        """, (raw_patient_id,)).fetchall()

        if not rx_rows:
            return []

        rx_ids = [str(r["id"]) for r in rx_rows]
        items_rows = conn.execute("""
            SELECT * FROM prescription_items
            WHERE prescription_id = ANY(%s::uuid[])
        """, (rx_ids,)).fetchall()

    items_by_rx: Dict[str, List[Dict[str, Any]]] = {}
    for item in items_rows:
        pid = str(item["prescription_id"])
        if pid not in items_by_rx:
            items_by_rx[pid] = []
        items_by_rx[pid].append({
            "name": item["medication_name"],
            "dosage": item.get("dosage") or "",
            "frequency": item.get("frequency") or "",
            "duration": item.get("duration") or "",
            "instructions": item.get("instructions") or ""
        })

    prescriptions = []
    for r in rx_rows:
        pid = str(r["id"])
        doc_name = r.get("doctor_name") or r.get("doctor_full_name") or "Practitioner"
        org_name = r.get("organization_name") or r.get("org_full_name")
        prescriptions.append({
            "id": f"rx_{pid}",
            "kind": "medication",
            "title": r.get("title") or "Medical Prescription",
            "doctor": doc_name,
            "organization": org_name,
            "date": _format_date(r["prescribed_at"]),
            "status": r["status"] if r["status"] in ("active", "completed", "cancelled") else "active",
            "fileType": r.get("file_type") or "pdf",
            "fileName": r.get("file_name") or f"prescription_{pid[:8]}.pdf",
            "fileSizeBytes": r.get("file_size_bytes") or 421888,
            "fileUrl": r.get("file_url"),
            "instructions": r.get("instructions") or "",
            "medications": items_by_rx.get(pid, [])
        })

    return prescriptions


def create_prescription(patient_profile_id: str, user_id: str, payload) -> Dict[str, Any]:
    raw_patient_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    rx_uuid = uuid.uuid4()
    public_id = _new_public_id("rx")

    with get_db() as conn:
        conn.execute("""
            INSERT INTO prescriptions (
                id, public_id, patient_id, prescribed_at, status, instructions,
                title, doctor_name, organization_name, file_type, file_name,
                file_size_bytes, file_url, created_at
            ) VALUES (
                %s, %s, %s, %s, 'active', %s,
                %s, %s, %s, %s, %s,
                %s, %s, now()
            )
        """, (
            str(rx_uuid), public_id, raw_patient_id, payload.date, payload.instructions,
            payload.title, payload.doctor, payload.organization,
            payload.fileType or "pdf", payload.fileName, payload.fileSizeBytes or 421888,
            payload.fileUrl
        ))

        if payload.medications:
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
                    raw_patient_id, str(rx_uuid), med.name, med.dosage,
                    med.frequency, med.duration, med.instructions
                ))

        # Also insert into clinical_records for unified timeline listing
        rec_uuid = uuid.uuid4()
        conn.execute("""
            INSERT INTO clinical_records (
                id, public_id, patient_id, created_by, record_type, title,
                status, description, recorded_at, created_at, updated_at,
                source, provider
            ) VALUES (
                %s, %s, %s, %s, 'medication', %s,
                'active', %s, %s, now(), now(),
                'practitioner', %s
            )
        """, (
            str(rec_uuid), _new_public_id("rec"), raw_patient_id, raw_user_id,
            payload.title, payload.instructions or "Prescription", payload.date,
            payload.doctor
        ))

    return {
        "id": f"rx_{rx_uuid}",
        "title": payload.title,
        "doctor": payload.doctor,
        "organization": payload.organization,
        "date": _format_date(payload.date),
        "status": "active"
    }


def retract_prescription(patient_profile_id: str, prescription_id: str) -> None:
    raw_rx_id = prescription_id.replace("rx-", "").replace("rx_", "")
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")

    with get_db() as conn:
        rx = conn.execute("""
            SELECT id, title FROM prescriptions
            WHERE (id::text = %s OR public_id = %s) AND patient_id = %s AND deleted_at IS NULL
        """, (raw_rx_id, raw_rx_id, raw_pat_id)).fetchone()

        if not rx:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Prescription Not Found",
                detail=f"Prescription '{prescription_id}' was not found or has already been retracted.",
                code="RECORD_NOT_FOUND"
            )

        now = datetime.now(timezone.utc)
        conn.execute("""
            UPDATE prescriptions
            SET deleted_at = %s, status = 'cancelled'
            WHERE id = %s
        """, (now, str(rx["id"])))

        # Also soft-delete corresponding clinical_record if matching title
        if rx.get("title"):
            conn.execute("""
                UPDATE clinical_records
                SET deleted_at = %s, status = 'deleted'
                WHERE patient_id = %s AND title = %s AND deleted_at IS NULL
            """, (now, raw_pat_id, rx["title"]))
