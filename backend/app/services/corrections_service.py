from datetime import datetime, timezone
import json
import uuid
from typing import Any, Dict, List, Optional
from fastapi import status
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import AuthenticatedUser


def _format_iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def create_correction(patient_profile_id: str, user_id: str, payload) -> Dict[str, Any]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    raw_user_id = user_id.replace("usr-", "").replace("usr_", "")
    raw_rec_id = payload.recordId.replace("rec-", "").replace("rec_", "")

    with get_db() as conn:
        record = conn.execute("""
            SELECT id, title FROM clinical_records
            WHERE (id::text = %s OR public_id = %s) AND patient_id = %s
        """, (raw_rec_id, raw_rec_id, raw_pat_id)).fetchone()

        if not record:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Record Not Found",
                detail=f"Clinical record '{payload.recordId}' does not exist.",
                code="RECORD_NOT_FOUND"
            )

        corr_uuid = uuid.uuid4()
        now = datetime.now(timezone.utc)
        proposed_json = json.dumps(payload.proposedCorrection) if payload.proposedCorrection else None

        conn.execute("""
            INSERT INTO record_correction_requests (
                id, patient_id, clinical_record_id, requested_by, reason,
                proposed_correction, proposed_text, record_title, status, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s::jsonb, %s, %s, 'under_review', %s
            )
        """, (
            str(corr_uuid), raw_pat_id, str(record["id"]), raw_user_id,
            payload.reason, proposed_json, payload.proposed, payload.recordTitle, now
        ))

    return {
        "id": f"corr_{corr_uuid}",
        "recordId": payload.recordId,
        "recordTitle": payload.recordTitle,
        "reason": payload.reason,
        "proposed": payload.proposed,
        "proposedCorrection": payload.proposedCorrection,
        "correctionStatus": "under_review",
        "createdAt": _format_iso(now)
    }


def list_corrections(patient_profile_id: str) -> List[Dict[str, Any]]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT c.*, cr.title AS actual_record_title
            FROM record_correction_requests c
            LEFT JOIN clinical_records cr ON cr.id = c.clinical_record_id
            WHERE c.patient_id = %s
            ORDER BY c.created_at DESC
        """, (raw_pat_id,)).fetchall()

    corrections = []
    for r in rows:
        corrections.append({
            "id": f"corr_{r['id']}",
            "recordId": f"rec_{r['clinical_record_id']}",
            "recordTitle": r.get("record_title") or r.get("actual_record_title") or "Medical Record",
            "reason": r["reason"] or "",
            "proposed": r.get("proposed_text"),
            "proposedCorrection": r.get("proposed_correction"),
            "correctionStatus": r["status"],
            "createdAt": _format_iso(r["created_at"]),
            "reviewedAt": _format_iso(r.get("reviewed_at")),
            "reviewNotes": r.get("review_notes"),
        })
    return corrections


def get_correction_by_id(correction_id: str, patient_profile_id: Optional[str] = None) -> Dict[str, Any]:
    raw_corr_id = correction_id.replace("corr-", "").replace("corr_", "")
    query = """
        SELECT c.*, cr.title AS actual_record_title
        FROM record_correction_requests c
        LEFT JOIN clinical_records cr ON cr.id = c.clinical_record_id
        WHERE c.id::text = %s
    """
    params: List[Any] = [raw_corr_id]
    if patient_profile_id:
        raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
        query += " AND c.patient_id = %s"
        params.append(raw_pat_id)

    with get_db() as conn:
        row = conn.execute(query, tuple(params)).fetchone()

    if not row:
        raise APIProblemException(
            status_code=status.HTTP_404_NOT_FOUND,
            title="Correction Request Not Found",
            detail=f"Correction request '{correction_id}' not found.",
            code="RECORD_NOT_FOUND"
        )

    return {
        "id": f"corr_{row['id']}",
        "recordId": f"rec_{row['clinical_record_id']}",
        "recordTitle": row.get("record_title") or row.get("actual_record_title") or "Medical Record",
        "reason": row["reason"] or "",
        "proposed": row.get("proposed_text"),
        "proposedCorrection": row.get("proposed_correction"),
        "correctionStatus": row["status"],
        "createdAt": _format_iso(row["created_at"]),
        "reviewedAt": _format_iso(row.get("reviewed_at")),
        "reviewNotes": row.get("review_notes"),
    }


def review_correction(doctor_user: AuthenticatedUser, correction_id: str, payload) -> Dict[str, Any]:
    raw_corr_id = correction_id.replace("corr-", "").replace("corr_", "")
    now = datetime.now(timezone.utc)

    with get_db() as conn:
        corr = conn.execute("""
            SELECT * FROM record_correction_requests WHERE id::text = %s
        """, (raw_corr_id,)).fetchone()

        if not corr:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Correction Not Found",
                detail=f"Correction request '{correction_id}' not found.",
                code="RECORD_NOT_FOUND"
            )

        conn.execute("""
            UPDATE record_correction_requests
            SET status = %s,
                reviewed_by = %s,
                reviewed_at = %s,
                review_notes = %s
            WHERE id = %s
        """, (payload.status, doctor_user.raw_uuid, now, payload.reviewNotes, raw_corr_id))

        # If approved, record version in clinical_record_versions
        if payload.status == "approved":
            rec_id = str(corr["clinical_record_id"])
            current_rec = conn.execute("SELECT * FROM clinical_records WHERE id = %s", (rec_id,)).fetchone()
            if current_rec:
                ver_count = conn.execute(
                    "SELECT count(*) as count FROM clinical_record_versions WHERE clinical_record_id = %s",
                    (rec_id,)
                ).fetchone()["count"]
                conn.execute("""
                    INSERT INTO clinical_record_versions (
                        clinical_record_id, version_number, changed_by,
                        previous_data, change_summary, created_at
                    ) VALUES (
                        %s, %s, %s, %s::jsonb, %s, now()
                    )
                """, (
                    rec_id, ver_count + 1, doctor_user.raw_uuid,
                    json.dumps({"title": current_rec["title"], "description": current_rec["description"]}),
                    payload.reviewNotes or corr["reason"]
                ))

    return {
        "id": f"corr_{raw_corr_id}",
        "correctionStatus": payload.status,
        "reviewedAt": _format_iso(now),
        "reviewNotes": payload.reviewNotes
    }


def withdraw_correction(patient_profile_id: str, correction_id: str) -> None:
    raw_corr_id = correction_id.replace("corr-", "").replace("corr_", "")
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")

    with get_db() as conn:
        res = conn.execute("""
            DELETE FROM record_correction_requests
            WHERE id::text = %s AND patient_id = %s AND status = 'under_review'
        """, (raw_corr_id, raw_pat_id))

        if res.rowcount == 0:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Correction Not Found",
                detail=f"Correction request '{correction_id}' not found or already reviewed.",
                code="RECORD_NOT_FOUND"
            )


def get_record_history(record_id: str) -> List[Dict[str, Any]]:
    raw_rec_id = record_id.replace("rec-", "").replace("rec_", "")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT v.*, u.full_name AS changer_name
            FROM clinical_record_versions v
            LEFT JOIN users u ON u.id = v.changed_by
            WHERE v.clinical_record_id::text = %s
            ORDER BY v.version_number DESC
        """, (raw_rec_id,)).fetchall()

    history = []
    for r in rows:
        history.append({
            "versionNumber": r["version_number"],
            "changedBy": r.get("changer_name") or "Practitioner",
            "previousData": r.get("previous_data"),
            "changeSummary": r.get("change_summary"),
            "createdAt": _format_iso(r["created_at"])
        })
    return history
