from __future__ import annotations

import logging
import os
import time
import traceback
from typing import Callable, Dict, List, Optional
from uuid import uuid4

from app.config import config
from app.extractors.pdf_extractor import extract_text_from_pdf
from app.heuristics.company_name import guess_company_name
from app.parsers import parser as deterministic_parser
from app.repositories.parsed_documents import ParsedDocumentRepository
from app.repositories.processing_logs import ProcessingLogRepository, utc_now

from .audit import AuditLogger, AuditRecord, build_audit_logger_from_env
from .detectors import ModelDetector, RuleBasedModelDetector
from .normalizers import CanonicalV1Normalizer, LegacyPassThroughNormalizer, Normalizer
from .parsers import BrfParser, LarParser, LegacyWorkflowParser, ModelParser
from .registry import CompositeModelRegistry, DbModelRegistry, ModelRegistry, YamlModelRegistry
from .types import CanonicalParseOutput, ModelDefinition, ModelDetection, ModelParseOutput, ParseContext, ParseInput


class ParserRegistry:
    def __init__(self) -> None:
        self._factories: Dict[str, Callable[[], ModelParser]] = {}

    def register(self, key: str, factory: Callable[[], ModelParser]) -> None:
        self._factories[key] = factory

    def create(self, key: str) -> ModelParser:
        if key not in self._factories:
            raise KeyError(f"Parser not registered: {key}")
        return self._factories[key]()


class NormalizerRegistry:
    def __init__(self) -> None:
        self._factories: Dict[str, Callable[[], Normalizer]] = {}

    def register(self, key: str, factory: Callable[[], Normalizer]) -> None:
        self._factories[key] = factory

    def create(self, key: str) -> Normalizer:
        if key not in self._factories:
            raise KeyError(f"Normalizer not registered: {key}")
        return self._factories[key]()


