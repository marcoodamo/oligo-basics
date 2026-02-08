# Deploy (Docker Compose)

## Pré-requisitos
- Docker + Docker Compose
- Chave da OpenAI

## Passo a passo
1) Configure o `.env` a partir do exemplo:
```bash
cp .env.example .env
# edite e adicione OPENAI_API_KEY
```

2) Suba a stack:
```bash
docker compose up --build
```

## Portas
- **Backend**: `localhost:8010` (conforme `/etc/nginx/sites-available/oligo.fleriz.com.conf`)
- **Frontend**: `localhost:5173`
- **Postgres**: **apenas interno** (sem porta exposta no host)

Se houver conflito de porta no host, altere o mapeamento no `docker-compose.yml`, por exemplo:
```yaml
ports:
  - "8080:8000" # backend
```
 
O Nginx aponta para `127.0.0.1:8010` (API) e `127.0.0.1:5173` (UI), então mantenha esses valores ou ajuste o arquivo do Nginx.

## Banco de dados
- Por padrão o backend usa Postgres via `DATABASE_URL`.
- Para usar SQLite, remova `DATABASE_URL` do ambiente ou sobrescreva com vazio.

## Verificação rápida
```bash
# health
curl http://localhost:8010/health
```

## Acesso via domínio
Se o Nginx estiver configurado, a UI e API ficam disponíveis em:
- `https://oligo.fleriz.com`
- `https://oligo.fleriz.com/api/health`
