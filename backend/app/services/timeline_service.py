from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import status
from app.database import get_db
from app.exceptions import APIProblemException


def _calc_age_in_months(dob: Optional[date], event_date: Optional[date]) -> Optional[int]:
    if not dob or not event_date:
        return None
    months = (event_date.year - dob.year) * 12 + (event_date.month - dob.month)
    if event_date.day < dob.day:
        months -= 1
    return max(0, months)


def _format_date(dt: Any) -> str:
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return str(dt)


def get_timeline(
    patient_profile_id: str,
    kind: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")

    with get_db() as conn:
        profile = conn.execute("""
            SELECT date_of_birth FROM patient_profiles WHERE id = %s
        """, (raw_pat_id,)).fetchone()

        if not profile:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Patient Profile Not Found",
                detail="Patient profile not found.",
                code="RECORD_NOT_FOUND"
            )

        dob = profile["date_of_birth"]
        dob_str = _format_date(dob)

        query = """
            SELECT id, record_type, title, description, recorded_at, provider, status
            FROM clinical_records
            WHERE patient_id = %s AND deleted_at IS NULL
        """
        params: List[Any] = [raw_pat_id]

        if kind:
            query += " AND record_type = %s"
            params.append(kind)

        if from_date:
            query += " AND recorded_at >= %s"
            params.append(from_date)

        if to_date:
            query += " AND recorded_at <= %s"
            params.append(f"{to_date} 23:59:59")

        query += " ORDER BY recorded_at DESC LIMIT %s"
        params.append(limit)

        rows = conn.execute(query, tuple(params)).fetchall()

    events = []
    for r in rows:
        rec_date = r["recorded_at"].date() if isinstance(r["recorded_at"], datetime) else r["recorded_at"]
        age_months = _calc_age_in_months(dob, rec_date)
        title = r["title"] or ""
        short = title.split()[0] if title else ""
        events.append({
            "id": f"rec_{r['id']}",
            "kind": r["record_type"],
            "title": title,
            "short": short,
            "detail": r["description"] or title,
            "date": _format_date(r["recorded_at"]),
            "provider": r["provider"] or "Healthcare Provider",
            "ageAtEventMonths": age_months,
            "status": r["status"] if r["status"] in ("active", "resolved", "inactive", "completed") else "active"
        })

    return {
        "patientId": f"pat_{raw_pat_id}",
        "dob": dob_str,
        "totalEvents": len(events),
        "events": events
    }


def get_health_graph(
    patient_profile_id: str,
    leaves: Optional[int] = None,
) -> Dict[str, Any]:
    raw_pat_id = patient_profile_id.replace("pat-", "").replace("pat_", "")

    with get_db() as conn:
        patient_row = conn.execute("""
            SELECT u.full_name, p.date_of_birth
            FROM patient_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE p.id = %s
        """, (raw_pat_id,)).fetchone()

        if not patient_row:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Profile Not Found",
                detail="Patient profile not found.",
                code="RECORD_NOT_FOUND"
            )

        records = conn.execute("""
            SELECT id, record_type, title, status, description
            FROM clinical_records
            WHERE patient_id = %s AND deleted_at IS NULL
            ORDER BY recorded_at DESC
        """, (raw_pat_id,)).fetchall()

    full_name = patient_row["full_name"] or "Patient"
    first_name = full_name.split()[0]
    dob = patient_row["date_of_birth"]
    birth_year = str(dob.year) if dob else "1994"

    center = {
        "patientName": first_name,
        "birthYear": birth_year
    }

    # Group by kind
    category_labels = {
        "allergy": "Allergies",
        "condition": "Conditions",
        "medication": "Medicines",
        "vaccination": "Vaccinations",
        "report": "Reports",
    }

    by_kind: Dict[str, List[Dict[str, Any]]] = {
        k: [] for k in category_labels
    }
    all_nodes: List[Dict[str, Any]] = []

    for r in records:
        kind = r["record_type"]
        node_id = f"rec_{r['id']}"
        label = r["title"]
        status_val = r["status"] if r["status"] in ("active", "resolved", "inactive") else "active"

        node_dict = {
            "id": node_id,
            "kind": kind,
            "label": label,
            "status": status_val
        }
        all_nodes.append(node_dict)
        if kind in by_kind:
            by_kind[kind].append(node_dict)

    # Build branches
    branches = []
    for kind, label in category_labels.items():
        kind_nodes = by_kind[kind]
        total_count = len(kind_nodes)
        nodes_to_include = kind_nodes[:leaves] if leaves else kind_nodes
        branches.append({
            "kind": kind,
            "categoryLabel": label,
            "total": total_count,
            "nodes": nodes_to_include
        })

    # Build cross-resource edges (e.g. Inhaler / Medication treats Asthma / Condition)
    edges = []
    condition_nodes = by_kind.get("condition", [])
    medication_nodes = by_kind.get("medication", [])

    for med in medication_nodes:
        med_lower = med["label"].lower()
        for cond in condition_nodes:
            cond_lower = cond["label"].lower()
            # Common medical correlations
            if ("asthma" in cond_lower and ("budesonide" in med_lower or "salbutamol" in med_lower or "inhaler" in med_lower)) or \
               ("hypertension" in cond_lower and ("amlodipine" in med_lower or "telmisartan" in med_lower)) or \
               ("diabetes" in cond_lower and ("metformin" in med_lower or "insulin" in med_lower)):
                edges.append({
                    "source": med["id"],
                    "target": cond["id"],
                    "relation": "treats"
                })

    return {
        "center": center,
        "nodes": all_nodes,
        "edges": edges,
        "branches": branches
    }
