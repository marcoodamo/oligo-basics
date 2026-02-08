from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from typing import Protocol
import re

from app.config import config

from .types import ModelParseOutput, ParseContext


class ModelParser(Protocol):
    def parse(self, context: ParseContext) -> ModelParseOutput:
        raise NotImplementedError


class LegacyWorkflowParser:
    """Adapter to the existing LangGraph workflow."""

    def parse(self, context: ParseContext) -> ModelParseOutput:
        from app.graph.workflow import parse_order

        output = parse_order(context.input.raw_input, input_type=context.input.input_type)
        warnings = output.get("warnings", []) if isinstance(output, dict) else []
        document_type = output.get("document_type", "unknown") if isinstance(output, dict) else "unknown"
        parser_version = os.getenv("PARSER_VERSION", "legacy")

        return ModelParseOutput(
            raw=output,
            warnings=warnings,
            document_type=document_type,
            metadata=_base_metadata(context, parser_version),
        )


class LarParser:
    def parse(self, context: ParseContext) -> ModelParseOutput:
        legacy_fallback = LegacyWorkflowParser()
        raw_text = context.raw_text or ""
        warnings: list[str] = []

        result = _parse_lar_result(raw_text, context.deterministic_data, warnings)

        # Fallback to legacy workflow if critical data missing
        if not result.get("lines"):
            legacy = legacy_fallback.parse(context)
            legacy.metadata = _with_model_metadata(legacy.metadata, model_name="lar")
            return legacy

        if not result.get("order", {}).get("sell_to", {}).get("cnpj"):
            warnings.append("Customer CNPJ not found in document")

        raw_payload = {
            "result": result,
            "warnings": warnings,
            "document_type": "purchase_order",
        }

        try:
            from app.graph.workflow import split_orders_by_delivery_date

            split_orders = split_orders_by_delivery_date(result)
            raw_payload["split_orders"] = split_orders
            raw_payload["has_multiple_dates"] = len(split_orders) > 1
        except Exception:
            raw_payload["split_orders"] = []
            raw_payload["has_multiple_dates"] = False

        parsed = ModelParseOutput(
            raw=raw_payload,
            warnings=warnings,
            document_type="purchase_order",
            metadata=_with_model_metadata(_base_metadata(context, os.getenv("PARSER_VERSION", "lar")), model_name="lar"),
        )
        return parsed


class BrfParser(LegacyWorkflowParser):
    def parse(self, context: ParseContext) -> ModelParseOutput:
        parsed = super().parse(context)
        parsed.metadata = _with_model_metadata(parsed.metadata, model_name="brf")
        return parsed


def _hash_sha256(raw_input: bytes | str) -> str:
    if isinstance(raw_input, str):
        data = raw_input.encode("utf-8")
    else:
        data = raw_input
    return hashlib.sha256(data).hexdigest()


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _base_metadata(context: ParseContext, parser_version: str) -> dict:
    return {
        "engine": "legacy",
        "input_type": context.input.input_type,
        "source_name": context.input.source_name,
        "hash_sha256": _hash_sha256(context.input.raw_input),
        "ingested_at": _iso_utc_now(),
        "parser_version": parser_version,
    }


def _with_model_metadata(metadata: dict, model_name: str) -> dict:
    updated = dict(metadata or {})
    updated["model_name"] = model_name
    updated.setdefault("detected_by", "rule")
    return updated


