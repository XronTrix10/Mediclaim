import hashlib
import hmac
import logging
import secrets
import time
import uuid
from typing import Any, Callable, Dict, List, Optional, Union
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from pwdlib import PasswordHash
from app.config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_SECONDS
from app.exceptions import APIProblemException
from app.database import get_db

logger = logging.getLogger("mediclaim.security")

_password_hash = PasswordHash.recommended()
security_bearer = HTTPBearer(auto_error=False)

# --- Verhoeff Check Digit Implementation ---
_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

_VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]


def verhoeff_calc_check_digit(number_str: str) -> str:
    c = 0
    reversed_digits = [int(ch) for ch in reversed(number_str)]
    for i, digit in enumerate(reversed_digits):
        c = _VERHOEFF_D[c][_VERHOEFF_P[(i + 1) % 8][digit]]
    return str(_VERHOEFF_INV[c])


def verhoeff_validate(number_str: str) -> bool:
    clean = normalize_mediclaim_id(number_str)
    if len(clean) != 12 or not clean.isdigit():
        return False
    c = 0
    reversed_digits = [int(ch) for ch in reversed(clean)]
    for i, digit in enumerate(reversed_digits):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][digit]]
    return c == 0


def generate_mediclaim_id() -> str:
    """Generates an independent 12-digit Mediclaim ID with Verhoeff check-digit."""
    # 11 random digits with non-zero start
    base = str(secrets.randbelow(900_000_000_00) + 100_000_000_00)
    check_digit = verhoeff_calc_check_digit(base)
    return f"{base}{check_digit}"


def format_mediclaim_id(val: str) -> str:
    """Formats 12-digit string into 'XXXX XXXX XXXX'."""
    clean = normalize_mediclaim_id(val)
    if len(clean) == 12:
        return f"{clean[:4]} {clean[4:8]} {clean[8:]}"
    return val


def normalize_mediclaim_id(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


# --- Password & OTP ---
def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        return _password_hash.verify(password, encoded_hash)
    except Exception:
        return False


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def verify_otp(otp: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(otp), expected_hash)


# --- JWT Tokens ---
def create_access_token(
    user_id: str,
    role: str = "patient",
    grant_id: Optional[str] = None,
    expires_in_seconds: Optional[int] = None,
) -> str:
    now = int(time.time())
    ttl = expires_in_seconds if expires_in_seconds is not None else ACCESS_TOKEN_SECONDS
    payload: Dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + ttl,
    }
    if grant_id:
        payload["grt"] = grant_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return {}


