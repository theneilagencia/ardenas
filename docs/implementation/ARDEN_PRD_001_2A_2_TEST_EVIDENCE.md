<!-- Milestone: ARDEN-PRD-001.2A.2 -->
# ARDEN-PRD-001.2A.2 — Evidência de testes

Executado localmente com PostgreSQL 16 (conexão direta = DATABASE_URL, sem pooler).

## Gates padrão (verdes)
| Gate | Resultado |
| --- | --- |
| typecheck | PASS |
| lint | PASS |
| test (frontend unit + a11y + infra) | 305 (41 files) + a11y 3 — PASS |
| build | PASS |
| contracts:openapi | **zero drift** (98 paths) |
| typecheck:api | PASS |
| lint:api | PASS |
| test:api (unit) | 555 PASS |
| test:api:integration | 267 PASS |
| test:api:execution:integration | 10 PASS |
| build:api | PASS |
| db:migrate:status | up to date (11 migrations) |

## Gates offline novos
| Gate | Resultado |
| --- | --- |
| infrastructure:decision:validate | **FAIL** (exit 1) — controlado por pendências humanas (esperado) |
| infrastructure:contracts:validate | PASS (9 módulos) |
| infrastructure:environments:validate | PASS |
| infrastructure:alerts:validate | PASS (19) |
| infrastructure:runbooks:validate | PASS (15) |
| infrastructure:iam:validate | PASS |
| artifact:build / artifact:verify | PASS (por SHA; sem latest; sem secret) |
| infra vitest project | 34 PASS (30 cenários + auxiliares) |

## Prisma DIRECT_URL
Migrations aplicam via conexão direta; `migrate status` up to date; nenhuma migration criada;
suítes de integração (incl. migration + reencryption) verdes. Fallback DIRECT_URL→DATABASE_URL
coberto por teste de config.

## Fail-closed comprovado
deploy:*, production:migrate → FAIL-CLOSED; backup/restore adapter → NOT_SELECTED; restore
drill → BLOCKED; smoke sem URL → não executa; egress Anthropic/curinga → rejeitado.