class PipelineRunner:
    def __init__(
        self,
        detector: ModelDetector,
        model_registry: ModelRegistry,
        parser_registry: ParserRegistry,
        normalizer_registry: NormalizerRegistry,
        audit_logger: AuditLogger,
    ) -> None:
        self._detector = detector
        self._model_registry = model_registry
        self._parser_registry = parser_registry
        self._normalizer_registry = normalizer_registry
        self._audit_logger = audit_logger
        self._logger = logging.getLogger(__name__)

    def run(self, parse_input: ParseInput) -> CanonicalParseOutput:
        start_time = time.time()
        started_at = utc_now()
        document_id = parse_input.document_id or str(uuid4())
        correlation_id = parse_input.correlation_id or str(uuid4())

        context = self._build_context(parse_input)
        models = [m for m in self._model_registry.list_models() if m.enabled and m.status == "active"]
        detection = self._detect_model(context, models, parse_input)
        model = self._resolve_model(models, detection.model_id)
        detection, model = self._apply_confidence_fallback(models, detection, model)

        company_guess = guess_company_name(context.raw_text)
        log_repo = ProcessingLogRepository()
        log_id = log_repo.create_log(
            log_id=str(uuid4()),
            document_id=document_id,
            filename=parse_input.source_name,
            hash_sha256=self._hash_sha256(parse_input.raw_input),
            company_name=company_guess.name,
            model_name=model.model_id,
            model_confidence=detection.confidence,
            parser_version=os.getenv("PARSER_VERSION", "legacy"),
            status="partial",
            started_at=started_at,
            correlation_id=correlation_id,
            triggered_by=parse_input.triggered_by,
            raw_metadata={
                "detector_reasons": detection.reasons,
                "detector_evidence": detection.evidence,
                "detector_overridden": detection.overridden,
            },
        )

        try:
            parser = self._parser_registry.create(model.parser_key)
            parsed = parser.parse(context)
            if parsed.metadata is None:
                parsed.metadata = {}
            parsed.metadata.setdefault("mapping_config", model.mapping_config)
            parsed.metadata.setdefault("model_name", model.model_id)
            parsed.metadata.setdefault("document_id", document_id)
            parsed.metadata.setdefault("correlation_id", correlation_id)
            parsed.metadata.setdefault("triggered_by", parse_input.triggered_by)

            normalizer = self._normalizer_registry.create(model.normalizer_key)
            canonical = normalizer.normalize(parsed)
            canonical.model_id = model.model_id

            if isinstance(canonical.result, dict):
                document = canonical.result.get("document") or {}
                model_info = document.get("model") or {}
                if not model_info.get("name") or model_info.get("name") == "unknown":
                    model_info["name"] = model.model_id
                if detection.overridden:
                    model_info["detected_by"] = "manual"
                else:
                    model_info.setdefault("detected_by", "rule")
                model_info["confidence"] = detection.confidence
                document["model"] = model_info
                canonical.result["document"] = document

                parsing = canonical.result.get("parsing") or {}
                if "confidence" not in parsing:
                    parsing["confidence"] = detection.confidence
                if "fallback:low_confidence" in detection.reasons:
                    parsing["status"] = "partial"
                    warnings = canonical.result.get("parsing", {}).get("warnings") or canonical.warnings or []
                    warnings.append("Model confidence below threshold; using generic fallback")
                    parsing["warnings"] = warnings
                canonical.result["parsing"] = parsing

            parsed_repo = ParsedDocumentRepository()
            canonical_payload = canonical.result if isinstance(canonical.result, dict) else {}
            parsed_repo.upsert(
                document_id=document_id,
                filename=parse_input.source_name,
                hash_sha256=self._hash_sha256(parse_input.raw_input),
                schema_version=canonical_payload.get("schema_version"),
                parser_version=os.getenv("PARSER_VERSION", "legacy"),
                status=canonical_payload.get("parsing", {}).get("status") if isinstance(canonical_payload, dict) else None,
                model_name=model.model_id,
                model_confidence=detection.confidence,
                warnings=canonical_payload.get("parsing", {}).get("warnings") if isinstance(canonical_payload, dict) else [],
                missing_fields=canonical_payload.get("parsing", {}).get("missing_fields") if isinstance(canonical_payload, dict) else [],
                canonical=canonical_payload,
            )

            self._audit_logger.log(
                AuditRecord(
                    model_id=model.model_id,
                    document_type=canonical.document_type,
                    input_type=parse_input.input_type,
                    source_name=parse_input.source_name,
                    warnings=canonical.warnings,
                    metadata={
                        "detector_confidence": detection.confidence,
                        "detector_reasons": detection.reasons,
                        "detector_evidence": detection.evidence,
                        "detector_overridden": detection.overridden,
                        "parser_key": model.parser_key,
                        "normalizer_key": model.normalizer_key,
                        "model_version": model.version,
                        "model_status": model.status,
                        "correlation_id": correlation_id,
                        "document_id": document_id,
                    },
                )
            )

            self._logger.info(
                "Model selected: %s (confidence=%.2f, overridden=%s)",
                model.model_id,
                detection.confidence,
                detection.overridden,
            )

            finished_at = utc_now()
            duration_ms = int((time.time() - start_time) * 1000)
            warnings_count = len(canonical.warnings or [])
            status = canonical.result.get("parsing", {}).get("status") if isinstance(canonical.result, dict) else None
            status = status or "partial"
            log_repo.update_log(
                log_id,
                status=status,
                finished_at=finished_at,
                duration_ms=duration_ms,
                warnings_count=warnings_count,
                errors_count=0,
                model_name=model.model_id,
                model_confidence=detection.confidence,
                parser_version=os.getenv("PARSER_VERSION", "legacy"),
                document_id=document_id,
                company_name=company_guess.name,
                raw_metadata={
                    "detector_reasons": detection.reasons,
                    "detector_evidence": detection.evidence,
                    "detector_overridden": detection.overridden,
                    "model_version": model.version,
                    "model_status": model.status,
                    "correlation_id": correlation_id,
                    "document_id": document_id,
                },
            )

            return canonical

        except Exception as exc:
            finished_at = utc_now()
            duration_ms = int((time.time() - start_time) * 1000)
            try:
                from app.normalizers.canonical import normalize_legacy_to_canonical

                failed_canonical = normalize_legacy_to_canonical(
                    {"result": {}, "warnings": [str(exc)], "document_type": "unknown"},
                    input_type=parse_input.input_type,
                    raw_input=parse_input.raw_input,
                    source_name=parse_input.source_name,
                    model_name=model.model_id if model else None,
                    detected_by="rule",
                    confidence=detection.confidence if detection else None,
                    parser_version=os.getenv("PARSER_VERSION", "legacy"),
                    document_id=document_id,
                )
                canonical_payload = failed_canonical.model_dump(mode="json")
                ParsedDocumentRepository().upsert(
                    document_id=document_id,
                    filename=parse_input.source_name,
                    hash_sha256=self._hash_sha256(parse_input.raw_input),
                    schema_version=canonical_payload.get("schema_version"),
                    parser_version=os.getenv("PARSER_VERSION", "legacy"),
                    status="failed",
                    model_name=model.model_id if model else None,
                    model_confidence=detection.confidence if detection else None,
                    warnings=canonical_payload.get("parsing", {}).get("warnings"),
                    missing_fields=canonical_payload.get("parsing", {}).get("missing_fields"),
                    canonical=canonical_payload,
                )
            except Exception:
                pass
            log_repo.update_log(
                log_id,
                status="failed",
                finished_at=finished_at,
                duration_ms=duration_ms,
                warnings_count=0,
                errors_count=1,
                error_summary=str(exc)[:200],
                model_name=model.model_id if model else None,
                model_confidence=detection.confidence if detection else None,
                parser_version=os.getenv("PARSER_VERSION", "legacy"),
                document_id=document_id,
                company_name=company_guess.name,
                raw_metadata={
                    "trace": traceback.format_exc()[:4000],
                    "correlation_id": correlation_id,
                    "document_id": document_id,
                },
            )
            raise

    def _apply_confidence_fallback(
        self,
        models: List[ModelDefinition],
        detection: ModelDetection,
        model: ModelDefinition,
    ) -> tuple[ModelDetection, ModelDefinition]:
        threshold = float(os.getenv("MODEL_CONFIDENCE_THRESHOLD", "0.6"))
        if not detection.overridden and detection.confidence < threshold:
            fallback = self._resolve_model(models, "generic")
            if fallback.model_id != model.model_id:
                detection = ModelDetection(
                    model_id=fallback.model_id,
                    confidence=detection.confidence,
                    reasons=detection.reasons + ["fallback:low_confidence"],
                    evidence=detection.evidence + [{"type": "fallback", "value": fallback.model_id, "score": 0}],
                    overridden=False,
                )
                model = fallback
        return detection, model

    def _build_context(self, parse_input: ParseInput) -> ParseContext:
        if parse_input.input_type == "pdf":
            raw_text = extract_text_from_pdf(parse_input.raw_input)
        else:
            raw_text = parse_input.raw_input if isinstance(parse_input.raw_input, str) else ""

        deterministic_data = deterministic_parser.parse_all(raw_text)
        customer_cnpjs = [
            cnpj for cnpj in deterministic_data.get("cnpjs", [])
            if not config.is_my_company_cnpj(cnpj)
        ]
        if customer_cnpjs:
            deterministic_data["customer_cnpjs"] = customer_cnpjs

        return ParseContext(
            input=parse_input,
            raw_text=raw_text,
            deterministic_data=deterministic_data,
        )

    @staticmethod
    def _hash_sha256(raw_input: bytes | str) -> str:
        import hashlib

        if isinstance(raw_input, str):
            data = raw_input.encode("utf-8")
        else:
            data = raw_input
        return hashlib.sha256(data).hexdigest()

    def _detect_model(
        self,
        context: ParseContext,
        models: List[ModelDefinition],
        parse_input: ParseInput,
    ) -> ModelDetection:
        if parse_input.model_override:
            override = parse_input.model_override
            model = self._model_registry.get_by_name(override)
            if model:
                return ModelDetection(
                    model_id=model.model_id,
                    confidence=1.0,
                    reasons=[f"override:{override}"],
                    evidence=[{"type": "override", "value": override, "score": 1.0}],
                    overridden=True,
                )
        return self._detector.detect(context, models)

    @staticmethod
    def _resolve_model(models: List[ModelDefinition], model_id: str) -> ModelDefinition:
        for model in models:
            if model.model_id == model_id:
                return model
        if models:
            return models[0]
        raise ValueError("No models registered")


def build_default_parser_registry() -> ParserRegistry:
    registry = ParserRegistry()
    registry.register("legacy_workflow", LegacyWorkflowParser)
    registry.register("lar_parser", LarParser)
    registry.register("brf_parser", BrfParser)
    return registry


def build_default_normalizer_registry() -> NormalizerRegistry:
    registry = NormalizerRegistry()
    registry.register("legacy_passthrough", LegacyPassThroughNormalizer)
    registry.register("canonical_v1", CanonicalV1Normalizer)
    return registry


def build_default_runner() -> PipelineRunner:
    return PipelineRunner(
        detector=RuleBasedModelDetector(),
        model_registry=CompositeModelRegistry([YamlModelRegistry(), DbModelRegistry()]),
        parser_registry=build_default_parser_registry(),
        normalizer_registry=build_default_normalizer_registry(),
        audit_logger=build_audit_logger_from_env(),
    )
