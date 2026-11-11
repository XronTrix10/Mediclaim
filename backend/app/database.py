import logging
import time
from contextlib import contextmanager
from typing import Any, Optional, Union
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool
from app.config import DATABASE_URL

logger = logging.getLogger("mediclaim.database")

_pool: Optional[ThreadedConnectionPool] = None


def get_pool(max_retries: int = 5, retry_interval: float = 2.0) -> ThreadedConnectionPool:
    global _pool
    if _pool is not None and not _pool.closed:
        return _pool

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            logger.info("Connecting to PostgreSQL (attempt %d/%d)...", attempt, max_retries)
            _pool = ThreadedConnectionPool(
                minconn=1,
                maxconn=20,
                dsn=DATABASE_URL,
            )
            logger.info("Connected to PostgreSQL successfully.")
            return _pool
        except Exception as exc:
            last_error = exc
            logger.warning(
                "PostgreSQL connection attempt %d/%d failed: %s. Retrying in %.1fs...",
                attempt,
                max_retries,
                exc,
                retry_interval,
            )
            time.sleep(retry_interval)

    raise RuntimeError(
        f"Could not connect to PostgreSQL at {DATABASE_URL} after {max_retries} attempts: {last_error}"
    )


def close_pool() -> None:
    global _pool
    if _pool is not None and not _pool.closed:
        _pool.closeall()
        _pool = None
        logger.info("Closed PostgreSQL connection pool.")


class DBConnection:
    """Wrapper around a psycopg2 connection providing dict rows and convenient execute."""

    def __init__(self, raw_conn: Any):
        self._conn = raw_conn

    def execute(self, query: str, params: Optional[Union[tuple, list, dict]] = None) -> RealDictCursor:
        """Executes a query and returns a RealDictCursor. Converts SQLite-style '?' placeholders to '%s'."""
        cur = self._conn.cursor(cursor_factory=RealDictCursor)
        if params is not None and "?" in query:
            query = query.replace("?", "%s")
        cur.execute(query, params)
        return cur

    def cursor(self, cursor_factory=RealDictCursor) -> RealDictCursor:
        return self._conn.cursor(cursor_factory=cursor_factory)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()


@contextmanager
def get_db():
    """Context manager for acquiring and releasing a connection from the pool with automatic commit/rollback."""
    pool = get_pool()
    conn = pool.getconn()
    try:
        wrapper = DBConnection(conn)
        yield wrapper
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def init_db() -> None:
    """Ensures database extensions and baseline tables/columns exist."""
    with get_db() as conn:
        # Enable pgcrypto for UUIDs / cryptography
        conn.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

        # Ensure users table exists with all required authentication and profile fields
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                public_id varchar(12) NOT NULL UNIQUE,
                mediclaim_id varchar(12) UNIQUE,
                full_name varchar(200) NOT NULL,
                email varchar(255) UNIQUE,
                phone varchar(20) NOT NULL UNIQUE,
                aadhaar_number varchar(12) UNIQUE,
                password_hash varchar(255) NOT NULL,
                admin_verified boolean NOT NULL DEFAULT false,
                profile_complete boolean NOT NULL DEFAULT false,
                otp_hash text,
                otp_expires_at bigint,
                otp_attempts integer NOT NULL DEFAULT 0,
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        """)

        # Add columns if migrating from an existing schema
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS mediclaim_id varchar(12) UNIQUE;")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_number varchar(12) UNIQUE;")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_verified boolean NOT NULL DEFAULT false;")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete boolean NOT NULL DEFAULT false;")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_hash text;")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at bigint;")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts integer NOT NULL DEFAULT 0;")

        # Ensure user_roles table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_roles (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role varchar(30) NOT NULL,
                created_at timestamp NOT NULL DEFAULT now(),
                UNIQUE (user_id, role)
            );
        """)

        # Ensure patient_profiles table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS patient_profiles (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                public_id varchar(12) NOT NULL UNIQUE,
                user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                date_of_birth date NOT NULL,
                blood_group varchar(5),
                gender varchar(30),
                emergency_contact_name varchar(200),
                emergency_contact_phone varchar(20),
                created_at timestamp NOT NULL DEFAULT now(),
                updated_at timestamp NOT NULL DEFAULT now()
            );
        """)

    logger.info("PostgreSQL database initialized and verified.")
