from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.auth import EnvelopeMeta

class CorrectionRequestInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recordId: str
    recordTitle: str
    reason: str = Field(min_length=5, max_length=1000)
    proposedCorrection: Optional[Dict[str, Any]] = None
    proposed: Optional[str] = None

class CorrectionReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["approved", "rejected"]
    reviewNotes: Optional[str] = Field(default=None, max_length=1000)

class CorrectionRequest(BaseModel):
    id: str
    recordId: str
    recordTitle: str
    reason: str
    proposed: Optional[str] = None
    proposedCorrection: Optional[Dict[str, Any]] = None
    correctionStatus: str = "under_review"
    createdAt: str
    reviewedAt: Optional[str] = None
    reviewNotes: Optional[str] = None
    patientId: Optional[str] = None
    patientName: Optional[str] = None
    patientMediclaimId: Optional[str] = None
    requestedByName: Optional[str] = None

class CorrectionRequestsResponse(BaseModel):
    status: str = "success"
    data: List[CorrectionRequest]
    meta: Optional[EnvelopeMeta] = None

class CorrectionDetailResponse(BaseModel):
    status: str = "success"
    data: CorrectionRequest
    meta: Optional[EnvelopeMeta] = None
