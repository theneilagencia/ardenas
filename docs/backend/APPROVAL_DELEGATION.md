# Delegação de Aprovação (ARDEN-BE-004)

Um aprovador delega **temporariamente** sua elegibilidade a outro usuário, dentro de uma
janela `validFrom`/`validUntil`. A delegação **não cria autoridade nova**: o delegado só
pode o que o delegante poderia.

## Modelo

`ApprovalDelegation` — `delegatorUserId`, `delegateUserId`, janela, `scope` (JSON),
status `ACTIVE|REVOKED|EXPIRED`. Índice `(organizationId, delegateUserId, status)` para
resolver rapidamente "por quem este usuário pode agir agora".

## Regras na criação (`POST /approval-delegations`, permissão `approval.delegate`)

- **Sem auto-delegação**: `delegateUserId === delegator` → 422 (`self_delegation`).
- **Janela válida**: `validUntil > validFrom`.
- **Sem ciclos**: BFS sobre o grafo de delegações ativas — se `delegate` já alcança
  `delegator`, a nova aresta fecharia um ciclo → 409 (`Delegação criaria um ciclo`).
- **Delegado membro ativo** da organização.

O delegante é sempre o usuário autenticado (`ctx.userId`) — o cliente não escolhe o
delegante.

## Uso na decisão

Ao decidir, o serviço coleta as delegações **ativas e vigentes** em que o ator é
`delegateUserId` e usa os delegantes como identidades adicionais na checagem de
elegibilidade. A segregação de funções continua valendo: se `requesterCannotApprove` e o
**ator** é o solicitante, a decisão é bloqueada mesmo que ele detenha delegações.

## Revogação

`POST /approval-delegations/{id}/revoke` (idempotente) marca `REVOKED` + `revokedAt`.
Apenas delegação `ACTIVE` é revogável. Delegações expiram por janela (checagem na leitura).
