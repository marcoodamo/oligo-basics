from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.db.sqlite import get_connection, init_db, is_postgres


@dataclass
class ParserModelVersion:
    id: int
    model_id: int
    version: str
    created_at: str
    created_by: Optional[str]
    detection_rules: Dict[str, Any]
    mapping_config: Dict[str, Any]
    examples: Optional[List[str]]


@dataclass
class ParserModel:
    id: int
    name: str
    display_name: Optional[str]
    active: bool
    created_at: str
    updated_at: str
    current_version_id: Optional[int]
    current_version: Optional[ParserModelVersion]


class ParserModelRepository:
    def __init__(self) -> None:
        init_db()

    def list_models(self) -> List[ParserModel]:
        with get_connection() as conn:
            rows = _execute(
                conn,
                """
                SELECT pm.*, pmv.id AS version_id, pmv.version AS version,
                       pmv.created_at AS version_created_at, pmv.created_by,
                       pmv.detection_rules_json, pmv.mapping_config_json, pmv.examples_json
                FROM parser_models pm
                LEFT JOIN parser_model_versions pmv
                  ON pm.current_version_id = pmv.id
                ORDER BY pm.name
                """
            ).fetchall()

        return [self._row_to_model(row) for row in rows]

    def get_model(self, name: str) -> Optional[ParserModel]:
        with get_connection() as conn:
            row = _execute(
                conn,
                """
                SELECT pm.*, pmv.id AS version_id, pmv.version AS version,
                       pmv.created_at AS version_created_at, pmv.created_by,
                       pmv.detection_rules_json, pmv.mapping_config_json, pmv.examples_json
                FROM parser_models pm
                LEFT JOIN parser_model_versions pmv
                  ON pm.current_version_id = pmv.id
                WHERE pm.name = ?
                """,
                (name,),
            ).fetchone()

        if not row:
            return None
        return self._row_to_model(row)

    def create_model(
        self,
        name: str,
        display_name: Optional[str],
        detection_rules: Dict[str, Any],
        mapping_config: Dict[str, Any],
        examples: Optional[List[str]],
        created_by: Optional[str],
    ) -> ParserModel:
        now = _now()
        with get_connection() as conn:
            model_id = _insert_and_return_id(
                conn,
                """
                INSERT INTO parser_models (name, display_name, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, display_name, _bool_value(True), now, now),
            )
            version = "v1"
            version_id = self._insert_version(
                conn,
                model_id=model_id,
                version=version,
                detection_rules=detection_rules,
                mapping_config=mapping_config,
                examples=examples,
                created_by=created_by,
            )
            _execute(
                conn,
                "UPDATE parser_models SET current_version_id = ? WHERE id = ?",
                (version_id, model_id),
            )

        return self.get_model(name)

    def update_model(
        self,
        name: str,
        display_name: Optional[str],
        active: Optional[bool],
        detection_rules: Optional[Dict[str, Any]],
        mapping_config: Optional[Dict[str, Any]],
        examples: Optional[List[str]],
        updated_by: Optional[str],
    ) -> Optional[ParserModel]:
        model = self.get_model(name)
        if not model:
            return None
        current_detection = model.current_version.detection_rules if model.current_version else {}
        current_mapping = model.current_version.mapping_config if model.current_version else {}
        current_examples = model.current_version.examples if model.current_version else []

        now = _now()
        with get_connection() as conn:
            if display_name is not None:
                _execute(
                    conn,
                    "UPDATE parser_models SET display_name = ?, updated_at = ? WHERE id = ?",
                    (display_name, now, model.id),
                )

            if active is not None:
                _execute(
                    conn,
                    "UPDATE parser_models SET active = ?, updated_at = ? WHERE id = ?",
                    (_bool_value(active), now, model.id),
                )

            if detection_rules is not None or mapping_config is not None or examples is not None:
                next_version = self._next_version(conn, model.id)
                version_id = self._insert_version(
                    conn,
                    model_id=model.id,
                    version=next_version,
                    detection_rules=detection_rules or current_detection,
                    mapping_config=mapping_config or current_mapping,
                    examples=examples or current_examples,
                    created_by=updated_by,
                )
                _execute(
                    conn,
                    "UPDATE parser_models SET current_version_id = ?, updated_at = ? WHERE id = ?",
                    (version_id, now, model.id),
                )

        return self.get_model(name)

    def add_version(
        self,
        name: str,
        detection_rules: Dict[str, Any],
        mapping_config: Dict[str, Any],
        examples: Optional[List[str]],
        created_by: Optional[str],
    ) -> Optional[ParserModel]:
        model = self.get_model(name)
        if not model:
            return None

        now = _now()
        with get_connection() as conn:
            next_version = self._next_version(conn, model.id)
            version_id = self._insert_version(
                conn,
                model_id=model.id,
                version=next_version,
                detection_rules=detection_rules,
                mapping_config=mapping_config,
                examples=examples,
                created_by=created_by,
            )
            _execute(
                conn,
                "UPDATE parser_models SET current_version_id = ?, updated_at = ? WHERE id = ?",
                (version_id, now, model.id),
            )

        return self.get_model(name)

    def set_active(self, name: str, active: bool, updated_by: Optional[str]) -> Optional[ParserModel]:
        model = self.get_model(name)
        if not model:
            return None

        now = _now()
        with get_connection() as conn:
            _execute(
                conn,
                "UPDATE parser_models SET active = ?, updated_at = ? WHERE id = ?",
                (_bool_value(active), now, model.id),
            )
        return self.get_model(name)

    def _next_version(self, conn, model_id: int) -> str:
        row = _execute(
            conn,
            "SELECT version FROM parser_model_versions WHERE model_id = ? ORDER BY id DESC LIMIT 1",
            (model_id,),
        ).fetchone()
        if not row:
            return "v1"
        latest = row["version"]
        try:
            number = int(latest.lstrip("v")) + 1
            return f"v{number}"
        except ValueError:
            return f"v{_unix_ts()}"

    def _insert_version(
        self,
        conn,
        *,
        model_id: int,
        version: str,
        detection_rules: Dict[str, Any],
        mapping_config: Dict[str, Any],
        examples: Optional[List[str]],
        created_by: Optional[str],
    ) -> int:
        now = _now()
        version_id = _insert_and_return_id(
            conn,
            """
            INSERT INTO parser_model_versions (
                model_id, version, created_at, created_by,
                detection_rules_json, mapping_config_json, examples_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                model_id,
                version,
                now,
                created_by,
                json.dumps(detection_rules or {}, ensure_ascii=False),
                json.dumps(mapping_config or {}, ensure_ascii=False),
                json.dumps(examples or [], ensure_ascii=False),
            ),
        )
        self._insert_detection_rules(conn, version_id, detection_rules or {}, now)
        self._insert_field_mappings(conn, version_id, mapping_config or {}, now)
        return version_id

    def _insert_detection_rules(self, conn, version_id: int, detection_rules: Dict[str, Any], now: str) -> None:
        rules = []
        for key, values in detection_rules.items():
            if key == "fallback":
                rules.append((version_id, "fallback", str(values), 0.0, now))
                continue
            for value in values or []:
                rules.append((version_id, key, str(value), 1.0, now))

        if not rules:
            return

        _executemany(
            conn,
            """
            INSERT INTO detection_rules (model_version_id, rule_type, rule_value, weight, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            rules,
        )

    def _insert_field_mappings(self, conn, version_id: int, mapping_config: Dict[str, Any], now: str) -> None:
        mappings = []
        for mapping in (mapping_config or {}).get("fields", []):
            mappings.append(
                (
                    version_id,
                    mapping.get("source", ""),
                    mapping.get("target", ""),
                    mapping.get("transform"),
                    now,
                )
            )
        for mapping in (mapping_config or {}).get("item_fields", []):
            mappings.append(
                (
                    version_id,
                    mapping.get("source", ""),
                    mapping.get("target", ""),
                    mapping.get("transform"),
                    now,
                )
            )

        mappings = [m for m in mappings if m[1] and m[2]]
        if not mappings:
            return

        _executemany(
            conn,
            """
            INSERT INTO field_mappings (model_version_id, source_field, target_field, transform, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            mappings,
        )

    def _row_to_model(self, row) -> ParserModel:
        version = None
        if row["version_id"] is not None:
            version = ParserModelVersion(
                id=row["version_id"],
                model_id=row["id"],
                version=row["version"],
                created_at=row["version_created_at"],
                created_by=row["created_by"],
                detection_rules=json.loads(row["detection_rules_json"] or "{}"),
                mapping_config=json.loads(row["mapping_config_json"] or "{}"),
                examples=json.loads(row["examples_json"] or "[]"),
            )

        return ParserModel(
            id=row["id"],
            name=row["name"],
            display_name=row["display_name"],
            active=bool(row["active"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            current_version_id=row["current_version_id"],
            current_version=version,
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _unix_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _insert_and_return_id(conn, sql: str, params: tuple) -> int:
    if is_postgres():
        sql = f"{sql.strip()} RETURNING id"
        cur = conn.execute(_adapt_placeholders(sql), params)
        row = cur.fetchone()
        return row["id"] if isinstance(row, dict) else row[0]
    cur = conn.execute(sql, params)
    return cur.lastrowid


def _adapt_placeholders(sql: str) -> str:
    if is_postgres():
        return sql.replace("?", "%s")
    return sql


def _execute(conn, sql: str, params: tuple | list | None = None):
    if params is None:
        params = ()
    return conn.execute(_adapt_placeholders(sql), params)


def _executemany(conn, sql: str, seq_of_params: list[tuple] | list[list]):
    adapted = _adapt_placeholders(sql)
    if is_postgres():
        with conn.cursor() as cur:
            cur.executemany(adapted, seq_of_params)
        return None
    return conn.executemany(adapted, seq_of_params)


def _bool_value(value: bool) -> bool | int:
    return bool(value) if is_postgres() else (1 if value else 0)
