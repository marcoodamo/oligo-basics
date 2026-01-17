"""
LangGraph workflow for order parsing.
5 nodes: ingest -> deterministic_parsers -> doc_classifier -> llm_extractor -> normalize_validate
"""

import logging
from typing import Dict, Any, Optional, List, Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, END

from app.extractors.pdf_extractor import extract_text_from_pdf
from app.extractors.llm_extractor import LLMExtractor
from app.parsers import parser, normalize_cnpj, normalize_date, normalize_cep
from app.config import config

logger = logging.getLogger(__name__)


class OrderParseState(TypedDict):
    """State passed between nodes in the workflow."""
    # Input
    input_type: str  # "pdf" or "text"
    raw_input: bytes | str
    
    # After ingest
    raw_text: str
    
    # After deterministic parsing
    deterministic_data: Dict[str, Any]
    
    # After classification
    document_type: str
    
    # After LLM extraction
    llm_result: Optional[Dict[str, Any]]
    
    # Final output
    final_result: Optional[Dict[str, Any]]
    
    # Warnings/metadata
    warnings: List[str]


def node_ingest(state: OrderParseState) -> Dict[str, Any]:
    """
    Node 1: Ingest - Extract raw text from input.
    """
    logger.info("Node 1: Ingest - Starting text extraction")
    warnings = list(state.get("warnings", []))
    
    if state["input_type"] == "pdf":
        raw_text = extract_text_from_pdf(state["raw_input"])
        if not raw_text or len(raw_text.strip()) < 50:
            warnings.append("PDF text extraction yielded minimal content. Consider enabling OCR.")
            raw_text = raw_text or ""
    else:
        raw_text = state["raw_input"]
    
    logger.info(f"Extracted {len(raw_text)} characters of text")
    
    return {
        "raw_text": raw_text,
        "warnings": warnings,
    }


def node_deterministic_parsers(state: OrderParseState) -> Dict[str, Any]:
    """
    Node 2: Deterministic Parsers - Extract structured data using regex.
    """
    logger.info("Node 2: Deterministic Parsers - Running regex extraction")
    
    text = state["raw_text"]
    deterministic_data = parser.parse_all(text)
    
    # Filter out company CNPJs from customer CNPJs
    customer_cnpjs = [
        cnpj for cnpj in deterministic_data["cnpjs"]
        if not config.is_my_company_cnpj(cnpj)
    ]
    
    if customer_cnpjs:
        deterministic_data["customer_cnpjs"] = customer_cnpjs
    
    logger.info(f"Found: {len(deterministic_data['cnpjs'])} CNPJs, "
                f"{len(deterministic_data['emails'])} emails, "
                f"{len(deterministic_data['dates'])} dates")
    
    return {
        "deterministic_data": deterministic_data,
    }


def node_doc_classifier(state: OrderParseState) -> Dict[str, Any]:
    """
    Node 3: Document Classifier - Identify document type.
    """
    logger.info("Node 3: Document Classifier - Analyzing document type")
    
    text = state["raw_text"].lower()
    
    # Simple heuristics for document classification
    if "outlook" in text or "enviado:" in text or "de:" in text and "para:" in text:
        doc_type = "email"
    elif "pedido de compra" in text or "purchase order" in text or "ordem de compra" in text:
        doc_type = "purchase_order"
    elif "cotação" in text or "quote" in text or "orçamento" in text:
        doc_type = "quote"
    elif "nf-e" in text or "nota fiscal" in text:
        doc_type = "invoice"
    else:
        doc_type = "unknown"
    
    logger.info(f"Document classified as: {doc_type}")
    
    return {
        "document_type": doc_type,
    }


def node_llm_extractor(state: OrderParseState) -> Dict[str, Any]:
    """
    Node 4: LLM Extractor - Fill remaining fields using LLM.
    """
    logger.info("Node 4: LLM Extractor - Extracting remaining fields")
    warnings = list(state.get("warnings", []))
    
    try:
        extractor = LLMExtractor()
        
        extracted = extractor.extract(
            text=state["raw_text"],
            deterministic_data=state["deterministic_data"],
            document_type=state["document_type"]
        )
        
        llm_result = extractor.to_order_schema(extracted, state["deterministic_data"])
        
        # Log extraction summary
        order = llm_result.get("order", {})
        lines = llm_result.get("lines", [])
        logger.info(f"LLM extracted order with {len(lines)} line items")
        
        if not order.get("sell_to", {}).get("cnpj"):
            warnings.append("Customer CNPJ not found in document")
        if len(lines) == 0:
            warnings.append("No order line items detected")
        
    except Exception as e:
        logger.error(f"LLM extraction error: {e}")
        warnings.append(f"LLM extraction failed: {str(e)}")
        llm_result = None
    
    return {
        "llm_result": llm_result,
        "warnings": warnings,
    }


