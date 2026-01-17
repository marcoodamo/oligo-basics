"""
LLM Extractor using LangChain and OpenAI.
Fills in remaining fields that deterministic parsers couldn't extract.
"""

import os
import json
import logging
from typing import Dict, Optional, List, Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel, Field

from app.schemas import Order, OrderLine, SellTo, Address
from app.config import config

logger = logging.getLogger(__name__)


class ExtractedOrder(BaseModel):
    """Schema for LLM extraction output."""
    customer_order_number: Optional[str] = Field(None, description="Customer order/PO number")
    order_date: Optional[str] = Field(None, description="Order date in YYYY-MM-DD format")
    requested_delivery_date: Optional[str] = Field(None, description="Requested delivery date in YYYY-MM-DD format")
    promised_delivery_date: Optional[str] = Field(None, description="Promised delivery date in YYYY-MM-DD format")
    billing_date: Optional[str] = Field(None, description="Billing date in YYYY-MM-DD format")
    currency_code: Optional[str] = Field(None, description="Currency code: BRL, USD, EUR, etc.")
    payment_terms: Optional[str] = Field(None, description="Payment terms description including days, payment dates, and conditions")
    payment_terms_days: Optional[int] = Field(None, description="Number of days for payment (e.g., 60 for '060 100%')")
    payment_days_of_month: Optional[str] = Field(None, description="Specific days of month for payment (e.g., '05-20' means 5th or 20th)")
    payment_method: Optional[str] = Field(None, description="Payment method: bank transfer, boleto, etc.")
    shipping_method: Optional[str] = Field(None, description="Shipping method: CIF, FOB, etc.")
    notes: Optional[str] = Field(None, description="Any additional notes or observations")
    
    # Sell-to information
    customer_name: Optional[str] = Field(None, description="Customer/buyer company name")
    customer_cnpj: Optional[str] = Field(None, description="Customer CNPJ (14 digits)")
    customer_ie: Optional[str] = Field(None, description="Customer IE (Inscrição Estadual)")
    customer_phone: Optional[str] = Field(None, description="Customer phone number")
    customer_email: Optional[str] = Field(None, description="Customer email address")
    customer_contact: Optional[str] = Field(None, description="Customer contact person name")
    
    # Bill-to address
    bill_address: Optional[str] = Field(None, description="Billing address street")
    bill_number: Optional[str] = Field(None, description="Billing address number")
    bill_complement: Optional[str] = Field(None, description="Billing address complement")
    bill_district: Optional[str] = Field(None, description="Billing address district/bairro")
    bill_city: Optional[str] = Field(None, description="Billing address city")
    bill_state: Optional[str] = Field(None, description="Billing address state (UF)")
    bill_zip: Optional[str] = Field(None, description="Billing address ZIP/CEP")
    bill_country: Optional[str] = Field(None, description="Billing address country")
    
    # Ship-to address
    ship_address: Optional[str] = Field(None, description="Shipping address street")
    ship_number: Optional[str] = Field(None, description="Shipping address number")
    ship_complement: Optional[str] = Field(None, description="Shipping address complement")
    ship_district: Optional[str] = Field(None, description="Shipping address district/bairro")
    ship_city: Optional[str] = Field(None, description="Shipping address city")
    ship_state: Optional[str] = Field(None, description="Shipping address state (UF)")
    ship_zip: Optional[str] = Field(None, description="Shipping address ZIP/CEP")
    ship_country: Optional[str] = Field(None, description="Shipping address country")


class ExtractedLine(BaseModel):
    """Schema for extracted order line."""
    customer_order_item_no: Optional[str] = Field(None, description="Customer's item number in this order")
    item_reference_no: Optional[str] = Field(None, description="Product reference/SKU")
    description: Optional[str] = Field(None, description="Product description")
    quantity: Optional[float] = Field(None, description="Quantity as number")
    unit_of_measure: Optional[str] = Field(None, description="Unit: KG, TON, UN, L, etc.")
    unit_price_excl_vat: Optional[float] = Field(None, description="Unit price excluding VAT/IVA")


