import os
import importlib
from uuid import uuid4

from app.pipeline.runner import PipelineRunner, ParserRegistry, NormalizerRegistry
from app.pipeline.detectors import RuleBasedModelDetector
from app.pipeline.registry import InMemoryModelRegistry
from app.pipeline.types import CanonicalParseOutput, ModelDefinition, ModelParseOutput, ParseContext, ParseInput
from app.repositories.processing_logs import ProcessingLogRepository
from app.pipeline.audit import NoopAuditLogger


class DummyParser:
    def parse(self, context: ParseContext) -> ModelParseOutput:
        return ModelParseOutput(
            raw={"result": {"order": {}, "lines": []}},
            warnings=[],
            document_type="purchase_order",
            metadata={},
        )


class DummyFailParser:
    def parse(self, context: ParseContext) -> ModelParseOutput:
        raise RuntimeError("boom")


class DummyNormalizer:
    def __init__(self, status="success"):
        self.status = status

    def normalize(self, parsed: ModelParseOutput) -> CanonicalParseOutput:
        return CanonicalParseOutput(
            result={
                "document": {"model": {}},
                "parsing": {"status": self.status, "warnings": []},
            },
            warnings=[],
            document_type=parsed.document_type,
            split_orders=[],
            has_multiple_dates=False,
        )


def build_runner(tmp_path, normalizer):
    os.environ["PARSER_DB_PATH"] = str(tmp_path / "logs.db")
    os.environ.pop("DATABASE_URL", None)
    importlib.reload(importlib.import_module("app.db.sqlite"))

    registry = InMemoryModelRegistry(
        [
            ModelDefinition(
                model_id="generic",
                label="Generic",
                parser_key="dummy",
                normalizer_key="dummy",
                detection={"fallback": True},
            )
        ]
    )

    parser_registry = ParserRegistry()
    parser_registry.register("dummy", DummyParser)

    normalizer_registry = NormalizerRegistry()
    normalizer_registry.register("dummy", lambda: normalizer)

    return PipelineRunner(
        detector=RuleBasedModelDetector(),
        model_registry=registry,
        parser_registry=parser_registry,
        normalizer_registry=normalizer_registry,
        audit_logger=NoopAuditLogger(),
    )


def test_processing_log_success(tmp_path):
    runner = build_runner(tmp_path, DummyNormalizer(status="success"))
    result = runner.run(ParseInput(input_type="text", raw_input="teste"))
    assert result.result["parsing"]["status"] == "success"

    repo = ProcessingLogRepository()
    logs = repo.list_logs(limit=10)
    assert len(logs) == 1
    assert logs[0].status == "success"


def test_processing_log_failed(tmp_path):
    os.environ["PARSER_DB_PATH"] = str(tmp_path / "logs_fail.db")
    os.environ.pop("DATABASE_URL", None)
    importlib.reload(importlib.import_module("app.db.sqlite"))

    registry = InMemoryModelRegistry(
        [
            ModelDefinition(
                model_id="generic",
                label="Generic",
                parser_key="dummy_fail",
                normalizer_key="dummy",
                detection={"fallback": True},
            )
        ]
    )

    parser_registry = ParserRegistry()
    parser_registry.register("dummy_fail", DummyFailParser)

    normalizer_registry = NormalizerRegistry()
    normalizer_registry.register("dummy", lambda: DummyNormalizer(status="success"))

    runner = PipelineRunner(
        detector=RuleBasedModelDetector(),
        model_registry=registry,
        parser_registry=parser_registry,
        normalizer_registry=normalizer_registry,
        audit_logger=NoopAuditLogger(),
    )

    try:
        runner.run(ParseInput(input_type="text", raw_input="teste"))
        assert False, "Expected failure"
    except RuntimeError:
        pass

    repo = ProcessingLogRepository()
    logs = repo.list_logs(limit=10)
    assert len(logs) == 1
    assert logs[0].status == "failed"
    assert logs[0].errors_count == 1
