import hashlib

from app.normalizers.canonical import normalize_legacy_to_canonical


def test_canonical_normalizer_basic_fields():
    raw_text = "pedido teste"
    legacy = {
        "result": {
            "order": {
                "customer_order_number": "PO-123",
                "order_date": "15/01/2024",
                "requested_delivery_date": "2024-02-05",
                "currency_code": "BRL",
                "payment_terms_code": "30D",
                "sell_to": {
                    "name": "Cliente X",
                    "cnpj": "12.345.678/0001-90",
                    "email": "compras@cliente.com",
                    "phone": "+55 11 99999-0000",
                    "contact": "Maria",
                },
                "bill_to": {
                    "address": "Rua A",
                    "city": "Sao Paulo",
                    "state": "SP",
                    "zip": "01234-567",
                    "country": "BR",
                },
                "ship_to": {},
                "notes": "observacao",
            },
            "lines": [
                {
                    "customer_order_item_no": "1",
                    "item_reference_no": None,
                    "description": "Produto A",
                    "quantity": "10",
                    "unit_of_measure": "KG",
                    "unit_price_excl_vat": "1.234,56",
                }
            ],
        },
        "warnings": ["warn"],
        "document_type": "purchase_order",
    }

    canonical = normalize_legacy_to_canonical(
        legacy,
        input_type="text",
        raw_input=raw_text,
        source_name="example.txt",
    )

    payload = canonical.model_dump(mode="json")
    assert payload["schema_version"] == "1.0"
    assert payload["order"]["issue_date"] == "2024-01-15"
    assert payload["order"]["currency"] == "BRL"
    assert payload["customer"]["tax_id"] == "12345678000190"

    item = payload["items"][0]
    assert item["sku"] is None
    assert item["unit_price"] == 1234.56
    assert item["total"] == 12345.6

    expected_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
    assert payload["document"]["source"]["hash_sha256"] == expected_hash
    assert payload["parsing"]["status"] == "partial"


def test_canonical_normalizer_missing_dates():
    legacy = {
        "result": {
            "order": {
                "customer_order_number": "PO-1",
                "sell_to": {"name": "Cliente X", "cnpj": "12345678000190"},
            },
            "lines": [],
        },
        "warnings": [],
        "document_type": "purchase_order",
    }

    canonical = normalize_legacy_to_canonical(
        legacy,
        input_type="text",
        raw_input="text",
        source_name=None,
    )

    payload = canonical.model_dump(mode="json")
    assert payload["order"]["issue_date"] is None
    assert "order.issue_date" in payload["parsing"]["missing_fields"]
    assert "items" in payload["parsing"]["missing_fields"]


def test_canonical_normalizer_item_without_sku():
    legacy = {
        "result": {
            "order": {
                "customer_order_number": "PO-9",
                "order_date": "2024-01-01",
                "sell_to": {"name": "Cliente X", "cnpj": "12345678000190"},
            },
            "lines": [
                {
                    "description": "Item sem SKU",
                    "quantity": 5,
                    "unit_of_measure": "UN",
                    "unit_price_excl_vat": 10,
                }
            ],
        },
        "warnings": [],
        "document_type": "purchase_order",
    }

    canonical = normalize_legacy_to_canonical(
        legacy,
        input_type="text",
        raw_input="text",
        source_name=None,
    )

    payload = canonical.model_dump(mode="json")
    assert payload["items"][0]["sku"] is None
    assert payload["items"][0]["total"] == 50.0


def test_canonical_normalizer_with_mapping_config():
    legacy = {
        "result": {
            "order": {
                "customer_order_number": "PO-10",
                "order_date": "2024-02-10",
                "sell_to": {"name": "Cliente Y", "cnpj": "12345678000190"},
            },
            "lines": [
                {
                    "item_reference_no": "SKU-1",
                    "description": "Produto B",
                    "quantity": 2,
                    "unit_of_measure": "UN",
                    "unit_price_excl_vat": 9.5,
                }
            ],
        },
        "document_type": "purchase_order",
    }

    mapping_config = {
        "fields": [
            {"source": "order.customer_order_number", "target": "order.order_number"},
        ],
        "item_fields": [
            {"source": "lines[].item_reference_no", "target": "items[].sku"},
        ],
    }

    canonical = normalize_legacy_to_canonical(
        legacy,
        input_type="text",
        raw_input="text",
        source_name=None,
        mapping_config=mapping_config,
    )

    payload = canonical.model_dump(mode="json")
    assert payload["order"]["order_number"] == "PO-10"
    assert payload["items"][0]["sku"] == "SKU-1"
