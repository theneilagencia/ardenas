# Arquitetura de Aprovações (ARDEN-BE-004)

Módulo `apps/api/src/approvals/`. Depende de `EnforcementModule` (reavaliar a ação na
criação e emitir a autorização na aprovação).

## Componentes

- **ApprovalFlowsService** — fluxos e etapas (ver `APPROVAL_WORKFLOW_MODEL.md`).
- **ApprovalRequestsService** — solicitações e decisões (núcleo do enforcement humano).
- **ApprovalDelegationsService** — delegação temporária de elegibilidade
  (`APPROVAL_DELEGATION.md`).
- **ApprovalsRepository** — leitura escopada por tenant; resolve papéis do ator e
  delegações ativas.

## Ciclo da solicitação

1. **Criação** (`POST /operations/{id}/approval-requests`) — o servidor **reavalia** a
   ação. Só existe solicitação quando a decisão é `APPROVAL_REQUIRED`:
   - `ALLOWED` → 409 (aprovação desnecessária);
   - `DENIED` → 403 `ACTION_DENIED`.
   A solicitação registra `actionPayloadHash`, `policySnapshot`, `authoritySnapshot`,
   o fluxo resolvido e `expiresAt` da 1ª etapa. Idempotente por `Idempotency-Key`.
2. **Decisão** (`approve`/`reject`) — elegibilidade + segregação + quórum (abaixo).
3. **Cancelamento** (`cancel`) — pelo solicitante (ou quem tem `approval.cancel`),
   apenas em `PENDING`.

## Decisão concorrente — segura por trava de linha

`approve`/`reject`/`cancel` executam numa transação que inicia com
`SELECT … FOR UPDATE` sobre a solicitação, serializando votos concorrentes do **mesmo**
pedido. Consequência (§35): dois votos finais simultâneos em um passo de quórum 2 produzem
**uma** transição terminal e **uma** autorização. A revisão só é incrementada em mudança
de estado (avanço de etapa ou transição terminal), de modo que votos não-terminais
concorrentes com a mesma `expectedRevision` coexistem.

## Quórum por etapa

- `ANY_ONE` — 1 aprovação avança a etapa.
- `QUORUM` — `quorum` aprovações distintas avançam.
- `ALL` — igual a `QUORUM` com `quorum` obrigatório.
Uma **rejeição** encerra a solicitação (`REJECTED`) imediatamente. Concluída a última
etapa → `APPROVED` + emissão da autorização.

## Estados

`PENDING → APPROVED | REJECTED | CANCELLED | EXPIRED | INVALIDATED`. Terminais são
imutáveis. Não há endpoint de edição/exclusão de decisão — decisões são append-only
(ver `APPROVAL_AUDIT_EVENTS.md`).
