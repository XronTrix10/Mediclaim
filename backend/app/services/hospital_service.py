from datetime import datetime, timezone
import logging
import secrets
import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import status
from app.config import ACCESS_TOKEN_SECONDS, OTP_SECONDS, OTP_DEBUG
from app.database import get_db
from app.exceptions import APIProblemException
from app.security import (
    hash_password, verify_password, create_access_token,
    generate_otp, hash_otp, verify_otp,
    generate_hospital_id, normalize_hospital_id,
    generate_doctor_id, normalize_doctor_id
)
from app.services.audit_service import record_audit

logger = logging.getLogger("mediclaim.hospital")

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

def _new_public_id(prefix: str = "org") -> str:
    # 12 alphanumeric characters matching regex ^[A-Za-z0-9]{12}$
    rand = secrets.token_hex(6)
    return rand[:12]

def _get_unique_hospital_id(conn) -> str:
    for _ in range(50):
        candidate = generate_hospital_id()
        exists = conn.execute(
            "SELECT 1 FROM healthcare_organizations WHERE hospital_id = %s UNION SELECT 1 FROM users WHERE hospital_id = %s",
            (candidate, candidate)
        ).fetchone()
        if not exists:
            return candidate
    return f"HS-{secrets.randbelow(90000) + 10000}"

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

def list_organizations(
    query: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Dict[str, Any]:
    offset = (page - 1) * limit
    sql = """
        SELECT o.id, o.public_id, o.hospital_id, o.name, o.organization_type, o.registration_number,
               o.address, o.phone, o.email, o.created_at,
               COUNT(m.id) AS practitioners_count
        FROM healthcare_organizations o
        LEFT JOIN organization_memberships m ON m.organization_id = o.id AND m.is_active = true
        WHERE 1=1
    """
    params: List[Any] = []
    if query:
        sql += " AND (o.name ILIKE %s OR o.registration_number ILIKE %s OR o.hospital_id ILIKE %s)"
        like = f"%{query}%"
        params.extend([like, like, like])

    sql += " GROUP BY o.id, o.public_id, o.hospital_id, o.name, o.organization_type, o.registration_number, o.address, o.phone, o.email, o.created_at"
    sql += " ORDER BY o.created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    count_sql = "SELECT COUNT(*) FROM healthcare_organizations o WHERE 1=1"
    count_params: List[Any] = []
    if query:
        count_sql += " AND (o.name ILIKE %s OR o.registration_number ILIKE %s OR o.hospital_id ILIKE %s)"
        count_params.extend([like, like, like])

    with get_db() as conn:
        total = conn.execute(count_sql, tuple(count_params)).fetchone()["count"]
        rows = conn.execute(sql, tuple(params)).fetchall()

    orgs = [
        {
            "id": f"org_{r['id']}",
            "publicId": r["public_id"],
            "hospitalId": r.get("hospital_id"),
            "name": r["name"],
            "organizationType": r["organization_type"],
            "registrationNumber": r["registration_number"],
            "address": r["address"],
            "phone": r["phone"],
            "email": r["email"],
            "practitionersCount": r["practitioners_count"] or 0,
            "createdAt": _format_iso(r["created_at"]),
        }
        for r in rows
    ]

    return {"organizations": orgs, "total": total}

def get_organization(org_id: str) -> Dict[str, Any]:
    raw_id = org_id.replace("org-", "").replace("org_", "")
    try:
        org_uuid = str(uuid.UUID(raw_id))
        clause = "o.id = %s"
        param = org_uuid
    except ValueError:
        if raw_id.upper().startswith("HS-"):
            clause = "o.hospital_id = %s"
            param = raw_id.upper()
        else:
            clause = "o.public_id = %s"
            param = raw_id

    with get_db() as conn:
        row = conn.execute(f"""
            SELECT o.*, COUNT(m.id) AS practitioners_count
            FROM healthcare_organizations o
            LEFT JOIN organization_memberships m ON m.organization_id = o.id AND m.is_active = true
            WHERE {clause}
            GROUP BY o.id
        """, (param,)).fetchone()

        if not row:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Organization Not Found",
                detail=f"Healthcare organization '{org_id}' was not found.",
                code="RECORD_NOT_FOUND",
            )

        # Affiliated doctors
        doctors = conn.execute("""
            SELECT doc.id, doc.public_id, COALESCE(doc.doctor_id, u.doctor_id) AS doctor_id,
                   doc.registration_number, doc.specialization,
                   doc.qualification, u.full_name, u.phone, u.email, m.designation
            FROM organization_memberships m
            JOIN users u ON u.id = m.user_id
            JOIN practitioner_profiles doc ON doc.user_id = u.id
            WHERE m.organization_id = %s AND m.is_active = true
        """, (str(row["id"]),)).fetchall()

    return {
        "id": f"org_{row['id']}",
        "publicId": row["public_id"],
        "hospitalId": row.get("hospital_id"),
        "name": row["name"],
        "organizationType": row["organization_type"],
        "registrationNumber": row["registration_number"],
        "address": row["address"],
        "phone": row["phone"],
        "email": row["email"],
        "practitionersCount": row["practitioners_count"] or 0,
        "createdAt": _format_iso(row["created_at"]),
        "practitioners": [
            {
                "id": f"doc_{d['id']}",
                "publicId": d["public_id"],
                "doctorId": d.get("doctor_id"),
                "fullName": d["full_name"],
                "registrationNumber": d["registration_number"],
                "specialization": d["specialization"],
                "qualification": d["qualification"],
                "designation": d["designation"],
                "phone": d["phone"],
                "email": d["email"],
            }
            for d in doctors
        ],
    }

