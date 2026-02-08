from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol


@dataclass
class AuditRecord:
    model_id: str
    document_type: str
    input_type: str
    source_name: Optional[str]
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AuditLogger(Protocol):
    def log(self, record: AuditRecord) -> None:
        raise NotImplementedError


class NoopAuditLogger:
    def log(self, record: AuditRecord) -> None:
        return None


class InMemoryAuditLogger:
    def __init__(self) -> None:
        self.records: List[AuditRecord] = []

    def log(self, record: AuditRecord) -> None:
        self.records.append(record)


class JsonlAuditLogger:
    def __init__(self, path: str | Path):
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def log(self, record: AuditRecord) -> None:
        payload = {
            "timestamp": record.timestamp,
            "model_id": record.model_id,
            "document_type": record.document_type,
            "input_type": record.input_type,
            "source_name": record.source_name,
            "warnings": record.warnings,
            "metadata": record.metadata,
        }
        with open(self._path, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def build_audit_logger_from_env() -> AuditLogger:
    path = os.getenv("AUDIT_LOG_PATH")
    if path:
        return JsonlAuditLogger(path)
    return NoopAuditLogger()
