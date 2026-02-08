"""
FastAPI application for Order Parser MVP.
"""

import logging
import os
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import time
import traceback
from uuid import uuid4

from app.api.documents import router as documents_router
from app.api.logs import router as logs_router
from app.api.models import router as models_router
from app.config import config
from app.db.sqlite import init_db
from app.extractors.pdf_extractor import extract_text_from_pdf
from app.graph import parse_order
from app.heuristics.company_name import guess_company_name
from app.normalizers import normalize_legacy_to_canonical
from app.pipeline.runner import build_default_runner
from app.pipeline.types import ParseInput
from app.pipeline.parsers import LarParser
from app.pipeline.detectors import RuleBasedModelDetector
from app.pipeline.registry import CompositeModelRegistry, DbModelRegistry, YamlModelRegistry
from app.parsers import parser as deterministic_parser
from app.repositories.parsed_documents import ParsedDocumentRepository
from app.repositories.processing_logs import ProcessingLogRepository, utc_now
from app.schemas import CanonicalParseResponse, HealthResponse, ParseRequest

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
USE_PIPELINE_V2 = os.getenv("PARSER_PIPELINE", "legacy").lower() in {
    "v2",
    "pipeline",
    "true",
    "1",
    "yes",
}


_canonical_runner = None


def run_parser_legacy(input_data: bytes | str, input_type: str, source_name: str | None = None):
    start_time = time.time()
    started_at = utc_now()
    document_id = str(uuid4())
    correlation_id = str(uuid4())

    raw_text = extract_text_from_pdf(input_data) if input_type == "pdf" else input_data
    deterministic_data = deterministic_parser.parse_all(raw_text if isinstance(raw_text, str) else "")
    customer_cnpjs = [
        cnpj for cnpj in deterministic_data.get("cnpjs", [])
        if not config.is_my_company_cnpj(cnpj)
    ]
    if customer_cnpjs:
        deterministic_data["customer_cnpjs"] = customer_cnpjs

    context = {
        "input_type": input_type,
        "raw_text": raw_text or "",
        "deterministic_data": deterministic_data,
    }
    detector = RuleBasedModelDetector()
    models = CompositeModelRegistry([YamlModelRegistry(), DbModelRegistry()]).list_models()
    # Use detector with simplified context for legacy logging
    from app.pipeline.types import ParseContext

    parse_context = ParseContext(
        input=ParseInput(input_type=input_type, raw_input=input_data),
        raw_text=context["raw_text"],
        deterministic_data=context["deterministic_data"],
    )
    detection = detector.detect(
        parse_context,
        [m for m in models if m.enabled and m.status == "active"],
    )

    company_guess = guess_company_name(context["raw_text"])
    repo = ProcessingLogRepository()
    log_id = repo.create_log(
        log_id=str(uuid4()),
        document_id=document_id,
        filename=source_name,
        hash_sha256=_hash_sha256(input_data),
        company_name=company_guess.name,
        model_name=detection.model_id if detection else None,
        model_confidence=detection.confidence if detection else None,
        parser_version=os.getenv("PARSER_VERSION", "legacy"),
        status="partial",
        started_at=started_at,
        correlation_id=correlation_id,
        triggered_by=None,
        raw_metadata={"detector_reasons": detection.reasons if detection else []},
    )

    try:
        if detection and detection.model_id == "lar":
            result = LarParser().parse(parse_context).raw or {}
        elif detection and detection.model_id == "brf":
            from app.pipeline.parsers import BrfParser
            result = BrfParser().parse(parse_context).raw or {}
        else:
            result = parse_order(input_data, input_type=input_type)
        warnings = result.get("warnings", []) if isinstance(result, dict) else []
        status = "partial" if warnings else "success"
        if isinstance(result, dict):
            result["_document_id"] = document_id
            result["_correlation_id"] = correlation_id
        canonical = normalize_legacy_to_canonical(
            result,
            input_type=input_type,
            raw_input=input_data,
            source_name=source_name,
            model_name=detection.model_id if detection else None,
            detected_by="rule",
            confidence=detection.confidence if detection else None,
            parser_version=os.getenv("PARSER_VERSION", "legacy"),
            document_id=document_id,
        )
        canonical_payload = canonical.model_dump(mode="json")
        ParsedDocumentRepository().upsert(
            document_id=document_id,
            filename=source_name,
            hash_sha256=_hash_sha256(input_data),
            schema_version=canonical_payload.get("schema_version"),
            parser_version=os.getenv("PARSER_VERSION", "legacy"),
            status=canonical_payload.get("parsing", {}).get("status"),
            model_name=detection.model_id if detection else None,
            model_confidence=detection.confidence if detection else None,
            warnings=canonical_payload.get("parsing", {}).get("warnings"),
            missing_fields=canonical_payload.get("parsing", {}).get("missing_fields"),
            canonical=canonical_payload,
        )
        finished_at = utc_now()
        duration_ms = int((time.time() - start_time) * 1000)
        repo.update_log(
            log_id,
            status=status,
            finished_at=finished_at,
            duration_ms=duration_ms,
            warnings_count=len(warnings),
            errors_count=0,
            model_name=detection.model_id if detection else None,
            model_confidence=detection.confidence if detection else None,
            parser_version=os.getenv("PARSER_VERSION", "legacy"),
            document_id=document_id,
            company_name=company_guess.name,
            raw_metadata={"detector_reasons": detection.reasons if detection else []},
        )
        return result
    except Exception as exc:
        finished_at = utc_now()
        duration_ms = int((time.time() - start_time) * 1000)
        try:
            failed_canonical = normalize_legacy_to_canonical(
                {"result": {}, "warnings": [str(exc)], "document_type": "unknown"},
                input_type=input_type,
                raw_input=input_data,
                source_name=source_name,
                model_name=detection.model_id if detection else None,
                detected_by="rule",
                confidence=detection.confidence if detection else None,
                parser_version=os.getenv("PARSER_VERSION", "legacy"),
                document_id=document_id,
            )
            canonical_payload = failed_canonical.model_dump(mode="json")
            ParsedDocumentRepository().upsert(
                document_id=document_id,
                filename=source_name,
                hash_sha256=_hash_sha256(input_data),
                schema_version=canonical_payload.get("schema_version"),
                parser_version=os.getenv("PARSER_VERSION", "legacy"),
                status="failed",
                model_name=detection.model_id if detection else None,
                model_confidence=detection.confidence if detection else None,
                warnings=canonical_payload.get("parsing", {}).get("warnings"),
                missing_fields=canonical_payload.get("parsing", {}).get("missing_fields"),
                canonical=canonical_payload,
            )
        except Exception:
            pass
        repo.update_log(
            log_id,
            status="failed",
            finished_at=finished_at,
            duration_ms=duration_ms,
            warnings_count=0,
            errors_count=1,
            error_summary=str(exc)[:200],
            model_name=detection.model_id if detection else None,
            model_confidence=detection.confidence if detection else None,
            parser_version=os.getenv("PARSER_VERSION", "legacy"),
            document_id=document_id,
            company_name=company_guess.name,
            raw_metadata={"trace": traceback.format_exc()[:4000]},
        )
        raise