def create_organization(payload) -> Dict[str, Any]:
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM healthcare_organizations WHERE registration_number = %s",
            (payload.registrationNumber,)
        ).fetchone()

        if existing:
            raise APIProblemException(
                status_code=status.HTTP_409_CONFLICT,
                title="Organization Exists",
                detail=f"An organization with registration number '{payload.registrationNumber}' already exists.",
                code="RECORD_CONFLICT",
            )

        org_uuid = uuid.uuid4()
        public_id = _new_public_id("org")
        hospital_id = _get_unique_hospital_id(conn)

        conn.execute("""
            INSERT INTO healthcare_organizations (
                id, public_id, hospital_id, name, organization_type, registration_number,
                address, phone, email, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, now()
            )
        """, (
            str(org_uuid), public_id, hospital_id, payload.name, payload.organizationType,
            payload.registrationNumber, payload.address, payload.phone, payload.email
        ))

    return {
        "id": f"org_{org_uuid}",
        "publicId": public_id,
        "hospitalId": hospital_id,
        "name": payload.name,
        "organizationType": payload.organizationType,
        "registrationNumber": payload.registrationNumber,
        "address": payload.address,
        "phone": payload.phone,
        "email": payload.email,
        "practitionersCount": 0,
        "createdAt": _format_iso(datetime.now(timezone.utc)),
    }

