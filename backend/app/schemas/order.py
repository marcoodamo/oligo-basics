"""
Pydantic schemas for Order Parser.
Matches the required JSON schema for Business Central Sales Order.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class SellTo(BaseModel):
    """Sell-to customer information."""
    name: Optional[str] = None
    cnpj: Optional[str] = None
    ie: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact: Optional[str] = None


class Address(BaseModel):
    """Address information for billing or shipping."""
    address: Optional[str] = None
    number: Optional[str] = None
    complement: Optional[str] = None
    district: Optional[str] = None  # Bairro
    city: Optional[str] = None
    state: Optional[str] = None  # UF
    zip: Optional[str] = None  # CEP
    country: Optional[str] = None


class OrderLine(BaseModel):
    """Individual order line item."""
    customer_order_item_no: Optional[str] = None  # Nº Item Ordem Cliente
    item_reference_no: Optional[str] = None  # Nº Referência de item
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_of_measure: Optional[str] = None
    unit_price_excl_vat: Optional[float] = None


class Order(BaseModel):
    """Complete order information."""
    customer_order_number: Optional[str] = None  # Nº Ordem Cliente
    order_date: Optional[str] = None  # Data do pedido (ISO format)
    requested_delivery_date: Optional[str] = None
    promised_delivery_date: Optional[str] = None
    billing_date: Optional[str] = None
    currency_code: Optional[str] = None  # BRL, USD, etc.
    payment_terms_code: Optional[str] = None
    payment_method_code: Optional[str] = None
    company_bank_account_code: Optional[str] = None
    shipping_method_code: Optional[str] = None  # CIF/FOB
    sell_to: SellTo = Field(default_factory=SellTo)
    bill_to: Address = Field(default_factory=Address)
    ship_to: Address = Field(default_factory=Address)
    notes: Optional[str] = None


class ParseResponse(BaseModel):
    """API response containing the parsed order."""
    order: Order = Field(default_factory=Order)
    lines: List[OrderLine] = Field(default_factory=list)


class ParseRequest(BaseModel):
    """Request body for text-based parsing."""
    text: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"


# For LLM structured output
class LLMExtractionResult(BaseModel):
    """Result from LLM extraction with evidence tracking."""
    order: Order = Field(default_factory=Order)
    lines: List[OrderLine] = Field(default_factory=list)


class DeterministicParseResult(BaseModel):
    """Results from deterministic (regex) parsing."""
    cnpjs: List[str] = Field(default_factory=list)
    ies: List[str] = Field(default_factory=list)
    emails: List[str] = Field(default_factory=list)
    phones: List[str] = Field(default_factory=list)
    dates: List[str] = Field(default_factory=list)
    monetary_values: List[dict] = Field(default_factory=list)
    quantities: List[dict] = Field(default_factory=list)
    raw_text: str = ""
