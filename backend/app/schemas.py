from enum import StrEnum
from pydantic import BaseModel, Field


class Category(StrEnum):
    POTHOLE = "pothole"
    FLOODING = "flooding"
    WASTE = "waste"
    STREETLIGHT = "streetlight"
    OBSTRUCTION = "obstruction"
    OTHER = "other"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ReportAnalysis(BaseModel):
    category: Category
    severity: int = Field(ge=1, le=5)
    confidence: float = Field(ge=0, le=1)
    summary: str = Field(min_length=5, max_length=500)
    recommendation: str = Field(min_length=5, max_length=1000)
    priority: Priority
    estimated_impact: str = Field(min_length=3, max_length=500)
    evidence: list[str] = Field(default_factory=list, max_length=8)
    uncertainty: list[str] = Field(default_factory=list, max_length=8)


class AnalyzeResponse(BaseModel):
    report_id: str
    analysis: ReportAnalysis
    persisted: bool
    access_token: str | None = None


class CitizenStatusHistoryItem(BaseModel):
    status: str
    note: str | None = None
    created_at: str


class CitizenStatusResponse(BaseModel):
    status: str
    summary: str | None = None
    history: list[CitizenStatusHistoryItem]


class CitizenStatusRequest(BaseModel):
    report_id: str = Field(min_length=1, max_length=64)
    token: str = Field(min_length=1, max_length=128)
