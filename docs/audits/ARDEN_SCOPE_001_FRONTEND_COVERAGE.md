<!-- Milestone: ARDEN-SCOPE-001 -->
# ARDEN-SCOPE-001 — Cobertura de frontend

**Provedor de dados padrão = `indexeddb`** (demonstração com seed) —
`src/services/service-container.ts:37`. Só o **modo `api`** consome o backend; nele, apenas
6 domínios estão ligados a `ArdenServices` (operations, audit, approvals, files, connectors,
agents) e o app-store carrega `emptySnapshot`. Permissões são reais em toda rota
(`RequirePermission`/`PermissionBoundary`).

## Classificação por rota (≈40)
| Grupo | Rotas | Status |
| --- | --- | --- |
| Núcleo operações (api-real) | `/operations`, `/operations/new`, `/operations/:id`, `/environments` | COMPLETE |
| Agentes/IA (api-real) | `/agents`(+detalhe/versões), `/model-configurations`, `/agent-results`, `/agent-usage` | COMPLETE |
| Integrações/Anthropic (api-real) | `/integrations`, `/anthropic` | COMPLETE |
| Auditoria/Segurança (api-real, leitura) | `/audit`, `/security` | COMPLETE |
| Dashboard | `/` (ops real + contadores snapshot) | PARTIAL |
| **Demo/snapshot-only** | `/executions`(+:id), `/approvals`, `/results`, `/evidence`, `/exceptions`, `/work-units`, `/authority`, `/governance`, `/risk`, `/context`, `/files`, `/deployment`, `/people`, `/reports`, `/budget` | MOCK_ONLY |
| Assessment/Avaliador | `/assessment` (lança em api), `/evaluator` (estado local) | MOCK_ONLY |
| Estáticos/redirects | `/roles`, `/admin`, `/policies`→`/governance`, `/organizations`→`/admin` | STATIC/REDIRECT |

## Sinais legítimos vs gaps
- **Legítimo:** modo demonstração com IndexedDB + seed; permissões reais; command palette;
  tour; drawers; a11y (3 specs axe).
- **Gaps funcionais:** ~15 rotas não conectadas ao backend (vazias em api); 4 backends
  prontos sem consumidor (execuções, aprovações, autoridade, governança);
  `ApiApprovalsRepository`/`ApiFilesRepository` órfãos; `createFromAssessment` lança em api.

## E2E
- **Backend real (`e2e/api/`):** apenas `/`, `/operations`, `/anthropic`.
- **Demo (`e2e/`):** `/`, `/operations`(+new), `/deployment`, `/risk`.
- **Sem E2E:** ~30 rotas.

Rotas: **auditadas ≈40** · **totalmente funcionais (api-real) ≈14** · **mock-backed ≈17** ·
**estáticas/redirect ≈6** · **inacessíveis 0** (todas roteadas; permissões podem negar).
