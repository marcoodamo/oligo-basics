from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.repositories.processing_logs import ProcessingLogRepository
from app.schemas.processing_log import ProcessingLogResponse

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("", response_model=List[ProcessingLogResponse])
def list_logs(
    status: Optional[str] = None,
    model: Optional[str] = None,
    filename: Optional[str] = None,
    company: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    repo = ProcessingLogRepository()
    logs = repo.list_logs(
        status=status,
        model_name=model,
        filename=filename,
        company_name=company,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return [ProcessingLogResponse(**log.__dict__) for log in logs]


@router.get("/{log_id}", response_model=ProcessingLogResponse)
def get_log(log_id: str):
    repo = ProcessingLogRepository()
    log = repo.get_log(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return ProcessingLogResponse(**log.__dict__)
