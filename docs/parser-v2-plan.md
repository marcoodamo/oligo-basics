# Parser v2 - scaffold e plano incremental

## Fluxo (diagrama textual)

```
Entrada (PDF/Text)
  -> Ingest (pdf->texto)
  -> Deterministic parse (regex)
  -> Model detector
  -> Parser por modelo
  -> Normalizer (JSON canonico)
  -> Audit logger
  -> API response

Feature flag:
  PARSER_PIPELINE=legacy -> pipeline atual (LangGraph)
  PARSER_PIPELINE=v2     -> pipeline novo (scaffold + registry)
```

## Mudancas por etapa

1) **Scaffold (este PR)**
- Interfaces base: ModelDetector, ModelParser, Normalizer, AuditLogger.
- Registry de modelos via YAML (backend/config/models.yaml).
- Adapter para pipeline legado (nao altera comportamento atual).
- Audit logger opcional (JSONL via AUDIT_LOG_PATH).
- Feature flag em runtime (PARSER_PIPELINE).

2) **Deteccao de modelo (iteracao 1)**
- Enriquecer regras: nomes, CNPJs, keywords, estrutura de layout.
- Introduzir score por regra + motivo (para auditoria).
- Adicionar testes de classificacao.

3) **Parsers por modelo + normalizacao canonica**
- Criar parser especifico (ex: LAR) com schema intermediario.
- Normalizer converte para JSON canonico.
- Manter compat layer para modelos nao migrados.

4) **Registry e configurador**
- Validacao de YAML (schema).
- CLI/configurador para criar novos modelos e validar regras.
- Versionamento de modelos e baselines de teste.

5) **Auditoria persistente**
- Persistencia em DB (tabela/colecao).
- Correlacao com request_id e artefatos (hash do input).
- Dashboard simples para taxa de acerto por modelo.

## Riscos e rollback

- **Risco**: deteccao errada de modelo -> parser incorreto.
  - Mitigacao: score minimo + fallback para "generic".
- **Risco**: novas regras conflitam com legados.
  - Mitigacao: feature flag + modelos isolados.
- **Risco**: volume de logs no audit.
  - Mitigacao: habilitar por ambiente e rotacao externa.

**Rollback rapido**:
- Setar `PARSER_PIPELINE=legacy` para voltar ao fluxo atual.
- Desabilitar modelo especifico em `backend/config/models.yaml`.
- Remover `AUDIT_LOG_PATH` para desligar auditoria.