def list_practitioners(
    organization_id: Optional[str] = None,
    specialization: Optional[str] = None,
    query: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Dict[str, Any]:
    offset = (page - 1) * limit
    sql = """
        SELECT doc.id, doc.public_id, COALESCE(doc.doctor_id, u.doctor_id) AS doctor_id,
               doc.registration_number, doc.specialization,
               doc.qualification, doc.created_at,
               u.full_name, u.phone, u.email,
               o.id AS org_id, o.public_id AS org_public_id, o.name AS org_name
        FROM practitioner_profiles doc
        JOIN users u ON u.id = doc.user_id
        LEFT JOIN organization_memberships m ON m.user_id = u.id AND m.is_active = true
        LEFT JOIN healthcare_organizations o ON o.id = m.organization_id
        WHERE 1=1
    """
    params: List[Any] = []

    if organization_id:
        clean_org = organization_id.replace("org-", "").replace("org_", "")
        try:
            org_u = str(uuid.UUID(clean_org))
            sql += " AND (o.id = %s OR o.public_id = %s)"
            params.extend([org_u, clean_org])
        except ValueError:
            sql += " AND o.public_id = %s"
            params.append(clean_org)

    if specialization:
        sql += " AND doc.specialization ILIKE %s"
        params.append(f"%{specialization}%")

    if query:
        sql += " AND (u.full_name ILIKE %s OR doc.registration_number ILIKE %s OR u.email ILIKE %s OR doc.doctor_id ILIKE %s OR u.doctor_id ILIKE %s)"
        like = f"%{query}%"
        params.extend([like, like, like, like, like])

    count_sql = f"SELECT COUNT(*) FROM ({sql}) sub"
    count_params = list(params)

    sql += " ORDER BY doc.created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    with get_db() as conn:
        total = conn.execute(count_sql, tuple(count_params)).fetchone()["count"]
        rows = conn.execute(sql, tuple(params)).fetchall()

    practitioners = []
    for r in rows:
        org_data = None
        if r.get("org_id"):
            org_data = {
                "id": f"org_{r['org_id']}",
                "publicId": r["org_public_id"],
                "name": r["org_name"],
            }
        practitioners.append({
            "id": f"doc_{r['id']}",
            "publicId": r["public_id"],
            "doctorId": r.get("doctor_id"),
            "fullName": r["full_name"],
            "registrationNumber": r["registration_number"],
            "specialization": r["specialization"],
            "qualification": r["qualification"],
            "phone": r["phone"],
            "email": r["email"],
            "organization": org_data,
            "createdAt": _format_iso(r["created_at"]),
        })

    return {"practitioners": practitioners, "total": total}

def get_practitioner(practitioner_id: str) -> Dict[str, Any]:
    clean_id = practitioner_id.replace("doc-", "").replace("doc_", "")
    try:
        doc_u = str(uuid.UUID(clean_id))
        clause = "doc.id = %s"
        param = doc_u
    except ValueError:
        if clean_id.upper().startswith("DR-"):
            clause = "(doc.doctor_id = %s OR u.doctor_id = %s)"
            param = clean_id.upper()
        else:
            clause = "doc.public_id = %s"
            param = clean_id

    with get_db() as conn:
        query_params = (param, param) if clause.startswith("(doc.doctor_id") else (param,)
        r = conn.execute(f"""
            SELECT doc.*, COALESCE(doc.doctor_id, u.doctor_id) AS resolved_doctor_id,
                   u.full_name, u.phone, u.email,
                   o.id AS org_id, o.public_id AS org_public_id, o.name AS org_name
            FROM practitioner_profiles doc
            JOIN users u ON u.id = doc.user_id
            LEFT JOIN organization_memberships m ON m.user_id = u.id AND m.is_active = true
            LEFT JOIN healthcare_organizations o ON o.id = m.organization_id
            WHERE {clause}
        """, query_params).fetchone()

        if not r:
            raise APIProblemException(
                status_code=status.HTTP_404_NOT_FOUND,
                title="Practitioner Not Found",
                detail=f"Practitioner profile '{practitioner_id}' was not found.",
                code="RECORD_NOT_FOUND",
            )

    org_data = None
    if r.get("org_id"):
        org_data = {
            "id": f"org_{r['org_id']}",
            "publicId": r["org_public_id"],
            "name": r["org_name"],
        }

    return {
        "id": f"doc_{r['id']}",
        "publicId": r["public_id"],
        "doctorId": r.get("resolved_doctor_id") or r.get("doctor_id"),
        "fullName": r["full_name"],
        "registrationNumber": r["registration_number"],
        "specialization": r["specialization"],
        "qualification": r["qualification"],
        "phone": r["phone"],
        "email": r["email"],
        "organization": org_data,
        "createdAt": _format_iso(r["created_at"]),
    }

def create_practitioner(payload, creator_user_id: Optional[str] = None) -> Dict[str, Any]:
    with get_db() as conn:
        # Check phone conflict
        existing_phone = conn.execute(
            "SELECT id FROM users WHERE phone = %s",
            (payload.phone,)
        ).fetchone()
        if existing_phone:
            raise APIProblemException(
                status_code=status.HTTP_409_CONFLICT,
                title="Account Already Exists",
                detail=f"A user with phone number '{payload.phone}' already exists.",
                code="ACCOUNT_ALREADY_EXISTS",
            )

        # Check license conflict
        existing_lic = conn.execute(
            "SELECT id FROM practitioner_profiles WHERE registration_number = %s",
            (payload.registrationNumber,)
        ).fetchone()
        if existing_lic:
            raise APIProblemException(
                status_code=status.HTTP_409_CONFLICT,
                title="License Already Registered",
                detail=f"Practitioner license registration '{payload.registrationNumber}' is already registered.",
                code="RECORD_CONFLICT",
            )

        # Verify organization if provided
        org_uuid = None
        org_data = None
        if payload.organizationId:
            clean_org = payload.organizationId.replace("org-", "").replace("org_", "")
            try:
                org_u = str(uuid.UUID(clean_org))
                org_row = conn.execute(
                    "SELECT id, public_id, name FROM healthcare_organizations WHERE id = %s",
                    (org_u,)
                ).fetchone()
            except ValueError:
                org_row = conn.execute(
                    "SELECT id, public_id, name FROM healthcare_organizations WHERE public_id = %s",
                    (clean_org,)
                ).fetchone()

            if not org_row:
                raise APIProblemException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    title="Organization Not Found",
                    detail=f"Organization '{payload.organizationId}' was not found.",
                    code="RECORD_NOT_FOUND",
                )
            org_uuid = str(org_row["id"])
            org_data = {
                "id": f"org_{org_row['id']}",
                "publicId": org_row["public_id"],
                "name": org_row["name"],
            }

        user_uuid = uuid.uuid4()
        user_public_id = _new_public_id("usr")
        doc_uuid = uuid.uuid4()
        doc_public_id = _new_public_id("doc")
        doc_id = _get_unique_doctor_id(conn)
        pwd_hash = hash_password(payload.password)

        # Create user
        conn.execute("""
            INSERT INTO users (
                id, public_id, doctor_id, full_name, email, phone, password_hash,
                admin_verified, profile_complete, is_active, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                true, true, true, now(), now()
            )
        """, (
            str(user_uuid), user_public_id, doc_id, payload.fullName,
            payload.email, payload.phone, pwd_hash
        ))

        # Assign role
        conn.execute("""
            INSERT INTO user_roles (id, user_id, role, created_at)
            VALUES (gen_random_uuid(), %s, 'doctor', now())
        """, (str(user_uuid),))

        # Create practitioner profile
        conn.execute("""
            INSERT INTO practitioner_profiles (
                id, public_id, doctor_id, user_id, registration_number, specialization,
                qualification, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, now()
            )
        """, (
            str(doc_uuid), doc_public_id, doc_id, str(user_uuid),
            payload.registrationNumber, payload.specialization, payload.qualification
        ))

        # Affiliate with organization
        if org_uuid:
            conn.execute("""
                INSERT INTO organization_memberships (
                    id, organization_id, user_id, designation, is_active, created_at
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s, true, now()
                )
            """, (org_uuid, str(user_uuid), payload.designation or "Consultant"))

    # Audit logging
    record_audit(
        actor_user_id=creator_user_id,
        patient_id=None,
        action="onboard_practitioner",
        what=f"Onboarded practitioner {payload.fullName} ({payload.registrationNumber}) with ID {doc_id}",
        actor_name="Hospital Administrator",
        actor_role="admin",
        resource_kinds=["practitioner"],
        outcome="success",
        resource_table="practitioner_profiles",
        resource_id=str(doc_uuid),
    )

    return {
        "id": f"doc_{doc_uuid}",
        "publicId": doc_public_id,
        "doctorId": doc_id,
        "fullName": payload.fullName,
        "registrationNumber": payload.registrationNumber,
        "specialization": payload.specialization,
        "qualification": payload.qualification,
        "phone": payload.phone,
        "email": payload.email,
        "organization": org_data,
        "createdAt": _format_iso(datetime.now(timezone.utc)),
    }


