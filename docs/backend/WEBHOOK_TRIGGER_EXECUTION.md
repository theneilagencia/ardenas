# Webhook de entrada — gatilho de execução (ARDEN-BE-006.7)

## Reutilização do motor BE-005

`ExecutionsService.createFromSystemTrigger` reutiliza repos/fila/recorder do BE-005 —
**não** cria engine, fila nem idempotência nova. Cria a execução com:

- `triggerType = SYSTEM`, `triggerReference = webhookDeliveryId`;
- `requestedByUserId` = usuário que **configurou** o endpoint (accountable);
- `input` = payload validado (metadata segura); actorType dos eventos = `SYSTEM`.

## Resolução da operação

Do endpoint persistido: `operationId` (obrigatório para gerar execução) e
`operationVersionId` (quando fixado). Valida: organização, operação ativa, versão
pertence à operação e **está publicada**, mesmo tenant. Sem versão fixada ⇒ usa a
publicada corrente (nunca draft), registrando o id exato.

## Autoridade

O `actionKey` do gatilho é a ação primária autorizada da versão publicada
(`authorityProfile.allowedActions[0]`). A avaliação do BE-004 roda normalmente; só
executa quando `ALLOWED`. `APPROVAL_REQUIRED`/`DENIED` ⇒ `WEBHOOK_TRIGGER_DENIED`
(delivery aceita, evento auditado, sem execução). Nunca fabrica autorização nem usa
usuário administrativo como fallback.

## O que o webhook NÃO envia

`organizationId`, `operationId`, `operationVersionId`, `ActionAuthorization`, `status`,
`userId`, permissões — tudo vem da configuração persistida.
