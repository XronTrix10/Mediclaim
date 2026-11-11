import sqlite3
from contextlib import contextmanager
from pathlib import Path
from app.config import DATABASE_PATH

def _connect():
    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

@contextmanager
def get_db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            date_of_birth TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            aadhaar_number TEXT NOT NULL UNIQUE,
            mediclaim_id TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            admin_verified INTEGER NOT NULL DEFAULT 0,
            profile_complete INTEGER NOT NULL DEFAULT 0,
            otp_hash TEXT,
            otp_expires_at INTEGER,
            otp_attempts INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )
        """)
