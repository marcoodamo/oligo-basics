from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ProcessingLogResponse(BaseModel):
    id: str
    document_id: Optional[str] = None
    filename: Optional[str] = None
    hash_sha256: Optional[str] = None
    company_name: Optional[str] = None
    model_name: Optional[str] = None
    model_confidence: Optional[float] = None
    parser_version: Optional[str] = None
    status: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_ms: Optional[int] = None
    warnings_count: int = 0
    errors_count: int = 0
    error_summary: Optional[str] = None
    correlation_id: Optional[str] = None
    triggered_by: Optional[str] = None
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)
