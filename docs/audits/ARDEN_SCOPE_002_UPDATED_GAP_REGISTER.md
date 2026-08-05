<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002 — Registro de gaps atualizado

Reclassificação dos 13 gaps de ARDEN-SCOPE-001. Fonte: `arden-scope-002-gaps.json`.
Todo gap CLOSED tem commit + código + teste + evidência + Scope ID.

| Gap | Scope | Sev | scope-002 status | Evidência |
| --- | --- | --- | --- | --- |
| GAP-002 | SCOPE-APV-004/FE-010 | P1 | **CLOSED** | commit f90a9d3; órfãos removidos; container rewired; providers.test/architecture verdes |
| GAP-005 | SCOPE-FE-008 | P2 | **CLOSED** | commit 717f102; createFromAssessment real em api; v1-operations-repository.test |
| GAP-007 | SCOPE-WU-001 | P2 | **CLOSED** | SUPERSEDED_BY_EXISTING_AGGREGATE; WORK_UNIT_DECISION; execução/uso testados |
| GAP-008 | SCOPE-DB-003 | P2 | **CLOSED** | commit aaddd4b; seed-idempotency.integration.spec (6 paralelos); 271/271 |
| GAP-001 | SCOPE-FE-007 | P1 | EXCLUDED_BY_PHASE | Exclusão A (15 rotas demo) |
| GAP-003 | SCOPE-EXE-003 | P2 | EXCLUDED_BY_PHASE | UI de execuções (migração de página demo); backend pronto + plano |
| GAP-004 | SCOPE-AUTH-LEVEL-003 | P2 | EXCLUDED_BY_PHASE | UI de autoridade (idem) |
| GAP-006 | SCOPE-PERM-004 | P2 | EXCLUDED_BY_PHASE | Gestão de papéis sem backend pronto p/ conectar |
| GAP-009 | SCOPE-AI-004 | P1 | BLOCKED_BY_EXTERNAL_PROVIDER | Exclusão B — Anthropic live |
| GAP-010 | SCOPE-INF-002 | P1 | BLOCKED_BY_DECISION | Exclusão B — infraestrutura |
| GAP-011 | SCOPE-PRD-001 | P0 | BLOCKED_BY_DECISION | Exclusão B — produção/go-live |
| GAP-012 | SCOPE-INF-012 | P2 | BLOCKED_BY_DECISION | Exclusão B — on-call |
| GAP-013 | SCOPE-PRD-002 | P1 | BLOCKED_BY_DECISION | Exclusão B — jurídico/DPA |

## Resumo
- **CLOSED:** 4 (GAP-002/005/007/008) — todos com commit + teste.
- **EXCLUDED_BY_PHASE:** 4 (GAP-001/003/004/006) — frontend geral (Exclusão A).
- **BLOCKED_BY_EXTERNAL_PROVIDER:** 1 (GAP-009).
- **BLOCKED_BY_DECISION:** 4 (GAP-010/011/012/013).
- **STILL_OPEN independente:** **0** (todo gap técnico independente disponível foi fechado).

## P0/P1 independentes
- P0: GAP-011 (produção) = BLOCKED_BY_DECISION (Exclusão B) — nenhum P0 independente aberto.
- P1 independentes: GAP-002 CLOSED. Demais P1 (GAP-001/009/010/013) são exclusões formais.
Nenhum P0/P1 **independente das exclusões** permanece aberto.
