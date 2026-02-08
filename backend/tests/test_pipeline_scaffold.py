import pytest

from app.pipeline.audit import InMemoryAuditLogger
from app.pipeline.detectors import RuleBasedModelDetector
from app.pipeline.registry import InMemoryModelRegistry
from app.pipeline.runner import NormalizerRegistry, ParserRegistry, PipelineRunner
from app.pipeline.types import (
    CanonicalParseOutput,
    ModelDefinition,
    ModelParseOutput,
    ParseContext,
    ParseInput,
)


class DummyParser:
    def parse(self, context: ParseContext) -> ModelParseOutput:
        return ModelParseOutput(
            raw={
                "order": {
                    "customer_order_number": "PO-1",
                },
                "lines": [],
            },
            warnings=[],
            document_type="purchase_order",
        )


class DummyNormalizer:
    def normalize(self, parsed: ModelParseOutput) -> CanonicalParseOutput:
        return CanonicalParseOutput(
            result=parsed.raw or {},
            warnings=parsed.warnings,
            document_type=parsed.document_type,
            split_orders=[],
            has_multiple_dates=False,
        )


def test_rule_based_detector_keyword_match():
    detector = RuleBasedModelDetector()
    models = [
        ModelDefinition(
            model_id="lar",
            label="LAR",
            parser_key="dummy",
            normalizer_key="dummy",
            detection={"keywords": ["lar cooperativa"]},
        ),
        ModelDefinition(
            model_id="generic",
            label="Generic",
            parser_key="dummy",
            normalizer_key="dummy",
            detection={"fallback": True},
        ),
    ]

    context = ParseContext(
        input=ParseInput(input_type="text", raw_input=""),
        raw_text="Pedido LAR Cooperativa",
        deterministic_data={},
    )

    detection = detector.detect(context, models)
    assert detection.model_id == "lar"
    assert detection.confidence > 0


def test_pipeline_runner_integration_flow():
    registry = InMemoryModelRegistry(
        [
            ModelDefinition(
                model_id="lar",
                label="LAR",
                parser_key="dummy",
                normalizer_key="dummy",
                detection={"keywords": ["lar cooperativa"]},
            ),
            ModelDefinition(
                model_id="generic",
                label="Generic",
                parser_key="dummy",
                normalizer_key="dummy",
                detection={"fallback": True},
            ),
        ]
    )

    parser_registry = ParserRegistry()
    parser_registry.register("dummy", DummyParser)

    normalizer_registry = NormalizerRegistry()
    normalizer_registry.register("dummy", DummyNormalizer)

    audit_logger = InMemoryAuditLogger()

    runner = PipelineRunner(
        detector=RuleBasedModelDetector(),
        model_registry=registry,
        parser_registry=parser_registry,
        normalizer_registry=normalizer_registry,
        audit_logger=audit_logger,
    )

    result = runner.run(ParseInput(input_type="text", raw_input="LAR Cooperativa pedido"))

    assert result.result["order"]["customer_order_number"] == "PO-1"
    assert result.document_type == "purchase_order"
    assert audit_logger.records
    assert audit_logger.records[0].model_id == "lar"


def test_pipeline_runner_manual_override():
    registry = InMemoryModelRegistry(
        [
            ModelDefinition(
                model_id="lar",
                label="LAR",
                parser_key="dummy",
                normalizer_key="dummy",
                detection={"keywords": ["lar cooperativa"]},
            ),
            ModelDefinition(
                model_id="brf",
                label="BRF",
                parser_key="dummy",
                normalizer_key="dummy",
                detection={"keywords": ["brf"]},
            ),
            ModelDefinition(
                model_id="generic",
                label="Generic",
                parser_key="dummy",
                normalizer_key="dummy",
                detection={"fallback": True},
            ),
        ]
    )

    parser_registry = ParserRegistry()
    parser_registry.register("dummy", DummyParser)

    normalizer_registry = NormalizerRegistry()
    normalizer_registry.register("dummy", DummyNormalizer)

    audit_logger = InMemoryAuditLogger()

    runner = PipelineRunner(
        detector=RuleBasedModelDetector(),
        model_registry=registry,
        parser_registry=parser_registry,
        normalizer_registry=normalizer_registry,
        audit_logger=audit_logger,
    )

    result = runner.run(
        ParseInput(
            input_type="text",
            raw_input="lar cooperativa pedido",
            model_override="brf",
        )
    )

    assert result.model_id == "brf"
    assert audit_logger.records[0].model_id == "brf"
