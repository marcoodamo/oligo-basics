from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.graph import parse_order
from app.heuristics.company_name import guess_company_name, suggest_model_name
from app.normalizers.canonical import normalize_legacy_to_canonical
from app.pipeline.detectors import RuleBasedModelDetector
from app.pipeline.registry import CompositeModelRegistry, DbModelRegistry, YamlModelRegistry
from app.pipeline.types import ParseContext, ParseInput
from app.repositories.parser_models import ParserModelRepository
from app.schemas import ParseRequest
from app.schemas.model_config import (
    DetectionTestResponse,
    ParserModelCreate,
    ParserModelResponse,
    ParserModelUpdate,
    PreviewResponse,
)

router = APIRouter(prefix="/models", tags=["models"])


def _registry():
    return CompositeModelRegistry([YamlModelRegistry(), DbModelRegistry()])


def _repo():
    return ParserModelRepository()


async def _read_input(file: Optional[UploadFile], text: Optional[str]) -> tuple[str, bytes | str, str | None]:
    if file is not None:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        return "pdf", await file.read(), file.filename

    if text is not None and text.strip():
        return "text", text, None

    raise HTTPException(status_code=400, detail="Either a PDF file or text must be provided")


@router.get("", response_model=list[ParserModelResponse])
def list_models():
    models = _repo().list_models()
    return [_to_response(model) for model in models]


@router.get("/{name}", response_model=ParserModelResponse)
def get_model(name: str):
    model = _repo().get_model(name)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return _to_response(model)


@router.post("", response_model=ParserModelResponse)
def create_model(payload: ParserModelCreate):
    if _repo().get_model(payload.name):
        raise HTTPException(status_code=409, detail="Model already exists")

    model = _repo().create_model(
        name=payload.name,
        display_name=payload.display_name,
        detection_rules=payload.detection_rules.model_dump(),
        mapping_config=payload.mapping_config.model_dump(),
        examples=payload.examples,
        created_by=payload.created_by,
    )
    return _to_response(model)


@router.put("/{name}", response_model=ParserModelResponse)
def update_model(name: str, payload: ParserModelUpdate):
    model = _repo().update_model(
        name=name,
        display_name=payload.display_name,
        active=payload.active,
        detection_rules=payload.detection_rules.model_dump() if payload.detection_rules else None,
        mapping_config=payload.mapping_config.model_dump() if payload.mapping_config else None,
        examples=payload.examples,
        updated_by=payload.updated_by,
    )
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return _to_response(model)


@router.post("/{name}/activate", response_model=ParserModelResponse)
def activate_model(name: str):
    model = _repo().set_active(name, True, updated_by=None)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return _to_response(model)


@router.post("/{name}/deactivate", response_model=ParserModelResponse)
def deactivate_model(name: str):
    model = _repo().set_active(name, False, updated_by=None)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return _to_response(model)


@router.post("/detect", response_model=DetectionTestResponse)
async def detect_model(
    file: Optional[UploadFile] = File(None),
    text_form: Optional[str] = Form(None),
):
    input_type, raw_input, _ = await _read_input(file, text_form)

    from app.extractors.pdf_extractor import extract_text_from_pdf
    from app.parsers import parser as deterministic_parser
    from app.config import config

    if input_type == "pdf":
        raw_text = extract_text_from_pdf(raw_input)
    else:
        raw_text = raw_input if isinstance(raw_input, str) else ""

    deterministic_data = deterministic_parser.parse_all(raw_text)
    customer_cnpjs = [
        cnpj for cnpj in deterministic_data.get("cnpjs", [])
        if not config.is_my_company_cnpj(cnpj)
    ]
    if customer_cnpjs:
        deterministic_data["customer_cnpjs"] = customer_cnpjs

    context = ParseContext(
        input=ParseInput(input_type=input_type, raw_input=raw_input),
        raw_text=raw_text,
        deterministic_data=deterministic_data,
    )

    detector = RuleBasedModelDetector()
    models = [m for m in _registry().list_models() if m.enabled and m.status == "active"]
    detection = detector.detect(context, models)

    return DetectionTestResponse(
        model_name=detection.model_id,
        confidence=detection.confidence,
        reasons=detection.reasons,
        evidence=detection.evidence,
    )


@router.post("/detect/text", response_model=DetectionTestResponse)
async def detect_model_text(request: ParseRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text content is required")
    detection = _detect_from_text("text", request.text, request.text)
    return DetectionTestResponse(
        model_name=detection.model_id,
        confidence=detection.confidence,
        reasons=detection.reasons,
        evidence=detection.evidence,
    )


@router.post("/preview", response_model=PreviewResponse)
async def preview_parse(
    file: Optional[UploadFile] = File(None),
    text_form: Optional[str] = Form(None),
):
    input_type, raw_input, filename = await _read_input(file, text_form)

    legacy_output = parse_order(raw_input, input_type=input_type)
    canonical = normalize_legacy_to_canonical(
        legacy_output,
        input_type=input_type,
        raw_input=raw_input,
        source_name=filename,
    )

    raw_text = _extract_raw_text(input_type, raw_input)
    detection = _detect_from_text(input_type, raw_input, raw_text)

    guess = guess_company_name(raw_text)
    suggested = suggest_model_name(guess.name)
    threshold = 0.6
    needs_configuration = detection.confidence < threshold

    return PreviewResponse(
        detected=DetectionTestResponse(
            model_name=detection.model_id,
            confidence=detection.confidence,
            reasons=detection.reasons,
            evidence=detection.evidence,
        ),
        suggested_model_name=suggested,
        suggested_display_name=guess.name,
        suggested_confidence=guess.confidence,
        preview=canonical.model_dump(mode="json"),
        needs_configuration=needs_configuration,
    )


@router.post("/preview/text", response_model=PreviewResponse)
async def preview_parse_text(request: ParseRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text content is required")
    return await preview_parse(file=None, text_form=request.text)


def _extract_raw_text(input_type: str, raw_input: bytes | str) -> str:
    if input_type == "pdf":
        from app.extractors.pdf_extractor import extract_text_from_pdf

        return extract_text_from_pdf(raw_input)
    return raw_input if isinstance(raw_input, str) else ""


def _detect_from_text(input_type: str, raw_input: bytes | str, raw_text: str):
    from app.parsers import parser as deterministic_parser
    from app.config import config

    deterministic_data = deterministic_parser.parse_all(raw_text)
    customer_cnpjs = [
        cnpj for cnpj in deterministic_data.get("cnpjs", [])
        if not config.is_my_company_cnpj(cnpj)
    ]
    if customer_cnpjs:
        deterministic_data["customer_cnpjs"] = customer_cnpjs

    context = ParseContext(
        input=ParseInput(input_type=input_type, raw_input=raw_input),
        raw_text=raw_text,
        deterministic_data=deterministic_data,
    )

    detector = RuleBasedModelDetector()
    models = [m for m in _registry().list_models() if m.enabled and m.status == "active"]
    return detector.detect(context, models)


def _to_response(model) -> ParserModelResponse:
    version = model.current_version
    if not version:
        raise HTTPException(status_code=500, detail="Model has no version")

    return ParserModelResponse(
        name=model.name,
        display_name=model.display_name,
        active=model.active,
        created_at=model.created_at,
        updated_at=model.updated_at,
        current_version={
            "version": version.version,
            "detection_rules": version.detection_rules,
            "mapping_config": version.mapping_config,
            "created_at": version.created_at,
            "created_by": version.created_by,
        },
    )
