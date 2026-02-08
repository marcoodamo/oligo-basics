# Configurador de Parser

## Fluxo
1. Recebe arquivo/texto.
2. Faz preview (parse base + normalizacao canonica).
3. Detecta modelo existente (se confianca baixa, recomenda criar novo).
4. Salva modelo com regras de deteccao e mapeamento.

## Endpoints

- `GET /models` — lista modelos registrados.
- `GET /models/{name}` — detalhes do modelo.
- `POST /models` — cria modelo.
- `PUT /models/{name}` — atualiza (gera nova versao se mapping/rules mudarem).
- `POST /models/{name}/activate` — ativa modelo.
- `POST /models/{name}/deactivate` — desativa modelo.
- `POST /models/detect` — testa deteccao para um arquivo (multipart).
- `POST /models/detect/text` — deteccao via JSON.
- `POST /models/preview` — preview do parse canonico (multipart).
- `POST /models/preview/text` — preview via JSON.

## Payloads principais

### Criar modelo

```json
{
  "name": "lar",
  "display_name": "LAR Cooperativa",
  "detection_rules": {
    "keywords": ["lar cooperativa"],
    "customer_names": ["LAR COOPERATIVA"],
    "customer_cnpjs": ["12345678000190"],
    "header_regex": ["^\\s*lar"],
    "required_fields": ["cnpj", "pedido"]
  },
  "mapping_config": {
    "fields": [
      {"source": "order.customer_order_number", "target": "order.order_number"}
    ],
    "item_fields": [
      {"source": "lines[].item_reference_no", "target": "items[].sku"}
    ]
  },
  "examples": ["1885349 Lar.PDF"],
  "created_by": "user-1"
}
```

### Preview

- `POST /models/preview` com arquivo (multipart) ou texto.
- Retorna JSON canonico + sugestao de nome + deteccao.

## Persistencia
- SQLite em `data/parser_models.db` (configuravel via `PARSER_DB_PATH`).

## Versionamento
- Toda atualizacao de regras ou mapping gera nova versao (`v1`, `v2`, ...).
- `current_version` aponta para a versao ativa.
