import hashlib
import hmac
import secrets
import time
import jwt
from pwdlib import PasswordHash
from app.config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_SECONDS

_password_hash = PasswordHash.recommended()

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

def normalize_mediclaim_id(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())

def create_access_token(user_id: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "role": "patient",
        "iat": now,
        "exp": now + ACCESS_TOKEN_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
