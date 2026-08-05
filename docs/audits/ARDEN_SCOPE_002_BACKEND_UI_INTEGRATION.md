<!-- Milestone: ARDEN-SCOPE-002 -->
# ARDEN-SCOPE-002.2 — Backends prontos e repositórios órfãos

## Os quatro backends prontos não conectados (da auditoria)
Localizados na matriz de rastreabilidade + cliente gerado (`src/services/api/generated/api-v1-client.ts`):

| Feature | Módulo backend | Endpoints | Método do cliente gerado | Repo/serviço FE | Rota/componente | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| Execuções | `executions/*` | `/executions`(+steps/events/evidence) | `listExecutions`/`getExecution`/`listExecutionSteps`… | `useScopedData().executions` (snapshot) | `/executions` | GAP-003 |
| Aprovações | `approvals/*`+`enforcement` | `/approval-requests`(+flows/delegations) | `listApprovalRequests`/`approveApprovalRequest`… | snapshot + repo órfão | `/approvals`,`/governance` | GAP-002/004 |
| Autoridade | `operations/authority`+`enforcement` | `/…/authority`, evaluate/validate | `getAuthorityProfile`/`updateAuthorityProfile` | `useScopedData().authorityMatrix` | `/authority` | GAP-004 |
| Governança/Políticas | `policies/*` | `/policies`(+bindings) | `listPolicyBindings`/`createPolicy`… | snapshot | `/governance` | GAP-002 |

Prova (para cada): endpoint existe (controller), contrato existe (OpenAPI 98 paths),
persistência existe (Prisma), autorização + tenant isolation existem (guards + scoping),
testes backend existem (integração). **A ausência é exclusivamente de integração frontend**
— confirmando a auditoria.

## Repositórios órfãos — RESOLVIDOS (GAP-002)
Confirmados dois: `ApiApprovalsRepository` (`repositories/approvals-api.ts`) e
`ApiFilesRepository` (`repositories/files-api.ts`).

- **Estado factual:** ambos **nunca chamados** por página/use-case; implementam contratos
  **legados** (`/approvals/*`, `/files/*`) de `docs/handoff/API_CONTRACTS.md` que **não
  existem** na API v1 real (aprovações reais são `/approval-requests`; **não há** domínio
  `/files`).
- **Decisão:** **remover** (código morto superseded). `git rm` de ambos; container rewired
  para usar os repositórios de **snapshot** em modo api (commit f90a9d3).
  - **Approvals:** feature obrigatória **não** removida — o fluxo de aprovação REAL vive no
    backend (`/approval-requests`, enforcement, agent-resume) e é coberto por
    `enforcement-flow`, `approval-concurrency`, `agent-tool-calling §38`. A página `/approvals`
    permanece superfície de demonstração (Exclusão A). "Substituir por implementação canônica
    existente" (§9) = o backend real.
  - **Files:** **sem** domínio backend e **sem** requisito canônico aprovado (§11) → demo-only.
- **Órfãos remanescentes:** **0**.

## Integração localizada entregue
- **createFromAssessment** (GAP-005): repositório v1 agora cria operação REAL em modo api
  (antes lançava UNAVAILABLE) — commit 717f102 + teste.

## Migração de páginas demo (execuções/autoridade/governança/aprovações) — plano (deferido)
Registrado como Exclusão A (rota demo). Plano acionável, backend pronto:
1. Adicionar `executions`/`authority`/`policies` a `ArdenServices` (contrato).
2. Criar repositórios `api/v1-*-repository.ts` sobre o cliente gerado (mapeando
   `ExecutionRun→Execution`, `status→ExecutionState`; `ApprovalRequest→Approval`;
   `AuthorityProfile`).
3. Hooks `useExecutions`/`useAuthority`/`usePolicies` (api em modo api, snapshot em demo).
4. Páginas consomem os hooks; estados loading/empty/error/forbidden/conflict; testes +
   api-mode E2E.

Nenhum backend novo é necessário — a lacuna é puramente de fiação de UI.
