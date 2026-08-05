<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002 — Plano de fechamento de gaps

Base: auditoria ARDEN-SCOPE-001 (`ba0f974`). Objetivo: fechar gaps técnicos **independentes**
sem violar as exclusões (frontend-mock geral; Anthropic/infra). Gates 002.1–002.6 + closeout.

| Gate | Escopo | Entregável |
| --- | --- | --- |
| 002.1 | Classificação de gaps | `ARDEN_SCOPE_002_GAP_CLASSIFICATION.md` |
| 002.2 | Backends prontos + repositórios órfãos | `ARDEN_SCOPE_002_BACKEND_UI_INTEGRATION.md`; remoção de órfãos; createFromAssessment |
| 002.3 | Work Unit | `ARDEN_SCOPE_002_WORK_UNIT_DECISION.md` (SUPERSEDED) |
| 002.4 | Seeds/fixtures | `ARDEN_SCOPE_002_SEED_FIXTURE_AUDIT.md`; correção da corrida |
| 002.5 | E2E + regressão | `ARDEN_SCOPE_002_E2E_RESULTS.md` (19/19) |
| 002.6 | Docs + reauditoria | reconciliação, scores, veredito, JSON/CSV scope-002 |

## Gaps IN_SCOPE e ação
- GAP-008 (seed) → corrigir + testar. **CLOSED**.
- GAP-002 (órfãos) → remover código morto + rewire. **CLOSED**.
- GAP-005 (assessment) → implementar em api. **CLOSED**.
- GAP-007 (Work Unit) → decidir (superseded). **CLOSED**.

## Exclusões (não implementar)
- GAP-001/003/004/006 → Exclusão A (migração de rotas demo).
- GAP-009 → Exclusão B (Anthropic live).
- GAP-010/011/012/013 → Exclusão B (infra/produção/jurídico).
