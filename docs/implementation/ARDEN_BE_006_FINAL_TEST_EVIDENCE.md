# ARDEN-BE-006 — Evidência de testes final

Todas as suítes verdes localmente (nenhuma anterior removida; nenhuma internet real).

## Backend

| Suíte | Resultado |
| --- | --- |
| `npm run typecheck:api` | PASS |
| `npm run lint:api` | PASS |
| `npm run test:api` (unit) | 283 testes PASS |
| `npm run test:api:integration` | 183 testes / 24 arquivos PASS |
| `npm run build:api` | PASS |

### Integração backend por área (ARDEN-BE-006)

| Arquivo | Cobertura |
| --- | --- |
| `connections-api.integration.spec.ts` | Catálogo, CRUD de conexão, **teste funcional** (SecureHttpClient), lifecycle, revision, multitenancy. |
| `connectors-persistence` / `connectors-critical` | Persistência, state machines, revision/ativação concorrente, seed idempotente, cross-tenant. |
| `credential-vault` / `credential-vault-critical` | Cifragem AES-256-GCM, rotação, revogação (crypto-shredding), canário de segredo. |
| `secure-http-client.integration` | Timeout, limites, redirects, SSRF (servidor local). |
| `external-tool.integration` | http/webhook externos, mapping, retry 429/5xx/timeout, UNKNOWN, cross-tenant, canário. |
| `webhook-inbound.integration` | HMAC, raw body, timestamp, replay + concorrência, delivery conflict, trigger→execução→worker, estados, cross-tenant, canário. |

## Contratos

| `npx vitest run src/contracts` | 53 testes PASS |
| `npm run contracts:openapi` | OpenAPI válido, **sem diff** (determinística) |

## Frontend

| Suíte | Resultado |
| --- | --- |
| `npm run typecheck` (monorepo) | PASS |
| `npm run lint` (monorepo) | PASS |
| `npm run test` (unit) | 165 testes / 24 arquivos PASS |
| `npm run test:a11y` | 2 arquivos PASS (axe: 0 críticas/sérias) |
| `npm run build` | PASS |

### Testes frontend de integrações

- `v1-connectors-repository.test.ts` — repositório sobre cliente gerado (idempotency-key
  repassada, erros embrulhados, pass-through de list/create/test/activate).
- `IntegrationsPage.test.tsx` — catálogo renderiza; estados vazio/erro(+retry); criar
  conexão; **canário de segredo de credencial** ausente de DOM/localStorage/
  sessionStorage/Zustand/query-cache; **token one-time** exibido uma vez e limpo ao
  fechar (ausente de storage); **conflito de revisão (409)** recarrega sem sobrescrever;
  ação de criar oculta sem permissão.
- `IntegrationsPage.a11y.test.tsx` — axe sem violações críticas/sérias.

## Testes críticos (§36–§45)

| Crítico | Onde |
| --- | --- |
| Segredo (canário) backend | vault, external-tool, webhook-inbound integração |
| Segredo (canário) frontend | `IntegrationsPage.test.tsx` (storage/DOM/store) |
| One-time token | `IntegrationsPage.test.tsx` + `webhook-inbound.integration` |
| Revision conflict | `IntegrationsPage.test.tsx` + `connections-api.integration` |
| Cross-tenant | tools, webhooks, connections integração |
| Unknown result | `external-tool.integration` |
| Retry | `external-tool.integration` (429/5xx/timeout) |
| Replay | `webhook-inbound.integration` (concorrência + conflito) |
| E2E API + worker | `external-tool` + `webhook-inbound` (fila + worker reais) |

## Migrations / seed

`db:migrate:status` up-to-date; nenhuma migration nova em 006.4–006.8; `db:seed`
idempotente (rodado 2×, `+0`).

## Dependências

Nenhuma dependência de runtime nova em todo o 006 (apenas `node:` nativo).