def register_hospital(payload) -> Dict[str, Any]:
    with get_db() as conn:
        clean_reg = payload.registrationNumber.strip()
        clean_phone = payload.phone.strip()
        clean_email = payload.email.strip()

        # Check registration number uniqueness in healthcare_organizations
        existing_reg = conn.execute(
            "SELECT id FROM healthcare_organizations WHERE registration_number = %s",
            (clean_reg,)
        ).fetchone()
        if existing_reg:
            raise APIProblemException(
                status_code=status.HTTP_409_CONFLICT,
                title="Organization Exists",
                detail=f"An organization with registration number '{clean_reg}' already exists.",
                code="RECORD_CONFLICT",
            )

        # Check phone and email uniqueness in users
        existing_user = conn.execute(
            "SELECT id FROM users WHERE phone = %s OR email ILIKE %s",
            (clean_phone, clean_email)
        ).fetchone()
        if existing_user:
            raise APIProblemException(
                status_code=status.HTTP_409_CONFLICT,
                title="Account Already Exists",
                detail="A user with this phone number or email address already exists.",
                code="ACCOUNT_ALREADY_EXISTS",
            )

        org_uuid = uuid.uuid4()
        user_uuid = uuid.uuid4()
        org_pub = _new_public_id("org")
        user_pub = secrets.token_hex(6)[:12]
        hospital_id = _get_unique_hospital_id(conn)

        # Insert user as hospital admin (admin_verified=false until administrator approval)
        conn.execute("""
            INSERT INTO users (
                id, public_id, hospital_id, full_name, email, phone, password_hash,
                admin_verified, profile_complete, is_active, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                false, true, true, now(), now()
            )
        """, (
            str(user_uuid), user_pub, hospital_id, payload.name.strip(), clean_email,
            clean_phone, hash_password(payload.password)
        ))

        # Insert user_roles
        conn.execute("""
            INSERT INTO user_roles (user_id, role)
            VALUES (%s, 'hospital_admin')
            ON CONFLICT (user_id, role) DO NOTHING
        """, (str(user_uuid),))

        # Insert healthcare_organizations
        conn.execute("""
            INSERT INTO healthcare_organizations (
                id, public_id, hospital_id, name, organization_type, registration_number,
                address, phone, email, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, now()
            )
        """, (
            str(org_uuid), org_pub, hospital_id, payload.name.strip(), payload.type or "hospital",
            clean_reg, payload.address, clean_phone, clean_email
        ))

        # Insert organization membership
        conn.execute("""
            INSERT INTO organization_memberships (
                organization_id, user_id, designation, is_active, created_at
            ) VALUES (%s, %s, 'Administrator', true, now())
            ON CONFLICT (organization_id, user_id) DO NOTHING
        """, (str(org_uuid), str(user_uuid)))

    return {
        "orgId": f"org_{org_uuid}",
        "hospitalId": hospital_id,
        "message": "Healthcare organization registered successfully. Awaiting administrator verification.",
    }