def _get_canonical_runner():
    global _canonical_runner
    if _canonical_runner is None:
        _canonical_runner = build_default_runner()
    return _canonical_runner


def run_parser_canonical(
    input_data: bytes | str,
    input_type: str,
    source_name: str | None = None,
    model_override: str | None = None,
):
    if USE_PIPELINE_V2:
        runner = _get_canonical_runner()
        canonical = runner.run(
            ParseInput(
                input_type=input_type,
                raw_input=input_data,
                source_name=source_name,
                model_override=model_override,
            )
        )
        return canonical.result

    legacy = run_parser_legacy(input_data, input_type=input_type, source_name=source_name)
    document_id = legacy.get("_document_id") if isinstance(legacy, dict) else None
    canonical = normalize_legacy_to_canonical(
        legacy,
        input_type=input_type,
        raw_input=input_data,
        source_name=source_name,
        model_name=model_override,
        detected_by="manual" if model_override else None,
        document_id=document_id,
    )
    return canonical


def _hash_sha256(raw_input: bytes | str) -> str:
    import hashlib

    if isinstance(raw_input, str):
        data = raw_input.encode("utf-8")
    else:
        data = raw_input
    return hashlib.sha256(data).hexdigest()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    init_db()
    logger.info("Order Parser API starting up...")
    yield
    logger.info("Order Parser API shutting down...")


app = FastAPI(
    title="Order Parser API",
    description="Parse purchase orders (PDF/text) and extract structured data for Business Central",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(models_router)
app.include_router(logs_router)
app.include_router(documents_router)


class ParseResponseModel(BaseModel):
    """Response model for parse endpoint."""
    order: dict
    lines: list
    warnings: list = []
    document_type: str = "unknown"
    split_orders: list = []  # Orders split by delivery date
    has_multiple_dates: bool = False


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="healthy")


