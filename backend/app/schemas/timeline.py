from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from app.schemas.auth import EnvelopeMeta
from app.schemas.records import KindType, RecordStatusType

class TimelineEvent(BaseModel):
    id: str
    kind: KindType
    title: str
    short: Optional[str] = None
    detail: str
    date: str
    provider: str
    ageAtEventMonths: Optional[int] = None
    status: Optional[RecordStatusType] = "active"

class TimelineData(BaseModel):
    patientId: str
    dob: str
    totalEvents: int
    events: List[TimelineEvent]

class TimelineResponse(BaseModel):
    status: str = "success"
    data: TimelineData
    meta: EnvelopeMeta

class GraphCenter(BaseModel):
    patientName: str
    birthYear: str

class GraphNode(BaseModel):
    id: str
    kind: str
    label: str
    status: Optional[str] = "active"

class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str

class GraphBranch(BaseModel):
    kind: str
    categoryLabel: str
    total: int
    nodes: Optional[List[GraphNode]] = None

class GraphData(BaseModel):
    center: GraphCenter
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    branches: List[GraphBranch]

class GraphResponse(BaseModel):
    status: str = "success"
    data: GraphData
    meta: Optional[EnvelopeMeta] = None
