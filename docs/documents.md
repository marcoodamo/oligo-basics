# Documentos Parseados

## Objetivo
Persistir e disponibilizar o JSON canonico gerado pelo parser, associado ao `document_id`.

## Persistencia
Tabela `parsed_documents` no SQLite.

Campos:
- `document_id` (PK)
- `filename`, `hash_sha256`
- `schema_version`, `parser_version`
- `status`, `model_name`, `model_confidence`
- `warnings_json`, `missing_fields_json`
- `canonical_json`
- `created_at`, `updated_at`

## Endpoints
- `GET /documents/{id}/parsed`
- `GET /documents/{id}/parsed/download`

## UI
Na tela **Auditoria**, selecione um log para ver:
- Status e modelo
- JSON canonico (colapsavel)
- Warnings e missing_fields
- Botao para download JSON