class ExtractedOrderWithLines(BaseModel):
    """Complete extraction result."""
    order: ExtractedOrder = Field(default_factory=ExtractedOrder)
    lines: List[ExtractedLine] = Field(default_factory=list)


SYSTEM_PROMPT = """You are an expert order document parser for a Brazilian company. Your task is to extract information from purchase orders to pre-fill a Sales Order in Microsoft Dynamics 365 Business Central.

CRITICAL RULES:
1. ONLY extract information that is EXPLICITLY present in the document.
2. If information is not found or cannot be confidently inferred, return null.
3. DO NOT invent, fabricate, or guess any data.
4. Use ONLY the exact values found in the text.
5. The text may come from OCR and have minor errors - use intelligence to correct obvious typos.

HANDLING OCR TEXT:
- OCR can have minor character errors like: "PANBONTS" should be "PANBONIS", "1" vs "I", "0" vs "O"
- When you see repeated similar product names with slight variations, they are likely the same product
- Bank account numbers, totals, and other numbers are NOT product reference codes
- Product codes typically follow a pattern and appear near product descriptions

IMPORTANT DISTINCTIONS:
- The document may contain information about BOTH the supplier (seller) and the customer (buyer).
- The SUPPLIER is our company. Their CNPJs and names will be provided to you.
- The CUSTOMER is who placed the order and should be extracted as sell_to information.
- Look for sections labeled: "Dados para Faturamento", "Comprador", "Cliente", "Destinatário", "Entrega"
- The section "DADOS DO FORNECEDOR" refers to the SUPPLIER (us), NOT the customer.
- Bank account info (Conta Corrente, Agência) belongs to the supplier, not to products!

EXTRACTING ORDER LINE ITEMS (VERY IMPORTANT):
When you see a table of products, pay careful attention to distinguish:

1. **Product Code/Reference (item_reference_no)**: 
   - Usually a numeric code like "133510" or alphanumeric like "PROD-001"
   - Look in columns labeled: "Código", "Ref", "Item", "SKU", "Produto"
   - DO NOT use bank account numbers, totals, or other unrelated numbers

2. **Product Description**:
   - The product name like "PANBONIS 10", "PREMIX SUÍNOS"
   - Numbers after product names (like "10" in "PANBONIS 10") are VARIANTS, not quantities

3. **Quantity**:
   - The actual amount ordered, typically in KG, TON, UN, etc.
   - Look for values like "400 KG", "600 KG", "1000 UN"
   - If you see "PANBONIS 10" with quantity "400 KG", the quantity is 400, NOT 10

4. **Unit of Measure**:
   - KG, TON, UN, L, M, CX (caixa), SC (saco), etc.
   - Usually appears right after the quantity

5. **Unit Price (unit_price_excl_vat)**:
   - Price PER UNIT (per KG, per UN, etc.)
   - NOT the total line value! If total is 17640 and qty is 400, unit price is 44.10
   - Look in columns labeled: "Preço Unit", "VL UNIT", "Unitário", "P.U."

6. **Total Line Value** (do NOT extract, just use for verification):
   - Total = Quantity × Unit Price
   - This helps you verify if you have the right unit price

PAYMENT TERMS:
Brazilian payment terms are complex. Look for patterns like:
- "Condicoes de Pagamento: 060 100,00%" → means 60 days, 100% of total
- "Dias de Pagamento: 05-20" → payment only on 5th or 20th of the month
- "30 DDL" or "60 DDFF" → 30/60 days from invoice date

FORMAT REQUIREMENTS:
- Dates must be in YYYY-MM-DD format
- CNPJs should be 14 digits only (no formatting)
- Currency codes: BRL, USD, EUR
- Units: KG, TON, UN, L, M, etc.
- Prices as decimal numbers (no currency symbols)
- Quantities as numbers without thousand separators

ORDER LINE EXTRACTION EXAMPLE:
If you see a table like:
| Código | Produto      | Qtde    | VL UNIT | VL TOTAL |
| 133510 | PANBONIS 10  | 400 KG  | 44,10   | 17640,00 |
| 133510 | PANBONIS 10  | 600 KG  | 44,10   | 26460,00 |

Extract as:
- Line 1: item_reference_no="133510", description="PANBONIS 10", quantity=400, unit="KG", unit_price=44.10
- Line 2: item_reference_no="133510", description="PANBONIS 10", quantity=600, unit="KG", unit_price=44.10

If the document is an email, extract order details from the email body or any attached structured data.
"""



