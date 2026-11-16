from datetime import datetime, timedelta, timezone
import json
import uuid
from typing import Any, Dict, List, Optional
from fastapi import status
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import normalize_mediclaim_id, format_mediclaim_id, AuthenticatedUser


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _format_iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def trigger_emergency_access(doctor_user: AuthenticatedUser, payload) -> Dict[str, Any]:
    clean_med_id = normalize_mediclaim_id(payload.patientMediclaimId)
    now = _now_utc()
    expires = now + timedelta(hours=1)
    review_deadline = now + timedelta(hours=24)
    audit_uuid = uuid.uuid4()
    audit_id = f"aud_emg_{audit_uuid.hex[:8]}"

    with get_db() as conn:
        patient = conn.execute("""
            SELECT p.id AS patient_profile_id, p.blood_group, u.full_name
            FROM users u
            JOIN patient_profiles p ON p.user_id = u.id
            WHERE u.mediclaim_id = %s OR u.public_id = %s
        """, (clean_med_id, clean_med_id)).fetchone()

        if not patient:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Patient Not Found",
                detail=f"Patient with Mediclaim ID {payload.patientMediclaimId} not found.",
                code="RECORD_NOT_FOUND"
            )

        pat_id = str(patient["patient_profile_id"])

        # Fetch critical allergies
        allergies = conn.execute("""
            SELECT allergen, severity, reaction
            FROM allergies
            WHERE patient_id = %s AND status = 'active'
              AND (severity IN ('severe', 'life-threatening') OR criticality = 'high')
        """, (pat_id,)).fetchall()

        # Fetch active conditions
        conditions = conn.execute("""
            SELECT condition_name, status
            FROM conditions
            WHERE patient_id = %s AND status = 'active'
        """, (pat_id,)).fetchall()

        # Insert immutable audit event
        audit_metadata = {
            "emergencyType": payload.emergencyType,
            "clinicalJustification": payload.clinicalJustification,
            "requesterId": doctor_user.id,
            "requesterName": doctor_user.full_name,
            "requesterRole": "Emergency Practitioner",
            "auditTrackingId": audit_id,
        }

        conn.execute("""
            INSERT INTO audit_events (
                id, actor_user_id, patient_id, action, resource_table,
                resource_id, occurred_at, metadata
            ) VALUES (
                %s, %s, %s, 'emergency', 'patient_profiles',
                %s, now(), %s::jsonb
            )
        """, (
            str(audit_uuid), doctor_user.raw_uuid, pat_id,
            pat_id, json.dumps(audit_metadata)
        ))

    critical_allergies = [
        {"allergen": a["allergen"], "severity": a["severity"], "reaction": a["reaction"] or ""}
        for a in allergies
    ]
    active_conditions = [
        {"conditionName": c["condition_name"], "status": c["status"]}
        for c in conditions
    ]

    return {
        "emergencyStatus": "emergency_granted",
        "auditTrackingId": audit_id,
        "expiresAt": _format_iso(expires),
        "reviewMandatoryBefore": _format_iso(review_deadline),
        "criticalSummary": {
            "bloodGroup": patient["blood_group"] or "Unknown",
            "criticalAllergies": critical_allergies,
            "activeConditions": active_conditions,
        }
    }


def list_emergency_events(patient_profile_id: str) -> List[Dict[str, Any]]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, occurred_at, metadata
            FROM audit_events
            WHERE patient_id = %s AND action = 'emergency'
            ORDER BY occurred_at DESC
        """, (raw_pat_id,)).fetchall()

    events = []
    for r in rows:
        meta = r.get("metadata") or {}
        events.append({
            "id": f"emg_{r['id']}",
            "requesterName": meta.get("requesterName") or "Attending Physician",
            "emergencyType": meta.get("emergencyType") or "EMERGENCY_OVERRIDE",
            "clinicalJustification": meta.get("clinicalJustification") or "Break-glass protocol activated.",
            "occurredAt": _format_iso(r["occurred_at"])
        })
    return events
