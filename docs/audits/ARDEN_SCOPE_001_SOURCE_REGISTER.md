<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Registro de fontes de escopo

Classificação de autoridade: CANONICAL_SCOPE · APPROVED_DECISION · IMPLEMENTATION_PLAN ·
IMPLEMENTATION_REPORT · AUDIT_EVIDENCE · HISTORICAL · NON_BINDING. Precedência em conflito:
decisão aprovada mais recente → código/comportamento reproduzível → contrato atual →
documentação histórica.

| Fonte | Classificação | Autoridade |
| --- | --- | --- |
| `docs/frontend/*` (14) — referência funcional, inventário de rotas/features | CANONICAL_SCOPE | Escopo de produto/FE |
| `docs/backend/*` (184) — specs, relatórios de fase, evidências de teste | IMPLEMENTATION_REPORT / AUDIT_EVIDENCE | Histórico de implementação (a confirmar por código) |
| `docs/api/openapi-v1.yaml` (+13) | CANONICAL_SCOPE (contrato) | Contrato atual de API (gerado; zero drift) |
| `docs/implementation/*` (86) — planos, relatórios, evidências, closeouts, residual risks | IMPLEMENTATION_PLAN / IMPLEMENTATION_REPORT | Alegações a confirmar |
| `docs/production/*` (71) — readiness, go-live gates, backlog, risk register | IMPLEMENTATION_PLAN / APPROVED_DECISION | Infra/produção (documental/preparada) |
| `docs/decisions/ADR-0001*` (2) | APPROVED_DECISION (status PROPOSED) | Decisão de infraestrutura pendente |
| `docs/runbooks/*` (17) | NON_BINDING (operacional) | Procedimentos |
| Código (`src/`, `apps/api/src/`), Prisma, testes | **PRECEDÊNCIA MÁXIMA** | Comportamento reproduzível |

## Conflitos registrados (ver `ARDEN_SCOPE_001_DOCUMENT_CONTRADICTIONS.md`)
- Relatórios históricos marcam vários itens como PASS/CONCLUÍDO; a auditoria confirma o
  **backend** por execução, mas reclassifica **frontend** de várias rotas como `MOCK_ONLY`
  (renderiza ≠ desenvolvido) e infra/produção como `PREPARED`/`BLOCKED`.
- `docs/product/` e `docs/specs/` estão **vazios** (0 arquivos); a referência funcional vive
  em `docs/frontend/` e nos contratos.
