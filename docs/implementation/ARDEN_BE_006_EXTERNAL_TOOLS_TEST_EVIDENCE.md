# ARDEN-BE-006.6 — Evidência de testes (ferramentas externas)

## Unidade (`apps/api/src/connectors/tools/*.spec.ts`)

| Spec | Casos |
| --- | --- |
| `tool-mapping.spec.ts` | 14 — path/rename/const/compose, identidade, output; raízes proibidas (env/vault), traversal, múltiplas ops, op desconhecida. |
| `json-schema-validator.spec.ts` | 8 — required/enum/additionalProperties/tipo; input e output. |
| `retry-classifier.spec.ts` | 16 — idempotência; 2xx/429/5xx/4xx; timeout idempotente vs. não idempotente (UNKNOWN); response too large. |
| `auth-builder.spec.ts` | 10 — NONE/BEARER/API_KEY/BASIC/HMAC/CUSTOM_FIXED_HEADERS; header sensível rejeitado; deriveAuthMode. |

## Integração (`apps/api/test/external-tool.integration.spec.ts`) — 14 casos

PostgreSQL, fila, worker e servidor HTTP **local** reais (nunca a internet):

1. http bearer → SUCCEEDED, output validado, evidência sanitizada, **canário ausente**
   em job/evento/evidência/audit/output; auditoria `external_tool.execution_succeeded`.
2. API key header (x-api-key), canário ausente.
3. input/output mapping declarativo (compose/path).
4. **retry 429** (Retry-After) → 200; idempotency-key **estável**.
5. **retry 5xx** → 200.
6. **timeout idempotente** (GET) → retry conforme motor.
7. **resultado incerto** (POST não idempotente, drop após envio) →
   `EXTERNAL_RESULT_UNKNOWN`, sem retry, etapa não vira sucesso, evidência+audit
   `execution_unknown`, canário ausente.
8. conexão suspensa → falha sem tocar o servidor.
9. credencial revogada → falha sem tocar o servidor.
10. **cross-tenant** — alias igual em Alpha e Beta; execução de Alpha usa a conexão de
    Alpha; Beta não enxerga a execução (404).
11. **webhook outbound** — POST JSON assinado (HMAC), Idempotency-Key; segredo de
    assinatura ausente do corpo/headers/evidência.
12. `internal.test` **bloqueado em produção** (`NODE_ENV=production` →
    `TOOL_EXECUTION_DENIED`).
13. `internal.test` funciona fora de produção (echo determinístico).
14. **endpoints de binding** (controllers) + **binding removido** → execução
    fail-fast `EXECUTION_NOT_ALLOWED` (403).

## Testes críticos cobertos

- **Segredo (canário)**: casos 1, 2, 7, 11 comprovam ausência em todas as superfícies.
- **Cross-tenant**: caso 10.
- **Unknown result**: caso 7.
- **Retry**: casos 4–6.

## Não-regressão

Suites existentes do BE-005/006 permanecem verdes (unit da API + integração), incluindo
o fluxo de execução interno (`execution-flow`, `execution-critical`) após a introdução
do registry.
