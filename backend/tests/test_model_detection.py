from app.pipeline.detectors import RuleBasedModelDetector
from app.pipeline.types import ModelDefinition, ParseContext, ParseInput


def test_detector_header_regex_and_required_fields():
    detector = RuleBasedModelDetector()
    models = [
        ModelDefinition(
            model_id="lar",
            label="LAR",
            parser_key="dummy",
            normalizer_key="dummy",
            detection={
                "header_regex": [r"^\s*pedido de compra"],
                "required_fields": ["cnpj", "pedido"],
            },
        ),
        ModelDefinition(
            model_id="generic",
            label="Generic",
            parser_key="dummy",
            normalizer_key="dummy",
            detection={"fallback": True},
        ),
    ]

    text = "Pedido de compra\nCNPJ: 12.345.678/0001-90\nPedido: 123"
    context = ParseContext(
        input=ParseInput(input_type="text", raw_input=text),
        raw_text=text,
        deterministic_data={},
    )

    detection = detector.detect(context, models)
    assert detection.model_id == "lar"
    evidence_types = {item["type"] for item in detection.evidence}
    assert "header_regex" in evidence_types
    assert "required_field" in evidence_types


def test_detector_cnpj_match():
    detector = RuleBasedModelDetector()
    models = [
        ModelDefinition(
            model_id="lar",
            label="LAR",
            parser_key="dummy",
            normalizer_key="dummy",
            detection={
                "customer_cnpjs": ["12345678000190"],
            },
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
        input=ParseInput(input_type="text", raw_input="text"),
        raw_text="text",
        deterministic_data={"cnpjs": ["12345678000190"]},
    )

    detection = detector.detect(context, models)
    assert detection.model_id == "lar"
    assert any(reason.startswith("cnpj:") for reason in detection.reasons)


def test_detector_fallback_generic():
    detector = RuleBasedModelDetector()
    models = [
        ModelDefinition(
            model_id="generic",
            label="Generic",
            parser_key="dummy",
            normalizer_key="dummy",
            detection={"fallback": True},
        ),
    ]

    context = ParseContext(
        input=ParseInput(input_type="text", raw_input="text"),
        raw_text="text",
        deterministic_data={},
    )

    detection = detector.detect(context, models)
    assert detection.model_id == "generic"
    assert detection.confidence == 0.0
    assert detection.evidence[0]["type"] == "fallback"
