# Implementação: Parser canônico + modelos + auditoria + persistência

## Visão geral do fluxo
1) Upload/ingestão → OCR/base parser → texto bruto
2) Detecção de modelo (registry + regras) → `model_name`, confiança, evidências
3) Parser do modelo (lar/brf/generic) → estrutura intermediária
4) Normalização → JSON canônico versionado
5) Persistência → `parsed_documents` + `processing_logs`
6) Exposição → APIs + UI (auditoria/configurador)

## Componentes principais
- **Schema canônico**: `backend/app/schemas/canonical.py` (versionado)
- **Normalizer**: `backend/app/normalizers/canonical.py`
- **Pipeline v2**: `backend/app/pipeline/runner.py`
- **Model registry (yaml + DB)**: `backend/app/pipeline/registry.py` + `backend/config/models.yaml`
- **Detecção de modelo**: `backend/app/pipeline/detector.py`
- **Parsers por modelo**: `backend/app/pipeline/parsers/*`
- **Persistência canônica**: `backend/app/repositories/parsed_documents.py`
- **Auditoria**: `backend/app/repositories/processing_logs.py` + `backend/app/api/logs.py`
- **Configurator/API de modelos**: `backend/app/api/models.py`

## Deploy via Docker Compose (Postgres padrão)
Compose já levanta **Postgres + backend + frontend**. O backend usa Postgres quando `DATABASE_URL` estiver definido.

Docs dedicadas:
- Deploy: `docs/deploy.md`
- Testes: `docs/testing.md`

### Comandos
```bash
# build + up

docker compose up --build

# (opcional) rebuild só backend

docker compose build backend
```

### Variáveis relevantes
- `DATABASE_URL` (default no compose): `postgresql://parser:parser@postgres:5432/parser`
- `PARSER_PIPELINE` (default): `v2`
- `OCR_ENABLED` (default): `false`

Se remover `DATABASE_URL`, o backend volta a usar SQLite (`PARSER_DB_PATH`).

## APIs principais
- **Parser**
  - `POST /parse` (ou endpoint já existente) → roda pipeline e retorna resultado canônico + logs
- **Documentos**
  - `GET /documents/{id}/parsed` → JSON canônico persistido
  - `GET /documents/{id}/parsed/download` → download do JSON
- **Modelos**
  - `GET /models`
  - `POST /models` (criar)
  - `PATCH /models/{name}` (atualizar)
  - `POST /models/detect` (arquivo) / `POST /models/detect/text`
  - `POST /models/preview` (arquivo → preview canônico)
- **Auditoria**
  - `GET /logs` (filtros por status/model/date/filename/company)
  - `GET /logs/{id}`

## Testes
```bash
# backend
cd backend
pytest -q
```

Casos cobertos:
- normalização e validação básica do schema
- detecção de modelos
- pipeline v2 (fallback, override manual)
- persistência e APIs de parsed documents e logs

## Observações de compatibilidade
- O formato legado ainda pode ser retornado via compat layer, mas o canônico é o principal.
- Quando a detecção falha, o modelo `generic` é usado com status `partial` e warnings.

## Como validar rápido
1) Suba o compose
2) Envie um arquivo de `./arquivos` para o endpoint de parse
3) Consulte `GET /documents/{id}/parsed` e `GET /logs` para confirmar persistência
