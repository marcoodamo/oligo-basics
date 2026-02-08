from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.db.sqlite import get_connection, init_db, is_postgres


@dataclass
class ParsedDocument:
    document_id: str
    filename: Optional[str]
    hash_sha256: Optional[str]
    schema_version: Optional[str]
    parser_version: Optional[str]
    status: Optional[str]
    model_name: Optional[str]
    model_confidence: Optional[float]
    warnings: list
    missing_fields: list
    canonical: Dict[str, Any]
    created_at: Optional[str]
    updated_at: Optional[str]


class ParsedDocumentRepository:
    def __init__(self) -> None:
        init_db()

    def upsert(
        self,
        *,
        document_id: str,
        filename: Optional[str],
        hash_sha256: Optional[str],
        schema_version: Optional[str],
        parser_version: Optional[str],
        status: Optional[str],
        model_name: Optional[str],
        model_confidence: Optional[float],
        warnings: Optional[list],
        missing_fields: Optional[list],
        canonical: Dict[str, Any],
    ) -> None:
        now = _utc_now()
        with get_connection() as conn:
            _execute(
                conn,
                """
                INSERT INTO parsed_documents (
                    document_id, filename, hash_sha256, schema_version, parser_version,
                    status, model_name, model_confidence, warnings_json, missing_fields_json,
                    canonical_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(document_id) DO UPDATE SET
                    filename=excluded.filename,
                    hash_sha256=excluded.hash_sha256,
                    schema_version=excluded.schema_version,
                    parser_version=excluded.parser_version,
                    status=excluded.status,
                    model_name=excluded.model_name,
                    model_confidence=excluded.model_confidence,
                    warnings_json=excluded.warnings_json,
                    missing_fields_json=excluded.missing_fields_json,
                    canonical_json=excluded.canonical_json,
                    updated_at=excluded.updated_at
                """,
                (
                    document_id,
                    filename,
                    hash_sha256,
                    schema_version,
                    parser_version,
                    status,
                    model_name,
                    model_confidence,
                    json.dumps(warnings or [], ensure_ascii=False),
                    json.dumps(missing_fields or [], ensure_ascii=False),
                    json.dumps(canonical or {}, ensure_ascii=False),
                    now,
                    now,
                ),
            )

    def get(self, document_id: str) -> Optional[ParsedDocument]:
        with get_connection() as conn:
            row = _execute(
                conn,
                "SELECT * FROM parsed_documents WHERE document_id = ?",
                (document_id,),
            ).fetchone()
        if not row:
            return None
        return ParsedDocument(
            document_id=row["document_id"],
            filename=row["filename"],
            hash_sha256=row["hash_sha256"],
            schema_version=row["schema_version"],
            parser_version=row["parser_version"],
            status=row["status"],
            model_name=row["model_name"],
            model_confidence=row["model_confidence"],
            warnings=json.loads(row["warnings_json"] or "[]"),
            missing_fields=json.loads(row["missing_fields_json"] or "[]"),
            canonical=json.loads(row["canonical_json"] or "{}"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _adapt_placeholders(sql: str) -> str:
    if is_postgres():
        return sql.replace("?", "%s")
    return sql


def _execute(conn, sql: str, params: tuple | list | None = None):
    if params is None:
        params = ()
    return conn.execute(_adapt_placeholders(sql), params)