class LLMExtractor:
    """Extracts remaining order information using LLM."""
    
    def __init__(self):
        self.model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        api_key = os.getenv("OPENAI_API_KEY")
        
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        self.llm = ChatOpenAI(
            model=self.model_name,
            temperature=0.1,  # Low temperature for accuracy
            api_key=api_key,
        )
        
        # Create structured output LLM
        self.structured_llm = self.llm.with_structured_output(ExtractedOrderWithLines)
    
    def extract(
        self,
        text: str,
        deterministic_data: Dict,
        document_type: str = "unknown"
    ) -> ExtractedOrderWithLines:
        """
        Extract order information using LLM.
        
        Args:
            text: Raw text from the document
            deterministic_data: Pre-extracted data from regex parsers
            document_type: Type of document (for context)
        
        Returns:
            ExtractedOrderWithLines with all extracted information
        """
        # Build context with deterministic data
        context_parts = [
            f"Document type: {document_type}",
            "",
            "SUPPLIER IDENTIFICATION (our company - DO NOT extract as customer):",
            f"- Company CNPJs: {config.my_company_cnpjs or 'Not specified'}",
            f"- Company names: {config.my_company_names or 'Not specified'}",
            "",
            "PRE-EXTRACTED DATA (use these as reference, they are verified):",
        ]
        
        if deterministic_data.get('cnpjs'):
            context_parts.append(f"- CNPJs found: {deterministic_data['cnpjs']}")
        if deterministic_data.get('emails'):
            context_parts.append(f"- Emails found: {deterministic_data['emails']}")
        if deterministic_data.get('phones'):
            context_parts.append(f"- Phones found: {deterministic_data['phones']}")
        if deterministic_data.get('dates'):
            dates = [d['iso'] for d in deterministic_data['dates']]
            context_parts.append(f"- Dates found: {dates}")
        if deterministic_data.get('order_numbers'):
            context_parts.append(f"- Order numbers found: {deterministic_data['order_numbers']}")
        
        # Add payment terms if detected
        payment_terms = deterministic_data.get('payment_terms', {})
        if payment_terms.get('days') or payment_terms.get('payment_days'):
            context_parts.append("")
            context_parts.append("PAYMENT TERMS DETECTED (confirmed by regex):")
            if payment_terms.get('days'):
                context_parts.append(f"- Days: {payment_terms['days']}")
            if payment_terms.get('payment_days'):
                context_parts.append(f"- Payment days of month: {payment_terms['payment_days']}")
            if payment_terms.get('bank_transfer') is not None:
                context_parts.append(f"- Bank transfer: {'Yes' if payment_terms['bank_transfer'] else 'No'}")
            if payment_terms.get('interpretation'):
                context_parts.append(f"- Interpretation: {payment_terms['interpretation']}")
        
        context = "\n".join(context_parts)
        
        user_message = f"""{context}

---

DOCUMENT TEXT TO ANALYZE:

{text}

---

Extract all order information from this document. Remember:
1. The CUSTOMER is the buyer (the one placing the order)
2. Do NOT confuse the supplier with the customer (DADOS DO FORNECEDOR = supplier = us)
3. Return null for any field not found
4. Extract ALL order line items if present
5. Pay close attention to PAYMENT TERMS - extract days, specific payment dates, and method
"""
        
        try:
            result = self.structured_llm.invoke([
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=user_message)
            ])
            return result
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            # Return empty result on error
            return ExtractedOrderWithLines(
                order=ExtractedOrder(),
                lines=[]
            )
    
    def to_order_schema(self, extracted: ExtractedOrderWithLines, deterministic_data: Dict = None) -> Dict:
        """Convert extracted data to the required schema format."""
        order = extracted.order
        
        # Build payment terms code
        payment_terms_code = None
        if order.payment_terms_days:
            # Build code like "60D-05/20" for 60 days with payment on 5th or 20th
            base_code = f"{order.payment_terms_days}D"
            if order.payment_days_of_month:
                payment_terms_code = f"{base_code}-{order.payment_days_of_month}"
            else:
                payment_terms_code = base_code
        elif order.payment_terms:
            # Try mapping from config
            payment_terms_code = config.map_payment_terms(order.payment_terms)
        
        # Use deterministic payment terms if LLM didn't extract
        if not payment_terms_code and deterministic_data:
            pt = deterministic_data.get('payment_terms', {})
            if pt.get('days'):
                base_code = f"{pt['days']}D"
                if pt.get('payment_days'):
                    days_str = "-".join([str(d).zfill(2) for d in pt['payment_days']])
                    payment_terms_code = f"{base_code}-{days_str}"
                else:
                    payment_terms_code = base_code
        
        # Map payment method
        payment_method_code = order.payment_method
        if order.payment_method and 'bank' in order.payment_method.lower():
            payment_method_code = "BANK_TRANSFER"
        elif deterministic_data:
            pt = deterministic_data.get('payment_terms', {})
            if pt.get('bank_transfer'):
                payment_method_code = "BANK_TRANSFER"
        
        # Map shipping method and currency
        shipping_method_code = config.map_shipping_method(order.shipping_method)
        currency_code = config.map_currency(order.currency_code) if order.currency_code else None
        
        result = {
            "order": {
                "customer_order_number": order.customer_order_number,
                "order_date": order.order_date,
                "requested_delivery_date": order.requested_delivery_date,
                "promised_delivery_date": order.promised_delivery_date,
                "billing_date": order.billing_date,
                "currency_code": currency_code or order.currency_code,
                "payment_terms_code": payment_terms_code,
                "payment_method_code": payment_method_code,
                "company_bank_account_code": None,  # Usually not in orders
                "shipping_method_code": shipping_method_code,
                "sell_to": {
                    "name": order.customer_name,
                    "cnpj": order.customer_cnpj,
                    "ie": order.customer_ie,
                    "phone": order.customer_phone,
                    "email": order.customer_email,
                    "contact": order.customer_contact,
                },
                "bill_to": {
                    "address": order.bill_address,
                    "number": order.bill_number,
                    "complement": order.bill_complement,
                    "district": order.bill_district,
                    "city": order.bill_city,
                    "state": order.bill_state,
                    "zip": order.bill_zip,
                    "country": order.bill_country,
                },
                "ship_to": {
                    "address": order.ship_address,
                    "number": order.ship_number,
                    "complement": order.ship_complement,
                    "district": order.ship_district,
                    "city": order.ship_city,
                    "state": order.ship_state,
                    "zip": order.ship_zip,
                    "country": order.ship_country,
                },
                "notes": order.notes,
            },
            "lines": [
                {
                    "customer_order_item_no": line.customer_order_item_no,
                    "item_reference_no": line.item_reference_no,
                    "description": line.description,
                    "quantity": line.quantity,
                    "unit_of_measure": line.unit_of_measure,
                    "unit_price_excl_vat": line.unit_price_excl_vat,
                }
                for line in extracted.lines
            ]
        }
        
        return result
