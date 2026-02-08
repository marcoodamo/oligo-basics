from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Iterator, List

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:  # pragma: no cover - optional dependency
    psycopg = None
    dict_row = None

DB_PATH_ENV = "PARSER_DB_PATH"
DATABASE_URL_ENV = "DATABASE_URL"


def get_db_path() -> Path:
    env_path = os.getenv(DB_PATH_ENV)
    if env_path:
        return Path(env_path)
    return Path(__file__).parent.parent.parent / "data" / "parser_models.db"


def get_database_url() -> str | None:
    return os.getenv(DATABASE_URL_ENV)


def is_postgres() -> bool:
    url = get_database_url()
    return bool(url and url.startswith("postgres"))


def get_connection():
    if is_postgres():
        if psycopg is None:
            raise RuntimeError("psycopg is required for Postgres connections")
        url = get_database_url()
        return psycopg.connect(url, row_factory=dict_row)
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        if is_postgres():
            _init_postgres(conn)
        else:
            _init_sqlite(conn)


def _init_sqlite(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS parser_models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            display_name TEXT,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            current_version_id INTEGER,
            FOREIGN KEY (current_version_id) REFERENCES parser_model_versions(id)
        );

        CREATE TABLE IF NOT EXISTS parser_model_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id INTEGER NOT NULL,
            version TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_by TEXT,
            detection_rules_json TEXT,
            mapping_config_json TEXT,
            examples_json TEXT,
            FOREIGN KEY (model_id) REFERENCES parser_models(id)
        );

        CREATE TABLE IF NOT EXISTS detection_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_version_id INTEGER NOT NULL,
            rule_type TEXT NOT NULL,
            rule_value TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (model_version_id) REFERENCES parser_model_versions(id)
        );

        CREATE TABLE IF NOT EXISTS field_mappings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_version_id INTEGER NOT NULL,
            source_field TEXT NOT NULL,
            target_field TEXT NOT NULL,
            transform TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (model_version_id) REFERENCES parser_model_versions(id)
        );

        CREATE TABLE IF NOT EXISTS processing_logs (
            id TEXT PRIMARY KEY,
            document_id TEXT,
            filename TEXT,
            hash_sha256 TEXT,
            company_name TEXT,
            model_name TEXT,
            model_confidence REAL,
            parser_version TEXT,
            status TEXT,
            started_at TEXT,
            finished_at TEXT,
            duration_ms INTEGER,
            warnings_count INTEGER DEFAULT 0,
            errors_count INTEGER DEFAULT 0,
            error_summary TEXT,
            correlation_id TEXT,
            triggered_by TEXT,
            raw_metadata TEXT
        );

        CREATE TABLE IF NOT EXISTS parsed_documents (
            document_id TEXT PRIMARY KEY,
            filename TEXT,
            hash_sha256 TEXT,
            schema_version TEXT,
            parser_version TEXT,
            status TEXT,
            model_name TEXT,
            model_confidence REAL,
            warnings_json TEXT,
            missing_fields_json TEXT,
            canonical_json TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        """
    )


def _init_postgres(conn) -> None:
    statements: List[str] = [
        """
        CREATE TABLE IF NOT EXISTS parser_models (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            display_name TEXT,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            current_version_id INTEGER
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS parser_model_versions (
            id SERIAL PRIMARY KEY,
            model_id INTEGER NOT NULL,
            version TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_by TEXT,
            detection_rules_json TEXT,
            mapping_config_json TEXT,
            examples_json TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS detection_rules (
            id SERIAL PRIMARY KEY,
            model_version_id INTEGER NOT NULL,
            rule_type TEXT NOT NULL,
            rule_value TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            created_at TEXT NOT NULL
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS field_mappings (
            id SERIAL PRIMARY KEY,
            model_version_id INTEGER NOT NULL,
            source_field TEXT NOT NULL,
            target_field TEXT NOT NULL,
            transform TEXT,
            created_at TEXT NOT NULL
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS processing_logs (
            id TEXT PRIMARY KEY,
            document_id TEXT,
            filename TEXT,
            hash_sha256 TEXT,
            company_name TEXT,
            model_name TEXT,
            model_confidence REAL,
            parser_version TEXT,
            status TEXT,
            started_at TEXT,
            finished_at TEXT,
            duration_ms INTEGER,
            warnings_count INTEGER DEFAULT 0,
            errors_count INTEGER DEFAULT 0,
            error_summary TEXT,
            correlation_id TEXT,
            triggered_by TEXT,
            raw_metadata TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS parsed_documents (
            document_id TEXT PRIMARY KEY,
            filename TEXT,
            hash_sha256 TEXT,
            schema_version TEXT,
            parser_version TEXT,
            status TEXT,
            model_name TEXT,
            model_confidence REAL,
            warnings_json TEXT,
            missing_fields_json TEXT,
            canonical_json TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        """,
    ]

    with conn.cursor() as cur:
        for stmt in statements:
            cur.execute(stmt)
    conn.commit()
