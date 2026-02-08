from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response

from app.repositories.parsed_documents import ParsedDocumentRepository

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/{document_id}/parsed")
def get_parsed_document(document_id: str):
    repo = ParsedDocumentRepository()
    parsed = repo.get(document_id)
    if not parsed:
        raise HTTPException(status_code=404, detail="Parsed document not found")
    return JSONResponse(content=parsed.canonical)


@router.get("/{document_id}/parsed/download")
def download_parsed_document(document_id: str):
    repo = ParsedDocumentRepository()
    parsed = repo.get(document_id)
    if not parsed:
        raise HTTPException(status_code=404, detail="Parsed document not found")
    payload = json.dumps(parsed.canonical, ensure_ascii=False, indent=2)
    filename = f"{document_id}.json"
    return Response(
        content=payload,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
