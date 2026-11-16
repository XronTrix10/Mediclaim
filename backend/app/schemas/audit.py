from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel
from app.schemas.auth import EnvelopeMeta

AuditActionType = Literal[
    "view", "upload", "revoke", "approve", "grant", "correction", "emergency"
]

class AuditLogEntry(BaseModel):
    id: str
    actorId: Optional[str] = None
    who: str
    actorRole: str
    action: str
    what: str
    resourceKinds: Optional[List[str]] = None
    occurredAt: str
    outcome: str = "success"

class AuditLogsResponse(BaseModel):
    status: str = "success"
    data: List[AuditLogEntry]
    meta: EnvelopeMeta
