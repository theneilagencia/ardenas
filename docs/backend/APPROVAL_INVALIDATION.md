# Invalidação por Mudança Material (ARDEN-BE-004 §36)

Uma autorização/solicitação é válida contra a **autoridade que a originou**. Quando essa
autoridade muda materialmente, a autorização não pode continuar valendo.

## Gatilho: publicação de nova versão de operação

No fluxo de publicação (`OperationVersionsService.publish`, dentro da transação):

```
UPDATE approval_requests    SET status='INVALIDATED'  -- PENDING presas à versão anterior
UPDATE action_authorizations SET status='INVALIDATED'  -- ACTIVE presas à versão anterior
  WHERE organizationId = … AND operationId = … AND operationVersionId <> <nova versão>
```

Um evento de auditoria `authority.invalidated_by_publish` registra as contagens. O
**histórico é preservado**: nada é apagado; apenas o status transiciona para
`INVALIDATED`. Solicitações e decisões passadas continuam legíveis.

## Invalidação preguiçosa (defesa em profundidade)

Mesmo que uma autorização escape do gatilho, a **validação** a detecta: se
`operationVersionId` da autorização difere da versão publicada corrente, ela é marcada
`INVALIDATED` na leitura e a validação retorna inválida.

## Efeito nas decisões

- Aprovar/rejeitar uma solicitação `INVALIDATED` → 409 `APPROVAL_INVALIDATED`.
- Validar uma autorização `INVALIDATED` → `valid=false`, `AUTHORIZATION_INVALIDATED`.

Assim, **uma autorização nunca continua válida após uma mudança material** na operação.
