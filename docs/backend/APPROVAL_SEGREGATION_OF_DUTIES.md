# Segregação de Funções e Elegibilidade (ARDEN-BE-004)

## Segregação de funções

Quando `step.requesterCannotApprove` é `true` (default), o **solicitante não pode aprovar
a própria ação**: se `ctx.userId === request.requestedBy`, `approve`/`reject` retorna 403
`SELF_APPROVAL_FORBIDDEN`. Essa checagem ocorre no servidor, antes de qualquer decisão —
o papel de tela ou um botão renderizado não a contornam.

## Elegibilidade

Uma etapa pode restringir quem decide por três eixos, avaliados em conjunto (todos os
definidos precisam ser satisfeitos por **uma** identidade):

1. `specificApproverUserId` — a identidade precisa ser esse usuário;
2. `eligibleRoleKey` — a identidade precisa ter esse papel na organização;
3. `requiredPermission` — a identidade precisa ter essa permissão efetiva.

Se nenhum eixo é definido, qualquer aprovador com `approval.resolve` (exigida no endpoint)
é elegível.

### Identidades efetivas (delegação)

A verificação considera o **ator** e os **delegantes** que ele representa por delegação
ativa (ver `APPROVAL_DELEGATION.md`). Papel/aprovador-específico podem ser satisfeitos por
um delegante; a permissão do ator usa `ctx.permissions`, e a de um delegante representado
usa suas permissões efetivas (`AuthorizationService.getEffectivePermissions`). A delegação
**expande** elegibilidade — nunca concede autoridade que ninguém possui.

Ator inelegível → 403 `APPROVAL_NOT_ELIGIBLE`.

## Decisão imutável e única

`@@unique(approvalRequestId, approvalFlowStepId, decidedBy)` garante **uma** decisão por
aprovador por etapa. Uma segunda tentativa do mesmo aprovador retorna 409
`APPROVAL_ALREADY_DECIDED`. Decisões nunca são editadas nem apagadas.
