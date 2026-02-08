from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.db.sqlite import get_connection, init_db, is_postgres


@dataclass
class ProcessingLog:
    id: str
    document_id: Optional[str]
    filename: Optional[str]
    hash_sha256: Optional[str]
    company_name: Optional[str]
    model_name: Optional[str]
    model_confidence: Optional[float]
    parser_version: Optional[str]
    status: Optional[str]
    started_at: Optional[str]
    finished_at: Optional[str]
    duration_ms: Optional[int]
    warnings_count: int
    errors_count: int
    error_summary: Optional[str]
    correlation_id: Optional[str]
    triggered_by: Optional[str]
    raw_metadata: Dict[str, Any]


class ProcessingLogRepository:
    def __init__(self) -> None:
        init_db()

    def create_log(
        self,
        *,
        log_id: str,
        document_id: Optional[str],
        filename: Optional[str],
        hash_sha256: Optional[str],
        company_name: Optional[str],
        model_name: Optional[str],
        model_confidence: Optional[float],
        parser_version: Optional[str],
        status: Optional[str],
        started_at: str,
        correlation_id: Optional[str],
        triggered_by: Optional[str],
        raw_metadata: Dict[str, Any],
    ) -> str:
        with get_connection() as conn:
            _execute(
                conn,
                """
                INSERT INTO processing_logs (
                    id, document_id, filename, hash_sha256, company_name, model_name,
                    model_confidence, parser_version, status, started_at,
                    correlation_id, triggered_by, raw_metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    log_id,
                    document_id,
                    filename,
                    hash_sha256,
                    company_name,
                    model_name,
                    model_confidence,
                    parser_version,
                    status,
                    started_at,
                    correlation_id,
                    triggered_by,
                    json.dumps(raw_metadata or {}, ensure_ascii=False),
                ),
            )
        return log_id

    def update_log(
        self,
        log_id: str,
        *,
        status: Optional[str] = None,
        finished_at: Optional[str] = None,
        duration_ms: Optional[int] = None,
        warnings_count: Optional[int] = None,
        errors_count: Optional[int] = None,
        error_summary: Optional[str] = None,
        model_name: Optional[str] = None,
        model_confidence: Optional[float] = None,
        parser_version: Optional[str] = None,
        raw_metadata: Optional[Dict[str, Any]] = None,
        document_id: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> None:
        fields = []
        values: List[Any] = []

        for key, value in {
            "status": status,
            "finished_at": finished_at,
            "duration_ms": duration_ms,
            "warnings_count": warnings_count,
            "errors_count": errors_count,
            "error_summary": error_summary,
            "model_name": model_name,
            "model_confidence": model_confidence,
            "parser_version": parser_version,
            "document_id": document_id,
            "company_name": company_name,
        }.items():
            if value is not None:
                fields.append(f"{key} = ?")
                values.append(value)

        if raw_metadata is not None:
            fields.append("raw_metadata = ?")
            values.append(json.dumps(raw_metadata, ensure_ascii=False))

        if not fields:
            return

        values.append(log_id)
        with get_connection() as conn:
            _execute(
                conn,
                f"UPDATE processing_logs SET {', '.join(fields)} WHERE id = ?",
                values,
            )

    def get_log(self, log_id: str) -> Optional[ProcessingLog]:
        with get_connection() as conn:
            row = _execute(
                conn,
                "SELECT * FROM processing_logs WHERE id = ?",
                (log_id,),
            ).fetchone()
        if not row:
            return None
        return _row_to_log(row)

    def list_logs(
        self,
        *,
        status: Optional[str] = None,
        model_name: Optional[str] = None,
        filename: Optional[str] = None,
        company_name: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ProcessingLog]:
        filters = []
        values: List[Any] = []

        if status:
            filters.append("status = ?")
            values.append(status)
        if model_name:
            filters.append("model_name = ?")
            values.append(model_name)
        if filename:
            filters.append("filename LIKE ?")
            values.append(f"%{filename}%")
        if company_name:
            filters.append("company_name LIKE ?")
            values.append(f"%{company_name}%")
        if date_from:
            filters.append("started_at >= ?")
            values.append(date_from)
        if date_to:
            filters.append("started_at <= ?")
            values.append(date_to)

        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
        query = (
            "SELECT * FROM processing_logs "
            f"{where_clause} ORDER BY started_at DESC LIMIT ? OFFSET ?"
        )
        values.extend([limit, offset])

        with get_connection() as conn:
            rows = _execute(conn, query, values).fetchall()

        return [_row_to_log(row) for row in rows]


def _row_to_log(row) -> ProcessingLog:
    return ProcessingLog(
        id=row["id"],
        document_id=row["document_id"],
        filename=row["filename"],
        hash_sha256=row["hash_sha256"],
        company_name=row["company_name"],
        model_name=row["model_name"],
        model_confidence=row["model_confidence"],
        parser_version=row["parser_version"],
        status=row["status"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        duration_ms=row["duration_ms"],
        warnings_count=row["warnings_count"],
        errors_count=row["errors_count"],
        error_summary=row["error_summary"],
        correlation_id=row["correlation_id"],
        triggered_by=row["triggered_by"],
        raw_metadata=json.loads(row["raw_metadata"] or "{}"),
    )


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _adapt_placeholders(sql: str) -> str:
    if is_postgres():
        return sql.replace("?", "%s")
    return sql


def _execute(conn, sql: str, params: list[Any] | tuple[Any, ...] | None = None):
    if params is None:
        params = ()
    return conn.execute(_adapt_placeholders(sql), params)
