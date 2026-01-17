"""
FastAPI application for Order Parser MVP.
"""

import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.graph import parse_order
from app.schemas import HealthResponse, ParseRequest

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
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
            
            result = parse_order(pdf_bytes, input_type="pdf")
            
        elif request is not None and request.text:
            # Handle text input
            logger.info(f"Processing text input ({len(request.text)} characters)")
            
            result = parse_order(request.text, input_type="text")
            
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
        result = parse_order(request.text, input_type="text")
        
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