def hospital_request_otp(payload) -> Dict[str, Any]:
    now = int(time.time())
    otp = generate_otp()

    with get_db() as conn:
        if getattr(payload, "hospitalId", None) and payload.hospitalId.strip():
            clean_hosp = normalize_hospital_id(payload.hospitalId)
            user = conn.execute("""
                SELECT u.id, u.phone, u.email, u.full_name, u.admin_verified,
                       COALESCE(u.hospital_id, ho.hospital_id) AS hospital_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
                LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
                WHERE (u.hospital_id = %s OR ho.hospital_id = %s)
                  AND ur.role IN ('hospital_admin', 'organization')
                LIMIT 1
            """, (clean_hosp, clean_hosp)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail=f"No organization account found for Hospital ID '{payload.hospitalId}'.",
                    code="INVALID_CREDENTIALS",
                )
        elif getattr(payload, "email", None) and payload.email.strip():
            clean_email = payload.email.strip()
            user = conn.execute("""
                SELECT u.id, u.phone, u.email, u.full_name, u.admin_verified,
                       COALESCE(u.hospital_id, ho.hospital_id) AS hospital_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
                LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
                WHERE u.email ILIKE %s
                  AND ur.role IN ('hospital_admin', 'organization')
                LIMIT 1
            """, (clean_email,)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail=f"No organization account found for email '{payload.email}'.",
                    code="INVALID_CREDENTIALS",
                )
        elif getattr(payload, "phone", None) and payload.phone.strip():
            clean_phone = payload.phone.strip()
            alt_phone = f"+91{clean_phone.replace('+91', '').strip()}"
            user = conn.execute("""
                SELECT u.id, u.phone, u.email, u.full_name, u.admin_verified,
                       COALESCE(u.hospital_id, ho.hospital_id) AS hospital_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
                LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
                WHERE (u.phone = %s OR u.phone = %s)
                  AND ur.role IN ('hospital_admin', 'organization')
                LIMIT 1
            """, (clean_phone, alt_phone)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail="No organization account found for this phone number.",
                    code="INVALID_CREDENTIALS",
                )
        else:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Missing Identifier",
                detail="Hospital ID (HS-XXXX), email address, or phone number is required.",
                code="BAD_REQUEST",
            )

        conn.execute("""
            UPDATE users
            SET otp_hash = %s, otp_expires_at = %s, otp_attempts = 0, updated_at = now()
            WHERE id = %s
        """, (hash_otp(otp), now + OTP_SECONDS, str(user["id"])))

    if OTP_DEBUG:
        logger.info("[DEV ONLY] Hospital Login OTP for %s: %s", user["phone"], otp)
        print(f"[DEV ONLY] Hospital Login OTP for {user['phone']}: {otp}")

    return {
        "maskedPhone": _mask_phone(user["phone"]),
        "otpExpiresInSeconds": OTP_SECONDS,
        "debugOtp": otp if OTP_DEBUG else None,
    }


