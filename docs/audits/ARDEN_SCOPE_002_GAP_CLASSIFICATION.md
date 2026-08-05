<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002.1 — Classificação dos gaps

Pré-análise obrigatória antes de qualquer código. Base: `docs/audits/arden-scope-001-gaps.json`.

| Gap | Scope | Severidade | Requer dev | Classificação | Ação |
| --- | --- | --- | --- | --- | --- |
| GAP-001 | SCOPE-FE-007 | P1 | sim | EXCLUDED_FRONTEND_GENERAL | 15 rotas demo — Exclusão A (não migrar em massa) |
| GAP-002 | SCOPE-APV-004/FE-010 | P1 | sim | IN_SCOPE | Resolver repositórios órfãos (approvals/files) |
| GAP-003 | SCOPE-EXE-003 | P2 | sim | EXCLUDED_FRONTEND_GENERAL | UI de execuções é rota demo (migração de página = Exclusão A); backend pronto + alcançável |
| GAP-004 | SCOPE-AUTH-LEVEL-003 | P2 | sim | EXCLUDED_FRONTEND_GENERAL | UI de autoridade é rota demo; idem |
| GAP-005 | SCOPE-FE-008 | P2 | sim | IN_SCOPE | Corrigir regressão createFromAssessment (lança em api) |
| GAP-006 | SCOPE-PERM-004 | P2 | sim | EXCLUDED_FRONTEND_GENERAL | Gestão de papéis sem backend pronto p/ conectar (não é conexão localizada) |
| GAP-007 | SCOPE-WU-001 | P2 | decisão | IN_SCOPE | Decidir modelagem de Work Unit |
| GAP-008 | SCOPE-DB-003 | P2 | sim | IN_SCOPE | Corrigir corrida no seed |
| GAP-009 | SCOPE-AI-004 | P1 | — | EXCLUDED_ANTHROPIC | Exclusão B |
| GAP-010 | SCOPE-INF-002 | P1 | — | EXCLUDED_INFRASTRUCTURE | Exclusão B |
| GAP-011 | SCOPE-PRD-001 | P0 | — | EXCLUDED_INFRASTRUCTURE | Exclusão B (gate de produção) |
| GAP-012 | SCOPE-INF-012 | P2 | — | EXCLUDED_INFRASTRUCTURE | Exclusão B |
| GAP-013 | SCOPE-PRD-002 | P1 | — | EXCLUDED_INFRASTRUCTURE | Exclusão B (jurídico) |

## Justificativa de fronteira (Exclusão A)
As UIs de execuções (GAP-003), autoridade (GAP-004) e governança/aprovações (parte de
GAP-002) são **rotas de demonstração** entre as ~15 que a Exclusão A proíbe migrar em massa.
Conectá-las é uma **migração de página** (troca de `useScopedData`/snapshot por consumo de
API real com estados/roteamento), não uma "conexão localizada" de repositório. Por isso o
**artefato localizado** (os repositórios API órfãos) é resolvido nesta fase, e a migração
das páginas fica registrada com plano acionável (`ARDEN_SCOPE_002_BACKEND_UI_INTEGRATION.md`).
O backend dessas features está pronto e **alcançável via cliente gerado** — nenhum
desenvolvimento de backend permanece pendente para elas.

## Resultado
IN_SCOPE: GAP-002, GAP-005, GAP-007, GAP-008 → todos endereçados nesta fase.