def _parse_lar_result(raw_text: str, deterministic_data: dict, warnings: list[str]) -> dict:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    order_number = _match_first(
        raw_text,
        [
            r"Numero do Pedido / Ordem de Compra:\s*([0-9]+)",
            r"Nr\.?Ordem de Compra:\s*([0-9]+)",
            r"Ordem de Compra:\s*([0-9]+)",
        ],
    )
    issue_date_raw = _match_first(raw_text, [r"Data Emissao:\s*([0-9/.-]{6,10})"])
    delivery_date_raw = _match_first(raw_text, [r"Data de Entrega\.?:\s*([0-9/.-]{6,10})"])
    currency_raw = _match_first(raw_text, [r"Moeda:\s*([A-ZÇÃÕÉÍÓÚ ]+)"])
    shipping_method = _match_first(raw_text, [r"Frete:\s*([A-Z]{2,4})"])

    payment_terms = None
    payment_method = None
    payment_info = deterministic_data.get("payment_terms") or {}
    if isinstance(payment_info, dict):
        days = payment_info.get("days")
        payment_days = payment_info.get("payment_days") or []
        if days:
            if payment_days:
                payment_terms = f"{days}D-" + "-".join(f"{day:02d}" for day in payment_days)
            else:
                payment_terms = f"{days:02d}"
        if payment_info.get("bank_transfer") is True:
            payment_method = "BANK_TRANSFER"
    if not payment_terms:
        payment_terms = _match_first(raw_text, [r"Condicoes de Pagamento:\s*([0-9]{2,3})"])

    customer_cnpj = None
    customer_cnpjs = deterministic_data.get("customer_cnpjs")
    if not customer_cnpjs:
        all_cnpjs = deterministic_data.get("cnpjs") or []
        customer_cnpjs = [cnpj for cnpj in all_cnpjs if not config.is_my_company_cnpj(cnpj)]
    customer_cnpjs = customer_cnpjs or []
    if customer_cnpjs:
        customer_cnpj = customer_cnpjs[0]
    else:
        customer_cnpj = _match_first(raw_text, [r"CNPJ:\s*([0-9./-]{14,18})"])

    customer_name = _extract_lar_customer_name(raw_text, lines)
    if not customer_name:
        customer_name = "LAR COOPERATIVA AGROINDUSTRIAL"

    address = _extract_lar_address(lines)

    default_delivery_date = _normalize_lar_date(delivery_date_raw)
    items = _extract_lar_items(lines, default_delivery_date)
    if not items:
        warnings.append("No order line items detected")

    order = {
        "customer_order_number": order_number,
        "order_date": _normalize_lar_date(issue_date_raw),
        "requested_delivery_date": default_delivery_date,
        "currency_code": (currency_raw or "").strip() if currency_raw else None,
        "payment_terms_code": payment_terms,
        "payment_method_code": payment_method,
        "shipping_method_code": shipping_method,
        "sell_to": {
            "name": customer_name,
            "cnpj": customer_cnpj,
            "email": address.get("email"),
            "phone": address.get("phone"),
            "contact": None,
        },
        "bill_to": {
            "address": address.get("line1"),
            "district": address.get("district"),
            "city": address.get("city"),
            "state": address.get("state"),
            "zip": address.get("zip"),
            "country": "BR",
        },
        "ship_to": {
            "address": address.get("line1"),
            "district": address.get("district"),
            "city": address.get("city"),
            "state": address.get("state"),
            "zip": address.get("zip"),
            "country": "BR",
        },
        "notes": None,
    }

    result = {
        "order": order,
        "lines": items,
    }
    return result


def _match_first(text: str, patterns: list[str]) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _normalize_lar_date(value: str | None) -> str | None:
    if not value:
        return None
    match = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$", value.strip())
    if not match:
        return value.strip()
    day, month, year = match.groups()
    if len(year) == 2:
        year_int = int(year)
        year = f"{2000 + year_int:04d}" if year_int < 50 else f"{1900 + year_int:04d}"
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"


def _extract_lar_customer_name(raw_text: str, lines: list[str]) -> str | None:
    header_match = re.search(r"ORDEM DE COMPRA\s*-\s*(.+?)\s*Nr\.pagina", raw_text, re.IGNORECASE)
    if header_match:
        return header_match.group(1).strip()
    for line in lines:
        if line.lower().startswith("local:"):
            value = line.split(":", 1)[-1].strip()
            if " - " in value:
                return value.split(" - ", 1)[0].strip()
            return value or None
    return None