def hospital_verify_otp(payload) -> Dict[str, Any]:
    now = int(time.time())

    with get_db() as conn:
        if getattr(payload, "hospitalId", None) and payload.hospitalId.strip():
            clean_hosp = normalize_hospital_id(payload.hospitalId)
            user = conn.execute("""
                SELECT u.*,
                       COALESCE(u.hospital_id, ho.hospital_id) AS resolved_hospital_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
                LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
                WHERE (u.hospital_id = %s OR ho.hospital_id = %s)
                  AND ur.role IN ('hospital_admin', 'organization')
                LIMIT 1
            """, (clean_hosp, clean_hosp)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail=f"No organization account found for Hospital ID '{payload.hospitalId}'.",
                    code="INVALID_CREDENTIALS",
                )
        elif getattr(payload, "email", None) and payload.email.strip():
            clean_email = payload.email.strip()
            user = conn.execute("""
                SELECT u.*,
                       COALESCE(u.hospital_id, ho.hospital_id) AS resolved_hospital_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
                LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
                WHERE u.email ILIKE %s
                  AND ur.role IN ('hospital_admin', 'organization')
                LIMIT 1
            """, (clean_email,)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail=f"No organization account found for email '{payload.email}'.",
                    code="INVALID_CREDENTIALS",
                )
        elif getattr(payload, "phone", None) and payload.phone.strip():
            clean_phone = payload.phone.strip()
            alt_phone = f"+91{clean_phone.replace('+91', '').strip()}"
            user = conn.execute("""
                SELECT u.*,
                       COALESCE(u.hospital_id, ho.hospital_id) AS resolved_hospital_id
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
                LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
                WHERE (u.phone = %s OR u.phone = %s)
                  AND ur.role IN ('hospital_admin', 'organization')
                LIMIT 1
            """, (clean_phone, alt_phone)).fetchone()
            if not user:
                raise APIProblemException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    title="Account Not Found",
                    detail="No organization account found for this phone number.",
                    code="INVALID_CREDENTIALS",
                )
        else:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Missing Identifier",
                detail="Hospital ID (HS-XXXX), email address, or phone number is required.",
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
            detail="Your organization account is awaiting administrator verification.",
            code="ACCOUNT_PENDING_APPROVAL",
        )

    formatted_user_id = f"usr_{user['id']}"
    token = create_access_token(formatted_user_id, role="hospital_admin")
    hosp_id_val = user.get("resolved_hospital_id") or user.get("hospital_id")

    return {
        "accessToken": token,
        "tokenType": "Bearer",
        "expiresIn": ACCESS_TOKEN_SECONDS,
        "user": {
            "id": formatted_user_id,
            "fullName": user["full_name"],
            "email": user.get("email"),
            "phone": user["phone"],
            "role": "hospital_admin",
            "hospitalId": hosp_id_val,
            "mediclaimId": None,
            "isActive": bool(user["is_active"]),
            "adminVerified": bool(user["admin_verified"]),
            "isProfileComplete": bool(user["profile_complete"]),
        }
    }


