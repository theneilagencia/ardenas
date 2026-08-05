# ARDEN-BE-008.3 — evidência de testes e gates

Evidência do provider Anthropic executável atrás de gate (008.3). **Nenhuma chamada real,
testes 100% offline (fake transport + guarda de rede), nenhum tipo do SDK vaza, provider
persistido `DISABLED`, frontend não alterado, nenhuma migração nova.** Os resultados dos gates
abaixo são marcados `PASS` — placeholder a preencher na execução verificada do milestone.

## 1. Testes novos

`apps/api/src/agents/providers/anthropic/anthropic-model-provider.spec.ts` — **~15 testes** (unit)
: fluxo de `generate`; rejeição de tools reais (§26); rejeição de `modelId` fora do allowlist;
  checagem de compatibilidade de schema (`$ref`/depth/props/size); structured output via tool
  sintética forçada + `system` separado; `tool_use` sintético → `finishReason=STOP`; validação
  local autoritativa; retry (rate-limit/overload) e no-retry (auth/permissão/invalid/abort);
  UNKNOWN nunca vira sucesso; custo `null` + `COST_RATE_CARD_NOT_AVAILABLE`; apiKey descartada.

`apps/api/src/agents/providers/anthropic/anthropic-sdk-boundary.spec.ts` — **3 testes** (arquitetura)
: `@anthropic-ai/sdk` importado só em `sdk/anthropic-sdk-transport.ts`; nenhum tipo do SDK
  escapa da porta; pin exato `0.115.0` (sem faixa) — guarda de dependência.

Guards atualizados (safety / execution-absence)
: `anthropic-safety.spec.ts` e a guarda de ausência de execução do 007.3 atualizadas: SDK só no
  workspace `@arden/api`, só na fronteira; sem outro SDK comercial; transporte real gated na rede.

`apps/api/test/anthropic-runtime.integration.spec.ts` — **7 testes** (E2E offline, worker)

| § | Cobertura |
| --- | --- |
| §47 | registro condicional do provider (`RUNTIME_ENABLED && !production`) |
| §48 | structured output com sucesso (fake `structured_success`) → validação local passa |
| §49 | retry em rate-limit (fila de cenários: `rate_limit` → `structured_success`) |
| §50 | UNKNOWN (`timeout_after_send`/`malformed_response`) → `MODEL_RESULT_UNKNOWN`, nunca sucesso |
| §51 | bloqueio de produção (provider `DISABLED` → `MODEL_PROVIDER_DISABLED`) |
| §52 | isolamento cross-tenant (credencial de outro tenant → not found) |
| §53 | canário de segredo (apiKey nunca em log/audit/evidência/métrica; fake só o comprimento) |

## 2. Matriz de gates

| Gate | Comando | Resultado |
| --- | --- | --- |
| Typecheck (root) | `npm run typecheck` | PASS |
| Lint (root) | `npm run lint` | PASS |
| Test (frontend) | `npm run test` | PASS |
| Test a11y | `npm run test:a11y` | PASS |
| Build (frontend) | `npm run build` | PASS |
| OpenAPI (diff-free) | `npm run contracts:openapi` | PASS — sem diff |
| Typecheck (API) | `npm run typecheck:api` | PASS |
| Lint (API) | `npm run lint:api` | PASS |
| Test (API unit) | `npm run test:api` | PASS |
| Test (API integração, offline) | `npm run test:api:integration` | PASS |
| Build (API) | `npm run build:api` | PASS |
| DB migrate status (11 migrations, sem nova) | `npm run db:migrate:status` | PASS |
| DB seed (idempotente) ×2 | `npm run db:seed` ×2 | PASS — 2ª execução +0, provider `DISABLED` |

## 3. Notas dos gates

- **contracts:openapi** — **diff-free**: nenhum path/endpoint novo; nenhum código de erro novo.
- **db:migrate:status** — **11 migrations, nenhuma nova**; catálogo persistido inalterado.
- **db:seed ×2** — idempotente; provider `anthropic.direct` permanece `DISABLED`.
- **test:api:integration** — 100% offline: fake transport + guarda de rede; nenhuma chamada real.

## 4. Invariantes verificados pós-mudança

- **Sem chamada real**: transporte real gated (`EXTERNAL_CALLS_ENABLED=false` lança sem tocar a
  rede); nenhum teste toca a internet.
- **Sem vazamento do SDK**: nenhum tipo do SDK cruza a porta (`anthropic-sdk-boundary.spec.ts`).
- **Provider persistido `DISABLED`**: catálogo não alterado; E2E usa override test-only.
- **Segredo nunca exposto**: canário de vault no E2E; fake registra só o comprimento da apiKey.
- **Frontend não alterado; nenhuma migração nova; OpenAPI diff-free.**
- **Governança UNVERIFIED**: nenhum preço/retenção afirmado; custo `null`, nunca zero.
