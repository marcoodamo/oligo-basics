"""
Canonical schema for parsed orders/quotes.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

SCHEMA_VERSION = "1.0"


class DocumentType(str, Enum):
    order = "order"
    budget = "budget"
    unknown = "unknown"


class CurrencyCode(str, Enum):
    BRL = "BRL"
    USD = "USD"
    EUR = "EUR"
    UNKNOWN = "UNKNOWN"


class ParsingStatus(str, Enum):
    success = "success"
    partial = "partial"
    failed = "failed"


class ModelDetectedBy(str, Enum):
    rule = "rule"
    manual = "manual"
    configurator = "configurator"
    unknown = "unknown"


class DocumentSource(BaseModel):
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_type: Optional[str] = None
    hash_sha256: Optional[str] = None
    ingested_at: Optional[str] = None


class ModelInfo(BaseModel):
    name: str = "unknown"
    detected_by: ModelDetectedBy = ModelDetectedBy.unknown
    confidence: float = 0.0


class DocumentInfo(BaseModel):
    id: str
    type: DocumentType = DocumentType.unknown
    subtype: Optional[str] = None
    source: DocumentSource
    model: ModelInfo = Field(default_factory=ModelInfo)


class Contact(BaseModel):
    type: str
    value: str


class CustomerInfo(BaseModel):
    name: Optional[str] = None
    tax_id: Optional[str] = None
    code: Optional[str] = None
    contacts: List[Contact] = Field(default_factory=list)


class OrderInfo(BaseModel):
    order_number: Optional[str] = None
    issue_date: Optional[str] = None
    delivery_date: Optional[str] = None
    valid_until: Optional[str] = None
    currency: CurrencyCode = CurrencyCode.UNKNOWN
    currency_raw: Optional[str] = None
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    shipping_method: Optional[str] = None
    notes: Optional[str] = None


class Address(BaseModel):
    line1: Optional[str] = None
    number: Optional[str] = None
    complement: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None


class Addresses(BaseModel):
    billing: Address = Field(default_factory=Address)
    shipping: Address = Field(default_factory=Address)


class Item(BaseModel):
    line_number: Optional[int] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    discount: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    delivery_date: Optional[str] = None
    raw: Dict[str, Any] = Field(default_factory=dict)


class Totals(BaseModel):
    subtotal: Optional[float] = None
    discounts: Optional[float] = None
    freight: Optional[float] = None
    taxes: Optional[float] = None
    total: Optional[float] = None


class Attachment(BaseModel):
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    hash_sha256: Optional[str] = None


class ParsingMetadata(BaseModel):
    status: ParsingStatus = ParsingStatus.partial
    warnings: List[str] = Field(default_factory=list)
    missing_fields: List[str] = Field(default_factory=list)
    parsed_at: Optional[str] = None
    parser_version: Optional[str] = None
    confidence: Optional[float] = None


class CanonicalOrder(BaseModel):
    schema_version: str = SCHEMA_VERSION
    document: DocumentInfo
    customer: CustomerInfo
    order: OrderInfo
    addresses: Addresses
    items: List[Item] = Field(default_factory=list)
    totals: Totals = Field(default_factory=Totals)
    attachments: List[Attachment] = Field(default_factory=list)
    parsing: ParsingMetadata


CanonicalParseResponse = CanonicalOrder
