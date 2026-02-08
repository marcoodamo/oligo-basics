# Schema canonico v1.0 (Pedido/Orcamento)

Este documento define o formato canonico de saida para qualquer parser/modelo.

## Objetivo
- Garantir um JSON unico e versionado para todos os arquivos processados.
- Normalizar datas (ISO-8601) e valores monetarios.
- Registrar metadados de parsing (warnings, campos ausentes, confianca).

## Estrutura (alto nivel)

- `schema_version`: versao do schema (ex.: `"1.0"`).
- `document`: identificacao do documento + origem do arquivo + modelo detectado.
- `customer`: identificacao do cliente + contatos.
- `order`: dados comerciais (pedido/orcamento, datas, moeda, condicoes).
- `addresses`: enderecos de cobranca e entrega.
- `items`: itens normalizados.
- `totals`: subtotal, descontos, frete, impostos, total.
- `attachments`: anexos (se houver).
- `parsing`: metadados de parsing e qualidade.

## Exemplo

```json
{
  "schema_version": "1.0",
  "document": {
    "id": "uuid",
    "type": "order",
    "subtype": "purchase_order",
    "source": {
      "filename": "1885349 Lar.PDF",
      "mime_type": "application/pdf",
      "file_type": "pdf",
      "hash_sha256": "<sha256>",
      "ingested_at": "2026-01-31T12:34:56Z"
    },
    "model": {
      "name": "lar",
      "detected_by": "rule",
      "confidence": 0.92
    }
  },
  "customer": {
    "name": "LAR COOPERATIVA",
    "tax_id": "12345678000190",
    "code": null,
    "contacts": [
      {"type": "email", "value": "compras@lar.com.br"}
    ]
  },
  "order": {
    "order_number": "12345",
    "issue_date": "2026-01-30",
    "delivery_date": "2026-02-05",
    "valid_until": null,
    "currency": "BRL",
    "currency_raw": "BRL",
    "payment_terms": "30D",
    "payment_method": null,
    "shipping_method": "CIF",
    "notes": null
  },
  "addresses": {
    "billing": {"line1": "Rua A", "city": "Curitiba", "state": "PR", "zip": "80000000", "country": "BR"},
    "shipping": {"line1": null, "city": null, "state": null, "zip": null, "country": null}
  },
  "items": [
    {
      "line_number": 1,
      "sku": "133510",
      "description": "PRODUTO",
      "quantity": 400,
      "unit": "KG",
      "unit_price": 44.10,
      "delivery_date": "2026-02-05",
      "discount": 0,
      "tax": 0,
      "total": 17640.00,
      "raw": {"any_original_fields": "..."}
    }
  ],
  "totals": {
    "subtotal": 17640.00,
    "discounts": 0,
    "freight": 0,
    "taxes": 0,
    "total": 17640.00
  },
  "attachments": [],
  "parsing": {
    "status": "partial",
    "warnings": ["Customer CNPJ not found"],
    "missing_fields": ["order.issue_date"],
    "parsed_at": "2026-01-31T12:35:10Z",
    "parser_version": "legacy",
    "confidence": 0.92
  }
}
```

## Endpoints

- `POST /parse/canonical` → retorna o JSON canonico.
- `POST /parse/text/canonical` → versao para texto.

Opcional: `model` como query param para override manual (`?model=lar`).

## Validacao e normalizacao

- Datas convertidas para `YYYY-MM-DD` (ISO-8601).
- Valores monetarios normalizados para decimal com `.`.
- Status: `success | partial | failed`.
- Moeda: `BRL | USD | EUR | UNKNOWN`.

## Fonte de verdade

- Tipos: `backend/app/schemas/canonical.py`
- Normalizador: `backend/app/normalizers/canonical.py`
- Pipeline (opcional): `backend/app/pipeline/normalizers.py`
