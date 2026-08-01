# Escopo da Autorização de Execução — v1 (ARDEN-BE-005 §13)

**Estratégia A escolhida**: a `ActionAuthorization` cobre a **execução completa** para a
`actionKey` declarada. Uma execução declara uma `actionKey` (taxonomia BE-004); o servidor
reavalia a autoridade:

- decisão `ALLOWED` → executa direto (autorização opcional; se fornecida, é consumida);
- decisão `APPROVAL_REQUIRED` → exige `actionAuthorizationId`, revalidado e **consumido**
  (`ACTIVE→USED`) na mesma transação da criação;
- decisão `DENIED` → `ACTION_DENIED`.

A autorização é casada por `actionKey`, `operationId`, `operationVersionId` e
`actionPayloadHash == inputHash` (`hashActionPayload(actionKey, input)`, o mesmo de
BE-004). Uso único: dois requests concorrentes com a mesma autorização → apenas UMA
execução (`AUTHORIZATION_ALREADY_USED` para o outro). Autorização por etapa (Estratégia
C) fica para um marco futuro — não é ampliada silenciosamente.