# --- Authentication & Authorization Dependencies ---
class AuthenticatedUser:
    def __init__(
        self,
        id: str,
        raw_uuid: str,
        public_id: str,
        mediclaim_id: Optional[str],
        full_name: str,
        email: Optional[str],
        phone: str,
        roles: List[str],
        is_active: bool,
        admin_verified: bool,
        profile_complete: bool,
        patient_profile_id: Optional[str] = None,
        practitioner_profile_id: Optional[str] = None,
        active_grant_id: Optional[str] = None,
        token_role: Optional[str] = None,
    ):
        self.id = id
        self.raw_uuid = raw_uuid
        self.public_id = public_id
        self.mediclaim_id = mediclaim_id
        self.full_name = full_name
        self.email = email
        self.phone = phone
        self.roles = roles
        self.is_active = is_active
        self.admin_verified = admin_verified
        self.profile_complete = profile_complete
        self.patient_profile_id = patient_profile_id
        self.practitioner_profile_id = practitioner_profile_id
        self.active_grant_id = active_grant_id
        self.token_role = token_role

    def has_role(self, *target_roles: str) -> bool:
        return any(r in self.roles for r in target_roles) or (self.token_role in target_roles)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
) -> AuthenticatedUser:
    if not credentials or not credentials.credentials:
        raise APIProblemException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            title="Authentication Required",
            detail="Missing or malformed Authorization header. Bearer token required.",
            code="INVALID_CREDENTIALS",
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise APIProblemException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            title="Invalid Credentials",
            detail="Authentication token is invalid or has expired.",
            code="INVALID_CREDENTIALS",
        )

    user_sub = payload["sub"]
    raw_user_id = user_sub.replace("usr-", "").replace("usr_", "")
    try:
        user_uuid = str(uuid.UUID(raw_user_id))
    except (ValueError, AttributeError):
        raise APIProblemException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            title="Invalid Credentials",
            detail="Token subject is not a valid user identifier.",
            code="INVALID_CREDENTIALS",
        )

    with get_db() as conn:
        user_row = conn.execute("""
            SELECT u.*,
                   p.id AS patient_profile_id,
                   p.public_id AS patient_public_id,
                   doc.id AS practitioner_profile_id
            FROM users u
            LEFT JOIN patient_profiles p ON p.user_id = u.id
            LEFT JOIN practitioner_profiles doc ON doc.user_id = u.id
            WHERE u.id = %s
        """, (user_uuid,)).fetchone()

        if not user_row:
            raise APIProblemException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                title="User Not Found",
                detail="User account associated with this token no longer exists.",
                code="INVALID_CREDENTIALS",
            )

        if not user_row["is_active"]:
            raise APIProblemException(
                status_code=status.HTTP_403_FORBIDDEN,
                title="Account Inactive",
                detail="User account has been deactivated or suspended.",
                code="ACCOUNT_INACTIVE",
            )

        # Retrieve all assigned roles
        roles_rows = conn.execute(
            "SELECT role FROM user_roles WHERE user_id = %s", (user_uuid,)
        ).fetchall()
        roles = [r["role"] for r in roles_rows]
        if not roles and payload.get("role"):
            roles = [payload["role"]]

        # If token was issued under a specific doctor grant, verify the grant status in real-time
        grant_id = payload.get("grt")
        if grant_id:
            raw_grant_id = grant_id.replace("grt_", "").replace("grt-", "")
            try:
                grant_uuid = str(uuid.UUID(raw_grant_id))
            except ValueError:
                grant_uuid = None

            if grant_uuid:
                grant = conn.execute("""
                    SELECT status, expires_at FROM patient_access_grants
                    WHERE id = %s
                """, (grant_uuid,)).fetchone()
            else:
                grant = None

            if not grant or grant["status"] == "revoked":
                raise APIProblemException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    title="Consent Revoked",
                    detail="Doctor access session was explicitly revoked by the patient.",
                    code="CONSENT_REVOKED",
                )

            if grant["status"] != "active":
                raise APIProblemException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    title="Consent Inactive",
                    detail="Doctor access session is no longer active.",
                    code="CONSENT_EXPIRED",
                )

    formatted_id = f"usr_{user_row['id']}"
    return AuthenticatedUser(
        id=formatted_id,
        raw_uuid=str(user_row["id"]),
        public_id=user_row["public_id"],
        mediclaimId=user_row["mediclaim_id"],
        full_name=user_row["full_name"],
        email=user_row.get("email"),
        phone=user_row["phone"],
        roles=roles,
        is_active=bool(user_row["is_active"]),
        admin_verified=bool(user_row["admin_verified"]),
        profile_complete=bool(user_row["profile_complete"]),
        patient_profile_id=str(user_row["patient_profile_id"]) if user_row.get("patient_profile_id") else None,
        practitioner_profile_id=str(user_row["practitioner_profile_id"]) if user_row.get("practitioner_profile_id") else None,
        active_grant_id=grant_id,
        token_role=payload.get("role"),
    )


def require_role(*permitted_roles: str) -> Callable:
    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if not any(user.has_role(r) for r in permitted_roles):
            raise APIProblemException(
                status_code=status.HTTP_403_FORBIDDEN,
                title="Unauthorized Role",
                detail=f"This operation requires one of the following roles: {', '.join(permitted_roles)}.",
                code="ROLE_UNAUTHORIZED",
            )
        return user
    return role_checker
