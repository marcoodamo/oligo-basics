# Testes

## Backend (unitários + integração leve)
```bash
cd backend
pytest -q
```

## Smoke test de API
1) Suba o compose.
2) Execute:
```bash
curl -X POST http://localhost:8010/parse/text \
  -H "Content-Type: application/json" \
  -d '{"text": "PEDIDO LAR\nCNPJ: 12.345.678/0001-90\nTOTAL: R$ 123,45"}'
```

3) Consulte logs:
```bash
curl "http://localhost:8010/logs?limit=5"
```

## Validação do JSON canônico
- Use `GET /documents/{id}/parsed` após processar um arquivo para confirmar o schema.