def _extract_lar_address(lines: list[str]) -> dict:
    address: dict[str, str | None] = {
        "line1": None,
        "district": None,
        "city": None,
        "state": None,
        "zip": None,
        "email": None,
        "phone": None,
    }
    start_idx = None
    for idx, line in enumerate(lines):
        if "ENDERECO DE ENTREGA" in line.upper():
            start_idx = idx
            break

    if start_idx is None:
        return address

    section = []
    for line in lines[start_idx + 1:]:
        upper = line.upper()
        if upper.startswith("ORDEM DE COMPRA") or upper.startswith("***") or upper.startswith("---"):
            break
        section.append(line)
        if "DATA DE ENTREGA" in upper:
            break

    for line in section:
        upper = line.upper()
        if upper.startswith("ENDERECO"):
            address["line1"] = line.split(":", 1)[-1].strip()
        elif upper.startswith("BAIRRO"):
            address["district"] = line.split(":", 1)[-1].strip()
        elif upper.startswith("CIDADE"):
            value = line.split(":", 1)[-1].strip()
            parts = value.rsplit(" ", 1)
            if len(parts) == 2 and len(parts[1]) == 2:
                address["city"], address["state"] = parts[0].strip(), parts[1].strip()
            else:
                address["city"] = value
        elif "CEP" in upper:
            cep_match = re.search(r"(\d{5}[-.\s]?\d{3})", line)
            if cep_match:
                address["zip"] = cep_match.group(1)
        elif "E-MAIL" in upper or "EMAIL" in upper:
            email_match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", line, re.IGNORECASE)
            if email_match:
                address["email"] = email_match.group(0)
        elif upper.startswith("TELEFONE"):
            phone_match = re.search(r"[0-9()\s.-]{8,}", line)
            if phone_match:
                address["phone"] = phone_match.group(0).strip()

    return address


def _extract_lar_items(lines: list[str], default_delivery_date: str | None) -> list[dict]:
    items: list[dict] = []
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        base = _parse_lar_item_line(line)
        if not base:
            idx += 1
            continue

        delivery_items: list[dict] = []
        scan_idx = idx + 1
        while scan_idx < len(lines):
            next_line = lines[scan_idx].strip()
            if not next_line:
                scan_idx += 1
                continue
            if _parse_lar_item_line(next_line):
                break
            upper = next_line.upper()
            if upper.startswith("ORDEM DE COMPRA"):
                break

            delivery = _parse_lar_delivery_line(next_line)
            if delivery:
                qty, unit, date = delivery
                item = dict(base)
                item["quantity"] = qty
                if unit:
                    item["unit_of_measure"] = unit
                item["delivery_date"] = date
                item["total"] = None
                _apply_total_if_missing(item)
                delivery_items.append(item)

            scan_idx += 1

        if delivery_items:
            for item in delivery_items:
                _apply_total_if_missing(item)
                item["customer_order_item_no"] = str(len(items) + 1)
                items.append(item)
        else:
            if default_delivery_date:
                base.setdefault("delivery_date", default_delivery_date)
            _apply_total_if_missing(base)
            base["customer_order_item_no"] = str(len(items) + 1)
            items.append(base)

        idx = scan_idx

    return items


def _parse_lar_item_line(line: str) -> dict | None:
    tokens = line.split()
    if len(tokens) < 12:
        return None
    if not tokens[0].isdigit():
        return None
    unit = tokens[-10]
    if not re.match(r"^[A-Za-z]+$", unit):
        return None

    qty = tokens[-12]
    unit_price = tokens[-8]
    total = tokens[-4]

    description = " ".join(tokens[1:-12]).strip().rstrip(".")

    return {
        "item_reference_no": tokens[0],
        "description": description,
        "quantity": qty,
        "unit_of_measure": unit.upper(),
        "unit_price_excl_vat": unit_price,
        "discount": None,
        "tax": None,
        "total": total,
    }


def _parse_lar_delivery_line(line: str) -> tuple[str, str | None, str | None] | None:
    match = re.search(
        r"(?:^|\s)-?\s*QUANTIDADE\s+DE\s+([\d.,]+)\s*([A-Z]+)?\s*(?:P/|PARA)\s*ENTREGA\s*EM\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        line,
        re.IGNORECASE,
    )
    if not match:
        return None
    qty = match.group(1)
    unit = match.group(2).upper() if match.group(2) else None
    date = _normalize_lar_date(match.group(3))
    return qty, unit, date


def _apply_total_if_missing(item: dict) -> None:
    if item.get("total") not in (None, ""):
        return
    qty_value = _parse_decimal(item.get("quantity"))
    price_value = _parse_decimal(item.get("unit_price_excl_vat"))
    if qty_value is None or price_value is None:
        return
    item["total"] = round(qty_value * price_value, 6)


def _parse_decimal(value: str | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^\d,.-]", "", str(value))
    if not cleaned:
        return None
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None
