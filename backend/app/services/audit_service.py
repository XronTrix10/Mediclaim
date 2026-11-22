from datetime import datetime, timezone
import json
import uuid
from typing import Any, Dict, List, Optional
from app.database import get_db


def _format_iso(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(dt)


def record_audit(
    actor_user_id: Optional[str],
    patient_id: Optional[str] = None,
    action: str = "audit",
    what: str = "",
    actor_name: str = "System",
    actor_role: str = "System",
    resource_kinds: Optional[List[str]] = None,
    outcome: str = "success",
    resource_table: Optional[str] = None,
    resource_id: Optional[str] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> str:
    audit_uuid = uuid.uuid4()
    raw_actor = actor_user_id.replace("usr-", "").replace("usr_", "") if actor_user_id else None
    raw_patient = patient_id.replace("pat-", "").replace("pat_", "") if patient_id else None
    raw_res_id = resource_id.replace("rec-", "").replace("rec_", "") if resource_id else None

    meta = {
        "who": actor_name,
        "actorRole": actor_role,
        "what": what,
        "resourceKinds": resource_kinds or [],
        "outcome": outcome,
    }
    if extra_metadata:
        meta.update(extra_metadata)

    with get_db() as conn:
        conn.execute("""
            INSERT INTO audit_events (
                id, actor_user_id, patient_id, action, resource_table,
                resource_id, occurred_at, metadata
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, now(), %s::jsonb
            )
        """, (
            str(audit_uuid), raw_actor, raw_patient, action,
            resource_table or "clinical_records", raw_res_id, json.dumps(meta)
        ))

    return f"aud_{audit_uuid}"


def list_audit_logs(
    patient_profile_id: str,
    limit: int = 50,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    action_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")
    query = """
        SELECT a.id, a.actor_user_id, a.action, a.occurred_at, a.metadata,
               u.full_name AS actor_user_name
        FROM audit_events a
        LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.patient_id = %s
    """
    params: List[Any] = [raw_pat_id]

    if action_filter:
        query += " AND a.action = %s"
        params.append(action_filter)

    if from_date:
        query += " AND a.occurred_at >= %s"
        params.append(from_date)

    if to_date:
        query += " AND a.occurred_at <= %s"
        params.append(f"{to_date} 23:59:59")

    query += " ORDER BY a.occurred_at DESC LIMIT %s"
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()

    logs = []
    for r in rows:
        meta = r.get("metadata") or {}
        actor_name = r.get("actor_user_name") or meta.get("who") or "Practitioner"
        logs.append({
            "id": f"aud_{r['id']}",
            "actorId": f"usr_{r['actor_user_id']}" if r.get("actor_user_id") else None,
            "who": actor_name,
            "actorRole": meta.get("actorRole") or "Practitioner",
            "action": r["action"],
            "what": meta.get("what") or f"accessed {r['action']}",
            "resourceKinds": meta.get("resourceKinds") or [],
            "occurredAt": _format_iso(r["occurred_at"]),
            "outcome": meta.get("outcome") or "success"
        })
    return logs