def node_normalize_validate(state: OrderParseState) -> Dict[str, Any]:
    """
    Node 5: Normalize & Validate - Ensure schema compliance and normalize data.
    """
    logger.info("Node 5: Normalize & Validate - Final processing")
    warnings = list(state.get("warnings", []))
    
    llm_result = state.get("llm_result")
    deterministic_data = state.get("deterministic_data", {})
    
    if llm_result is None:
        # Create empty result if LLM failed
        final_result = create_empty_result()
        warnings.append("Using empty result due to extraction failure")
    else:
        final_result = dict(llm_result)
        
        # Merge deterministic data where LLM data is missing
        order = dict(final_result.get("order", {}))
        sell_to = dict(order.get("sell_to", {}))
        
        # Use deterministic CNPJ if LLM didn't find one
        if not sell_to.get("cnpj") and deterministic_data.get("customer_cnpjs"):
            sell_to["cnpj"] = deterministic_data["customer_cnpjs"][0]
            logger.info("Using deterministic CNPJ for customer")
        
        # Use deterministic email if LLM didn't find one
        if not sell_to.get("email") and deterministic_data.get("emails"):
            sell_to["email"] = deterministic_data["emails"][0]
        
        # Use deterministic phone if LLM didn't find one
        if not sell_to.get("phone") and deterministic_data.get("phones"):
            sell_to["phone"] = deterministic_data["phones"][0]
        
        # Use deterministic order number if LLM didn't find one
        if not order.get("customer_order_number") and deterministic_data.get("order_numbers"):
            order["customer_order_number"] = deterministic_data["order_numbers"][0]
        
        # Normalize CNPJ
        if sell_to.get("cnpj"):
            sell_to["cnpj"] = normalize_cnpj(sell_to["cnpj"])
        
        # Normalize dates
        for date_field in ["order_date", "requested_delivery_date", "promised_delivery_date", "billing_date"]:
            if order.get(date_field):
                order[date_field] = normalize_date(order[date_field])
        
        # Normalize CEPs
        for addr_type in ["bill_to", "ship_to"]:
            addr = order.get(addr_type, {})
            if addr and addr.get("zip"):
                addr["zip"] = normalize_cep(addr["zip"])
        
        order["sell_to"] = sell_to
        final_result["order"] = order
        
        # Ensure all fields exist with null if not present
        final_result = ensure_complete_schema(final_result)
    
    return {
        "final_result": final_result,
        "warnings": warnings,
    }


def create_empty_result() -> Dict:
    """Create an empty result following the schema."""
    return {
        "order": {
            "customer_order_number": None,
            "order_date": None,
            "requested_delivery_date": None,
            "promised_delivery_date": None,
            "billing_date": None,
            "currency_code": None,
            "payment_terms_code": None,
            "payment_method_code": None,
            "company_bank_account_code": None,
            "shipping_method_code": None,
            "sell_to": {
                "name": None,
                "cnpj": None,
                "ie": None,
                "phone": None,
                "email": None,
                "contact": None,
            },
            "bill_to": {
                "address": None,
                "number": None,
                "complement": None,
                "district": None,
                "city": None,
                "state": None,
                "zip": None,
                "country": None,
            },
            "ship_to": {
                "address": None,
                "number": None,
                "complement": None,
                "district": None,
                "city": None,
                "state": None,
                "zip": None,
                "country": None,
            },
            "notes": None,
        },
        "lines": [],
    }


def ensure_complete_schema(result: Dict) -> Dict:
    """Ensure all required fields exist in the result."""
    empty = create_empty_result()
    
    # Deep merge, keeping existing values
    def merge(base: Dict, overlay: Dict) -> Dict:
        merged = dict(base)
        for key, value in overlay.items():
            if key in merged:
                if isinstance(merged[key], dict) and isinstance(value, dict):
                    merged[key] = merge(merged[key], value)
                # Keep the overlay value if it's not None
                elif value is not None:
                    merged[key] = value
            else:
                merged[key] = value
        return merged
    
    return merge(empty, result)


def build_workflow() -> StateGraph:
    """Build the LangGraph workflow."""
    workflow = StateGraph(OrderParseState)
    
    # Add nodes
    workflow.add_node("ingest", node_ingest)
    workflow.add_node("deterministic_parsers", node_deterministic_parsers)
    workflow.add_node("doc_classifier", node_doc_classifier)
    workflow.add_node("llm_extractor", node_llm_extractor)
    workflow.add_node("normalize_validate", node_normalize_validate)
    
    # Define edges (linear flow)
    workflow.set_entry_point("ingest")
    workflow.add_edge("ingest", "deterministic_parsers")
    workflow.add_edge("deterministic_parsers", "doc_classifier")
    workflow.add_edge("doc_classifier", "llm_extractor")
    workflow.add_edge("llm_extractor", "normalize_validate")
    workflow.add_edge("normalize_validate", END)
    
    return workflow.compile()


# Compiled workflow instance
order_parser_workflow = build_workflow()


def parse_order(input_data: bytes | str, input_type: str = "text") -> Dict:
    """
    Main entry point for parsing an order.
    
    Args:
        input_data: PDF bytes or text string
        input_type: "pdf" or "text"
    
    Returns:
        Dictionary with order data and warnings
    """
    initial_state: OrderParseState = {
        "input_type": input_type,
        "raw_input": input_data,
        "raw_text": "",
        "deterministic_data": {},
        "document_type": "unknown",
        "llm_result": None,
        "final_result": None,
        "warnings": [],
    }
    
    final_state = order_parser_workflow.invoke(initial_state)
    
    return {
        "result": final_state["final_result"],
        "warnings": final_state["warnings"],
        "document_type": final_state["document_type"],
    }
