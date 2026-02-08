from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class ParseInput:
    input_type: str
    raw_input: bytes | str
    source_name: Optional[str] = None
    model_override: Optional[str] = None
    document_id: Optional[str] = None
    correlation_id: Optional[str] = None
    triggered_by: Optional[str] = None


@dataclass
class ParseContext:
    input: ParseInput
    raw_text: str
    deterministic_data: Dict[str, Any]


@dataclass(frozen=True)
class ModelDefinition:
    model_id: str
    label: str
    parser_key: str
    normalizer_key: str
    version: str = "1.0"
    status: str = "active"
    enabled: bool = True
    detection: Dict[str, Any] = field(default_factory=dict)
    mapping_config: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ModelDetection:
    model_id: str
    confidence: float
    reasons: List[str] = field(default_factory=list)
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    overridden: bool = False


@dataclass
class ModelParseOutput:
    raw: Optional[Dict[str, Any]]
    warnings: List[str]
    document_type: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CanonicalParseOutput:
    result: Dict[str, Any]
    warnings: List[str]
    document_type: str
    split_orders: List[Dict[str, Any]]
    has_multiple_dates: bool
    model_id: Optional[str] = None
