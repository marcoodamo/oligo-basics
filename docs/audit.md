# Auditoria de Processamento

## Objetivo
Registrar cada tentativa de processamento (sucesso, parcial ou falha) com metadados de modelo, arquivo e erros para auditoria.

## Persistência
Tabela `processing_logs` no SQLite (`data/parser_models.db` por padrao, override via `PARSER_DB_PATH`).

Campos principais:
- `id`
- `document_id`
- `filename`
- `hash_sha256`
- `company_name`
- `model_name`
- `model_confidence`
- `parser_version`
- `status` (success|partial|failed)
- `started_at`, `finished_at`, `duration_ms`
- `warnings_count`, `errors_count`
- `error_summary`
- `correlation_id`
- `triggered_by`
- `raw_metadata`

## Endpoints

- `GET /logs` (filtros: `status`, `model`, `filename`, `company`, `date_from`, `date_to`)
- `GET /logs/{log_id}`

## UI
Na tela **Auditoria**, disponivel no frontend:
- Tabela com filtros
- Detalhe do log em JSON

## Observacoes
- `correlation_id` e `document_id` sao gerados por request quando nao enviados.
- `raw_metadata` inclui evidencias de deteccao e contexto de fallback.
