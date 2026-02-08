from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.config import config
from app.parsers.normalizers import normalize_cnpj, normalize_date, normalize_monetary_value, normalize_cep
from app.schemas.canonical import (
    Address,
    Addresses,
    CanonicalParseResponse,
    Contact,
    CurrencyCode,
    CustomerInfo,
    DocumentInfo,
    DocumentSource,
    DocumentType,
    Item,
    ModelInfo,
    ModelDetectedBy,
    OrderInfo,
    ParsingMetadata,
    ParsingStatus,
    Totals,
)

REQUIRED_FIELDS = [
    "customer.name",
    "customer.tax_id",
    "order.order_number",
    "order.issue_date",
    "items",
]

CURRENCY_MAP = {
    "BRL": CurrencyCode.BRL,
    "USD": CurrencyCode.USD,
    "EUR": CurrencyCode.EUR,
}

DOCUMENT_TYPE_MAP = {
    "purchase_order": DocumentType.order,
    "order": DocumentType.order,
    "quote": DocumentType.budget,
    "budget": DocumentType.budget,
}


def normalize_legacy_to_canonical(
    legacy_output: Dict[str, Any],
    *,
    input_type: str,
    raw_input: bytes | str | None,
    source_name: Optional[str] = None,
    hash_sha256: Optional[str] = None,
    ingested_at: Optional[str] = None,
    model_name: Optional[str] = None,
    detected_by: Optional[str] = None,
    confidence: Optional[float] = None,
    parser_version: Optional[str] = None,
    mapping_config: Optional[Dict[str, Any]] = None,
    document_id: Optional[str] = None,
) -> CanonicalParseResponse:
    if isinstance(legacy_output, dict) and "schema_version" in legacy_output:
        return CanonicalParseResponse.model_validate(legacy_output)

    output = legacy_output or {}
    result = output.get("result") if isinstance(output, dict) and "result" in output else output
    result = result or {}

    order = result.get("order", {}) if isinstance(result, dict) else {}
    lines = result.get("lines", []) if isinstance(result, dict) else []

    warnings = output.get("warnings", []) if isinstance(output, dict) else []
    document_type_raw = output.get("document_type", "unknown") if isinstance(output, dict) else "unknown"

    source_hash = hash_sha256 or _hash_sha256(raw_input)
    ingested_at = ingested_at or _iso_utc_now()

    document_info = DocumentInfo(
        id=document_id or str(uuid4()),
        type=_map_document_type(document_type_raw),
        subtype=document_type_raw,
        source=DocumentSource(
            filename=source_name,
            mime_type=_infer_mime_type(input_type),
            file_type=input_type,
            hash_sha256=source_hash,
            ingested_at=ingested_at,
        ),
        model=ModelInfo(
            name=model_name or "unknown",
            detected_by=_map_detected_by(detected_by),
            confidence=confidence if confidence is not None else 0.0,
        ),
    )

    customer_info = _build_customer(order)
    addresses = _build_addresses(order)
    items = _build_items(lines)
    totals = _build_totals(items)

    order_info = OrderInfo(
        order_number=order.get("customer_order_number"),
        issue_date=normalize_date(order.get("order_date")),
        delivery_date=normalize_date(
            order.get("requested_delivery_date")
            or order.get("promised_delivery_date")
        ),
        valid_until=normalize_date(order.get("valid_until")),
        currency=_map_currency(order.get("currency_code")),
        currency_raw=order.get("currency_code"),
        payment_terms=order.get("payment_terms_code"),
        payment_method=order.get("payment_method_code"),
        shipping_method=order.get("shipping_method_code"),
        notes=order.get("notes"),
    )

    parsing = ParsingMetadata(
        status=ParsingStatus.partial,
        warnings=warnings,
        missing_fields=[],
        parsed_at=_iso_utc_now(),
        parser_version=parser_version,
        confidence=confidence,
    )

    canonical = CanonicalParseResponse(
        document=document_info,
        customer=customer_info,
        order=order_info,
        addresses=addresses,
        items=items,
        totals=totals,
        attachments=[],
        parsing=parsing,
    )

    if mapping_config:
        apply_mapping_config(canonical, legacy_output, mapping_config)

    missing_fields = _compute_missing_fields(canonical.customer, canonical.order, canonical.items)
    canonical.parsing.missing_fields = missing_fields
    canonical.parsing.status = _derive_status(result, warnings, missing_fields)

    return canonical


