import os
from pathlib import Path
from typing import Optional
from app.config import STORAGE_DIR


def _resolve_safe_path(storage_key: str) -> Path:
    base = Path(STORAGE_DIR).resolve()
    base.mkdir(parents=True, exist_ok=True)
    # Strip leading slashes and prevent directory traversal
    clean_key = storage_key.lstrip("/\\")
    target = (base / clean_key).resolve()
    if base != target and base not in target.parents:
        raise ValueError(f"Invalid storage key path: {storage_key}")
    return target


def save_document_bytes(storage_key: str, content_bytes: bytes) -> str:
    """Persist uploaded document bytes under STORAGE_DIR and return resolved path."""
    target = _resolve_safe_path(storage_key)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content_bytes)
    return str(target)


def read_document_bytes(storage_key: str) -> Optional[bytes]:
    """Read persisted document bytes if present on disk, else None."""
    try:
        target = _resolve_safe_path(storage_key)
    except ValueError:
        return None
    if not target.is_file():
        return None
    return target.read_bytes()


def delete_document_bytes(storage_key: str) -> bool:
    """Delete a persisted document file if it exists."""
    try:
        target = _resolve_safe_path(storage_key)
    except ValueError:
        return False
    if target.is_file():
        os.remove(target)
        return True
    return False


def delete_patient_storage(patient_id: str) -> bool:
    """Recursively delete the storage directory and all uploaded files for the patient."""
    if not patient_id:
        return False
    clean_id = patient_id.replace("pat-", "").replace("pat_", "").strip()
    base = Path(STORAGE_DIR).resolve()
    target_dir = (base / "documents" / clean_id).resolve()
    if target_dir.exists() and target_dir.is_dir() and base in target_dir.parents:
        import shutil
        shutil.rmtree(target_dir, ignore_errors=True)
        return True
    return False