def login_hospital(payload) -> Dict[str, Any]:
    if getattr(payload, "otp", None) and (getattr(payload, "hospitalId", None) or getattr(payload, "email", None) or getattr(payload, "phone", None)):
        return hospital_verify_otp(payload)

    with get_db() as conn:
        if getattr(payload, "hospitalId", None) and payload.hospitalId.strip():
            clean_h = normalize_hospital_id(payload.hospitalId)
            clause = "(u.hospital_id = %s OR ho.hospital_id = %s)"
            query_params: tuple = (clean_h, clean_h)
        elif payload.email:
            clause = "u.email ILIKE %s"
            query_params = (payload.email.strip(),)
        elif payload.phone:
            clean_p = payload.phone.strip()
            alt_p = f"+91{clean_p.replace('+91', '').strip()}"
            clause = "(u.phone = %s OR u.phone = %s)"
            query_params = (clean_p, alt_p)
        elif getattr(payload, "username", None) and payload.username.strip():
            u_name = payload.username.strip()
            if u_name.upper().startswith("HS-"):
                clean_h = normalize_hospital_id(u_name)
                clause = "(u.hospital_id = %s OR ho.hospital_id = %s)"
                query_params = (clean_h, clean_h)
            else:
                clause = "(u.email ILIKE %s OR u.phone = %s)"
                query_params = (u_name, u_name)
        else:
            raise APIProblemException(
                status_code=status.HTTP_400_BAD_REQUEST,
                title="Missing Identifier",
                detail="Hospital ID (HS-XXXX), email address, or phone number is required.",
                code="BAD_REQUEST",
            )

        user = conn.execute(f"""
            SELECT u.*,
                   COALESCE(u.hospital_id, ho.hospital_id) AS resolved_hospital_id
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.is_active = true
            LEFT JOIN healthcare_organizations ho ON ho.id = om.organization_id
            WHERE {clause}
              AND ur.role IN ('hospital_admin', 'organization', 'admin')
            LIMIT 1
        """, query_params).fetchone()

        if not user:
            raise APIProblemException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                title="Invalid Credentials",
                detail="Invalid organization credentials.",
                code="INVALID_CREDENTIALS",
            )

        if not payload.password or not verify_password(payload.password, user["password_hash"]):
            raise APIProblemException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                title="Invalid Credentials",
                detail="Invalid organization password.",
                code="INVALID_CREDENTIALS",
            )

    if not user.get("admin_verified"):
        raise APIProblemException(
            status_code=status.HTTP_403_FORBIDDEN,
            title="Account Pending Verification",
            detail="Your organization account is awaiting administrator verification.",
            code="ACCOUNT_PENDING_APPROVAL",
        )

    formatted_user_id = f"usr_{user['id']}"
    token = create_access_token(formatted_user_id, role="hospital_admin")
    hosp_id_val = user.get("resolved_hospital_id") or user.get("hospital_id")

    return {
        "accessToken": token,
        "tokenType": "Bearer",
        "expiresIn": ACCESS_TOKEN_SECONDS,
        "user": {
            "id": formatted_user_id,
            "fullName": user["full_name"],
            "email": user.get("email"),
            "phone": user["phone"],
            "role": "hospital_admin",
            "hospitalId": hosp_id_val,
            "mediclaimId": None,
            "isActive": bool(user["is_active"]),
            "adminVerified": bool(user["admin_verified"]),
            "isProfileComplete": bool(user["profile_complete"]),
        }
    }