def _hash_sha256(raw_input: bytes | str | None) -> Optional[str]:
    if raw_input is None:
        return None
    if isinstance(raw_input, str):
        data = raw_input.encode("utf-8")
    else:
        data = raw_input
    return hashlib.sha256(data).hexdigest()


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _infer_mime_type(input_type: str) -> str:
    if input_type == "pdf":
        return "application/pdf"
    return "text/plain"


def _map_document_type(doc_type: str) -> DocumentType:
    return DOCUMENT_TYPE_MAP.get(str(doc_type).lower(), DocumentType.unknown)


def _map_detected_by(detected_by: Optional[str]) -> ModelDetectedBy:
    if not detected_by:
        return ModelDetectedBy.unknown
    detected_by_lower = detected_by.lower()
    if detected_by_lower in {"rule", "manual", "configurator"}:
        return ModelDetectedBy(detected_by_lower)
    return ModelDetectedBy.unknown


def _map_currency(currency: Optional[str]) -> CurrencyCode:
    if not currency:
        return CurrencyCode.UNKNOWN
    mapped = config.map_currency(currency)
    if mapped:
        return CURRENCY_MAP.get(mapped.upper(), CurrencyCode.UNKNOWN)
    return CURRENCY_MAP.get(currency.upper(), CurrencyCode.UNKNOWN)


def _build_customer(order: Dict[str, Any]) -> CustomerInfo:
    sell_to = order.get("sell_to", {}) if isinstance(order, dict) else {}
    contacts: List[Contact] = []

    email = sell_to.get("email")
    phone = sell_to.get("phone")
    contact_name = sell_to.get("contact")

    if email:
        contacts.append(Contact(type="email", value=email))
    if phone:
        contacts.append(Contact(type="phone", value=phone))
    if contact_name:
        contacts.append(Contact(type="person", value=contact_name))

    return CustomerInfo(
        name=sell_to.get("name"),
        tax_id=normalize_cnpj(sell_to.get("cnpj")),
        code=order.get("customer_code"),
        contacts=contacts,
    )


def _build_addresses(order: Dict[str, Any]) -> Addresses:
    bill_to = order.get("bill_to", {}) if isinstance(order, dict) else {}
    ship_to = order.get("ship_to", {}) if isinstance(order, dict) else {}

    billing = Address(
        line1=bill_to.get("address"),
        number=bill_to.get("number"),
        complement=bill_to.get("complement"),
        district=bill_to.get("district"),
        city=bill_to.get("city"),
        state=bill_to.get("state"),
        zip=normalize_cep(bill_to.get("zip")) if bill_to.get("zip") else None,
        country=bill_to.get("country"),
    )
    shipping = Address(
        line1=ship_to.get("address"),
        number=ship_to.get("number"),
        complement=ship_to.get("complement"),
        district=ship_to.get("district"),
        city=ship_to.get("city"),
        state=ship_to.get("state"),
        zip=normalize_cep(ship_to.get("zip")) if ship_to.get("zip") else None,
        country=ship_to.get("country"),
    )

    return Addresses(billing=billing, shipping=shipping)


def _build_items(lines: List[Dict[str, Any]]) -> List[Item]:
    items: List[Item] = []
    for idx, line in enumerate(lines or [], start=1):
        line_number = _to_int(line.get("customer_order_item_no")) or idx
        quantity = _to_decimal(line.get("quantity"))
        unit_price = _to_decimal(line.get("unit_price_excl_vat"))
        discount = _to_decimal(line.get("discount"))
        tax = _to_decimal(line.get("tax"))
        total = _to_decimal(line.get("total"))

        if total is None and quantity is not None and unit_price is not None:
            total = round(quantity * unit_price, 6)

        items.append(
            Item(
                line_number=line_number,
                sku=line.get("item_reference_no"),
                description=line.get("description"),
                quantity=quantity,
                unit=line.get("unit_of_measure"),
                unit_price=unit_price,
                discount=discount,
                tax=tax,
                total=total,
                delivery_date=normalize_date(line.get("delivery_date")),
                raw=line or {},
            )
        )

    return items


def apply_mapping_config(
    canonical: CanonicalParseResponse,
    legacy_output: Dict[str, Any],
    mapping_config: Dict[str, Any],
) -> None:
    if not mapping_config:
        return

    legacy_root = legacy_output.get("result") if isinstance(legacy_output, dict) else None
    legacy_root = legacy_root or legacy_output

    for mapping in mapping_config.get("fields", []):
        target = mapping.get("target")
        source = mapping.get("source")
        if not target or not source:
            continue
        value = _get_value_by_path(legacy_root, source)
        value = _apply_transform(value, mapping.get("transform"))
        if value is not None:
            _set_value_if_missing(canonical, target, value)

    for mapping in mapping_config.get("item_fields", []):
        target = mapping.get("target")
        source = mapping.get("source")
        if not target or not source:
            continue
        values = _get_list_value_by_path(legacy_root, source)
        values = [_apply_transform(value, mapping.get("transform")) for value in values]
        _set_item_values_if_missing(canonical, target, values)