@app.post("/parse", response_model=ParseResponseModel)
async def parse_order_endpoint(
    file: Optional[UploadFile] = File(None),
    request: Optional[ParseRequest] = None,
):
    """
    Parse a purchase order and extract structured data.
    
    Accepts either:
    - A PDF file upload (multipart/form-data)
    - A JSON body with text content
    
    Returns structured order data following the Business Central schema.
    """
    try:
        if file is not None:
            # Handle PDF upload
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(
                    status_code=400,
                    detail="Only PDF files are supported"
                )
            
            pdf_bytes = await file.read()
            logger.info(f"Processing PDF file: {file.filename} ({len(pdf_bytes)} bytes)")
            
            result = run_parser_legacy(pdf_bytes, input_type="pdf", source_name=file.filename)
            
        elif request is not None and request.text:
            # Handle text input
            logger.info(f"Processing text input ({len(request.text)} characters)")
            
            result = run_parser_legacy(request.text, input_type="text")
            
        else:
            raise HTTPException(
                status_code=400,
                detail="Either a PDF file or text must be provided"
            )
        
        parsed_result = result.get("result", {})
        
        return ParseResponseModel(
            order=parsed_result.get("order", {}),
            lines=parsed_result.get("lines", []),
            warnings=result.get("warnings", []),
            document_type=result.get("document_type", "unknown"),
            split_orders=result.get("split_orders", []),
            has_multiple_dates=result.get("has_multiple_dates", False),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing order: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing order: {str(e)}"
        )


@app.post("/parse/canonical", response_model=CanonicalParseResponse)
async def parse_order_canonical_endpoint(
    file: Optional[UploadFile] = File(None),
    request: Optional[ParseRequest] = None,
    model: Optional[str] = Query(None, description="Override model selection (e.g. lar, brf)"),
):
    """
    Parse a purchase order and return the canonical schema (versioned).
    """
    try:
        if file is not None:
            if not file.filename.lower().endswith(".pdf"):
                raise HTTPException(
                    status_code=400,
                    detail="Only PDF files are supported"
                )

            pdf_bytes = await file.read()
            logger.info(f"Processing PDF file (canonical): {file.filename} ({len(pdf_bytes)} bytes)")
            return run_parser_canonical(
                pdf_bytes,
                input_type="pdf",
                source_name=file.filename,
                model_override=model,
            )

        if request is not None and request.text:
            logger.info(f"Processing text input (canonical) ({len(request.text)} characters)")
            return run_parser_canonical(
                request.text,
                input_type="text",
                model_override=model,
            )

        raise HTTPException(
            status_code=400,
            detail="Either a PDF file or text must be provided"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error parsing order (canonical): {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing order: {str(e)}"
        )


@app.post("/parse/text", response_model=ParseResponseModel)
async def parse_text_endpoint(request: ParseRequest):
    """
    Parse order from pasted text.
    
    This is an alternative endpoint that only accepts JSON body with text.
    """
    if not request.text:
        raise HTTPException(
            status_code=400,
            detail="Text content is required"
        )
    
    try:
        logger.info(f"Processing text input ({len(request.text)} characters)")
        result = run_parser_legacy(request.text, input_type="text")
        
        parsed_result = result.get("result", {})
        
        return ParseResponseModel(
            order=parsed_result.get("order", {}),
            lines=parsed_result.get("lines", []),
            warnings=result.get("warnings", []),
            document_type=result.get("document_type", "unknown"),
            split_orders=result.get("split_orders", []),
            has_multiple_dates=result.get("has_multiple_dates", False),
        )
        
    except Exception as e:
        logger.error(f"Error parsing text: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing text: {str(e)}"
        )


@app.post("/parse/text/canonical", response_model=CanonicalParseResponse)
async def parse_text_canonical_endpoint(
    request: ParseRequest,
    model: Optional[str] = Query(None, description="Override model selection (e.g. lar, brf)"),
):
    """
    Parse order from pasted text and return the canonical schema.
    """
    if not request.text:
        raise HTTPException(
            status_code=400,
            detail="Text content is required"
        )

    try:
        logger.info(f"Processing text input (canonical) ({len(request.text)} characters)")
        return run_parser_canonical(request.text, input_type="text", model_override=model)

    except Exception as e:
        logger.error(f"Error parsing text (canonical): {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing order: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
