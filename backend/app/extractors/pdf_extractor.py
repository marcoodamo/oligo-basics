"""
PDF text extraction with multiple fallback methods.
"""

import io
import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def extract_text_pdfplumber(pdf_bytes: bytes) -> Optional[str]:
    """Extract text using pdfplumber (preferred for native text PDFs)."""
    try:
        import pdfplumber
        
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages_text = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            
            full_text = "\n\n".join(pages_text)
            return full_text if full_text.strip() else None
    except Exception as e:
        logger.warning(f"pdfplumber extraction failed: {e}")
        return None


def extract_text_pypdf(pdf_bytes: bytes) -> Optional[str]:
    """Extract text using pypdf (fallback)."""
    try:
        from pypdf import PdfReader
        
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
        
        full_text = "\n\n".join(pages_text)
        return full_text if full_text.strip() else None
    except Exception as e:
        logger.warning(f"pypdf extraction failed: {e}")
        return None


def preprocess_image_for_ocr(image):
    """
    Preprocess image to improve OCR accuracy.
    - Convert to grayscale
    - Increase contrast
    - Apply threshold for binarization
    """
    try:
        from PIL import Image, ImageEnhance, ImageFilter
        
        # Convert to grayscale
        if image.mode != 'L':
            image = image.convert('L')
        
        # Increase contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
        
        # Sharpen
        image = image.filter(ImageFilter.SHARPEN)
        
        # Scale up for better OCR (if image is small)
        width, height = image.size
        if width < 2000:
            scale_factor = 2000 / width
            new_size = (int(width * scale_factor), int(height * scale_factor))
            image = image.resize(new_size, Image.LANCZOS)
        
        return image
    except Exception as e:
        logger.warning(f"Image preprocessing failed: {e}")
        return image


def extract_text_ocr(pdf_bytes: bytes) -> Optional[str]:
    """
    Extract text using OCR (tesseract) with enhanced settings.
    
    Uses higher DPI, image preprocessing, and optimized Tesseract config
    for better accuracy on scanned documents.
    """
    ocr_enabled = os.getenv("OCR_ENABLED", "false").lower() == "true"
    if not ocr_enabled:
        logger.info("OCR is disabled. Set OCR_ENABLED=true to enable.")
        return None
    
    try:
        from pdf2image import convert_from_bytes
        import pytesseract
        
        # Convert PDF to images with higher DPI for better quality
        images = convert_from_bytes(
            pdf_bytes, 
            dpi=300,  # Higher DPI = better quality
            fmt='png'
        )
        
        pages_text = []
        
        # Tesseract configuration for better accuracy:
        # --psm 6: Assume uniform block of text
        # --oem 3: Use LSTM neural net mode (best accuracy)
        # preserve_interword_spaces: Keep spacing intact for tables
        custom_config = r'--psm 6 --oem 3 -c preserve_interword_spaces=1'
        
        for i, image in enumerate(images):
            # Preprocess image for better OCR
            processed_image = preprocess_image_for_ocr(image)
            
            # Run OCR with Portuguese language
            text = pytesseract.image_to_string(
                processed_image, 
                lang='por',
                config=custom_config
            )
            
            if text:
                pages_text.append(text)
            
            logger.debug(f"OCR page {i+1}: extracted {len(text)} characters")
        
        full_text = "\n\n".join(pages_text)
        
        if full_text.strip():
            logger.info(f"OCR extracted {len(full_text)} characters total")
        
        return full_text if full_text.strip() else None
        
    except ImportError as e:
        logger.warning(f"OCR dependencies not installed: {e}")
        return None
    except Exception as e:
        logger.warning(f"OCR extraction failed: {e}")
        return None


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF using multiple methods with fallbacks.
    
    Priority:
    1. pdfplumber (native text)
    2. pypdf (fallback)
    3. OCR (if enabled and text extraction fails)
    
    Args:
        pdf_bytes: PDF file content as bytes
        
    Returns:
        Extracted text or empty string if all methods fail
    """
    # Try pdfplumber first
    text = extract_text_pdfplumber(pdf_bytes)
    if text and len(text.strip()) > 50:  # Reasonable amount of text
        logger.info("Text extracted successfully with pdfplumber")
        return text
    
    # Try pypdf as fallback
    text = extract_text_pypdf(pdf_bytes)
    if text and len(text.strip()) > 50:
        logger.info("Text extracted successfully with pypdf")
        return text
    
    # Try OCR as last resort
    text = extract_text_ocr(pdf_bytes)
    if text and len(text.strip()) > 50:
        logger.info("Text extracted successfully with OCR")
        return text
    
    # Return whatever we got (might be minimal)
    logger.warning("Text extraction yielded minimal content")
    return text or ""