def _get_value_by_path(data: Any, path: str) -> Any:
    if not path:
        return None
    if path.startswith("result."):
        path = path[len("result."):]
    if "[]" in path:
        values = _get_list_value_by_path(data, path)
        return values[0] if values else None
    current = data
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
        if current is None:
            return None
    return current


def _get_list_value_by_path(data: Any, path: str) -> List[Any]:
    if not path:
        return []
    if path.startswith("result."):
        path = path[len("result."):]
    if "[]" not in path:
        value = _get_value_by_path(data, path)
        return [value] if value is not None else []

    list_path, remainder = path.split("[]", 1)
    list_path = list_path.rstrip(".")
    remainder = remainder.lstrip(".")
    collection = _get_value_by_path(data, list_path)
    if not isinstance(collection, list):
        return []
    if not remainder:
        return collection
    values = []
    for item in collection:
        if isinstance(item, dict):
            values.append(_get_value_by_path(item, remainder))
        else:
            values.append(None)
    return values


def _set_value_if_missing(target_obj: Any, path: str, value: Any) -> None:
    if not path:
        return
    path = path.lstrip(".")
    parts = path.split(".")
    current = target_obj
    for part in parts[:-1]:
        if isinstance(current, dict):
            current = current.setdefault(part, {})
        else:
            if hasattr(current, part):
                current = getattr(current, part)
            else:
                return
    leaf = parts[-1]
    if isinstance(current, dict):
        if current.get(leaf) in (None, "", []):
            current[leaf] = value
    else:
        if getattr(current, leaf, None) in (None, "", []):
            setattr(current, leaf, value)


def _set_item_values_if_missing(canonical: CanonicalParseResponse, target_path: str, values: List[Any]) -> None:
    if "items[]" not in target_path:
        return
    target_field = target_path.split("items[].", 1)[-1]
    for idx, item in enumerate(canonical.items):
        if idx >= len(values):
            break
        value = values[idx]
        if value is None:
            continue
        if getattr(item, target_field, None) in (None, "", []):
            setattr(item, target_field, value)


def _apply_transform(value: Any, transform: Optional[str]) -> Any:
    if value is None or not transform:
        return value
    transform = transform.lower()
    if transform == "upper" and isinstance(value, str):
        return value.upper()
    if transform == "lower" and isinstance(value, str):
        return value.lower()
    if transform in {"date_iso", "date"} and isinstance(value, str):
        return normalize_date(value)
    if transform in {"number", "decimal"}:
        return _to_decimal(value)
    return value


def _build_totals(items: List[Item]) -> Totals:
    totals = [item.total for item in items if item.total is not None]
    subtotal = round(sum(totals), 6) if totals else None

    return Totals(
        subtotal=subtotal,
        discounts=None,
        freight=None,
        taxes=None,
        total=subtotal,
    )


def _compute_missing_fields(customer: CustomerInfo, order: OrderInfo, items: List[Item]) -> List[str]:
    missing: List[str] = []

    if not customer.name:
        missing.append("customer.name")
    if not customer.tax_id:
        missing.append("customer.tax_id")
    if not order.order_number:
        missing.append("order.order_number")
    if not order.issue_date:
        missing.append("order.issue_date")
    if not items:
        missing.append("items")

    return [field for field in REQUIRED_FIELDS if field in missing]


def _derive_status(result: Dict[str, Any], warnings: List[str], missing_fields: List[str]) -> ParsingStatus:
    if not result:
        return ParsingStatus.failed
    if warnings or missing_fields:
        return ParsingStatus.partial
    return ParsingStatus.success


def _to_decimal(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None

        if re.search(r"[\d]", cleaned) is None:
            return None

        locale = "en-US"
        if "," in cleaned and "." in cleaned:
            locale = "pt-BR"
        elif "," in cleaned and "." not in cleaned:
            locale = "pt-BR"

        normalized = normalize_monetary_value(cleaned, locale=locale)
        return float(normalized) if normalized is not None else None

    return None


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned.isdigit():
            return int(cleaned)
    return None
