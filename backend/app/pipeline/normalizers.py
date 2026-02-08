from __future__ import annotations

from typing import Protocol

from .types import CanonicalParseOutput, ModelParseOutput


class Normalizer(Protocol):
    def normalize(self, parsed: ModelParseOutput) -> CanonicalParseOutput:
        raise NotImplementedError


class LegacyPassThroughNormalizer:
    def normalize(self, parsed: ModelParseOutput) -> CanonicalParseOutput:
        raw = parsed.raw or {}
        result = raw.get("result", {}) if isinstance(raw, dict) else {}
        warnings = parsed.warnings or raw.get("warnings", []) if isinstance(raw, dict) else parsed.warnings
        document_type = parsed.document_type or raw.get("document_type", "unknown") if isinstance(raw, dict) else "unknown"
        split_orders = raw.get("split_orders", []) if isinstance(raw, dict) else []
        has_multiple_dates = raw.get("has_multiple_dates", False) if isinstance(raw, dict) else False

        return CanonicalParseOutput(
            result=result or {},
            warnings=warnings or [],
            document_type=document_type or "unknown",
            split_orders=split_orders or [],
            has_multiple_dates=bool(has_multiple_dates),
        )


class CanonicalV1Normalizer:
    def normalize(self, parsed: ModelParseOutput) -> CanonicalParseOutput:
        from app.normalizers.canonical import normalize_legacy_to_canonical

        raw = parsed.raw or {}
        metadata = parsed.metadata or {}

        canonical = normalize_legacy_to_canonical(
            raw,
            input_type=metadata.get("input_type", "text"),
            raw_input=None,
            source_name=metadata.get("source_name"),
            hash_sha256=metadata.get("hash_sha256"),
            ingested_at=metadata.get("ingested_at"),
            model_name=metadata.get("model_name"),
            detected_by=metadata.get("detected_by"),
            confidence=metadata.get("confidence"),
            parser_version=metadata.get("parser_version"),
            mapping_config=metadata.get("mapping_config"),
            document_id=metadata.get("document_id"),
        )

        document_type = parsed.document_type
        if getattr(canonical, "document", None) and canonical.document.type:
            document_type = canonical.document.type.value

        split_orders = raw.get("split_orders", []) if isinstance(raw, dict) else []
        has_multiple_dates = raw.get("has_multiple_dates", False) if isinstance(raw, dict) else False

        return CanonicalParseOutput(
            result=canonical.model_dump(mode="json"),
            warnings=canonical.parsing.warnings,
            document_type=document_type or "unknown",
            split_orders=split_orders or [],
            has_multiple_dates=bool(has_multiple_dates),
        )
