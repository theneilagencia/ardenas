# ARDEN-BE-008.1 — evidência de testes e gates

Execução local em 2026-08-03. PostgreSQL local de dev iniciado para os gates de banco e a suíte
de integração. Nenhuma chamada externa; nenhuma key real; nenhum SDK instalado.

## 1. Testes contratuais do provider (novos)

`cd apps/api && npx vitest run src/agents/providers/anthropic/`

```
✓ anthropic-contracts.spec.ts (9)
✓ anthropic-mappers.spec.ts (19)
✓ anthropic-safety.spec.ts  (6)
Test Files 3 passed (3) · Tests 34 passed (34)
```

Cobertura:
- **Contratos**: chaves únicas; provider `DISABLED`/`productionAllowed=false`/`CONTRACT_ONLY`;
  catálogo allowlisted (rejeita `gpt-4` e `claude-not-real`); snapshots datados; `≥1` fonte por
  entrada; limites `null`-ou-positivos; rate cards **vazios**; custo `ceil` BigInt sem float;
  `rate=0` conhecido → `0n`.
- **Mappers**: system separado; `modelId` fora da allowlist rejeitado; structured output via tool
  sintética; payload sem `organizationId`/`apiKey`/baseURL; StopReason→finishReason; usage
  `cache_read`→`cachedInputTokens` (creation não dobrado); matriz de erro; retry (retryable no
  teto/deadline; não-retryable; **incerto nunca retriado** = `uncertain_result_not_retried`;
  excede teto; deadline insuficiente).
- **Safety**: guard de dependências (nenhum SDK comercial em package.json); guard de rede (sem
  `fetch`/`http`/`axios`/SDK nos fontes do adapter); provider não executável (sem arquivos de
  client, definição `DISABLED`); canário de segredo ausente; credencial write-only; base URL só
  `OFFICIAL`.

## 2. Matriz de gates

| Gate | Comando | Resultado |
| --- | --- | --- |
| Typecheck (root) | `npm run typecheck` | PASS |
| Lint (root) | `npm run lint` | PASS (0 warnings) |
| Test (frontend) | `npm run test` | PASS — 249/249 (34 arquivos) |
| Contracts build | `npm -w @arden/contracts run build` | PASS |
| OpenAPI gerado | `npm run contracts:openapi` | PASS — **sem diff** em `docs/api/openapi-v1.yaml` |
| Typecheck (API) | `npm run typecheck:api` | PASS |
| Lint (API) | `npm run lint:api` | PASS (0 warnings) |
| Test (API unit) | `npm run test:api` | PASS — 444/444 (43 arquivos, inclui 3 specs Anthropic) |
| Test (API integração) | `npm run test:api:integration` | PASS — 238/238 (31 arquivos) |
| Build (API) | `npm run build:api` | PASS |
| DB migrate status | `npm run db:migrate:status` | PASS — 10 migrations, schema up to date (**nenhuma nova**) |
| DB seed (idempotente) | `npm run db:seed` ×2 | PASS — segunda execução idempotente |

## 3. Invariantes verificados pós-mudança

- **Prisma/migração**: `git status apps/api/prisma/` vazio; 10 migrations (inalterado).
- **Dependências/SDK**: `package.json`/`package-lock.json` sem alteração; nenhum SDK comercial.
- **OpenAPI**: `docs/api/openapi-v1.yaml` sem diff após regenerar (barrel não toca `registry.ts`).
- **Provider não executável**: definição `DISABLED`, `CONTRACT_ONLY`, não registrado no runtime.
- **Frontend funcional**: `src/features`/`src/services` do agente não alterados nesta fase.
- **Árvore de trabalho**: apenas docs + contratos Anthropic + adapter puro + specs.
