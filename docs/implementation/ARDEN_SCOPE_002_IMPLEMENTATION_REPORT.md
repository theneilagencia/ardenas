<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002 — Relatório de implementação

Branch `claude/arden-scope-002-gap-closure` de `ba0f974`. Fecha 4 gaps técnicos
independentes; preserva as duas exclusões. Nenhuma migração criada; schema Prisma e OpenAPI
inalterados.

## Mudanças de código
| Arquivo | Mudança | Gap |
| --- | --- | --- |
| `apps/api/prisma/seed.ts` | `createMany({skipDuplicates})` + P2002 re-fetch (concorrência-seguro) | GAP-008 |
| `apps/api/test/seed-idempotency.integration.spec.ts` | teste (6 seeds paralelos) | GAP-008 |
| `src/services/service-container.ts` | remove órfãos; api-mode approvals/files → snapshot | GAP-002 |
| `src/services/repositories/approvals-api.ts`, `files-api.ts` | **removidos** (código morto, contrato legado) | GAP-002 |
| `src/services/api/v1-operations-repository.ts` | `createFromAssessment` cria operação real (api) | GAP-005 |
| `src/services/api/v1-operations-repository.test.ts` | teste do assessment em api | GAP-005 |

## Work Unit (GAP-007)
Decisão **SUPERSEDED_BY_EXISTING_AGGREGATE** (execução + usage/custo) — sem nova entidade,
sem migração. Ver `docs/audits/ARDEN_SCOPE_002_WORK_UNIT_DECISION.md`.

## Invariantes preservados
Isolamento multi-tenant, authority/policy/approval enforcement, credential write-only +
vault + keyring, readiness fail-closed, auditoria/evidência, idempotência/revision, worker
lease, **Anthropic DISABLED**, entry gate de infraestrutura **FAIL**. OpenAPI zero drift.

## Fora de escopo (exclusões, não implementado)
Migração geral das rotas demo; UIs de execuções/autoridade/governança/aprovações (plano em
`ARDEN_SCOPE_002_BACKEND_UI_INTEGRATION.md`); Anthropic live; infraestrutura/produção.

Commit de referência: `717f102395f929e64b95d9bc992c86248963f841`.
