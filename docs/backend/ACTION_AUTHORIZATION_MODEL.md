# Modelo de Autorização de Ação (ARDEN-BE-004)

A **ActionAuthorization** é o artefato terminal de BE-004: a prova persistida de que uma
ação específica está autorizada. **Não executa** a ação (execução é BE-005).

## Campos

| Campo                | Papel                                                            |
| -------------------- | --------------------------------------------------------------- |
| `approvalRequestId`  | solicitação que a originou (nulo para autorização direta futura)|
| `operationId` / `operationVersionId` | operação + versão de autoridade do momento        |
| `actionKey`          | ação da taxonomia                                               |
| `actionPayloadHash`  | hash canônico do payload autorizado                            |
| `grantedToUserId`    | a quem foi concedida (o solicitante)                           |
| `status`             | `ACTIVE|USED|EXPIRED|REVOKED|INVALIDATED`                        |
| `validFrom`/`validUntil` | janela de validade                                          |
| `authoritySnapshot` / `policySnapshot` | estado de governança no momento da emissão    |

## Emissão

Emitida **uma única vez** na transição terminal `PENDING → APPROVED`, dentro da mesma
transação e sob a trava de linha da solicitação. Isso garante — mesmo com votos finais
concorrentes — **uma** autorização por solicitação aprovada (§35).

## Validação (`POST /action-authorizations/validate`)

Confere, sem executar:

- **Casamento de payload**: `operationId`/`actionKey`/`actionPayloadHash` — divergência →
  `AUTHORIZATION_PAYLOAD_MISMATCH`.
- **Invalidação preguiçosa**: se a versão publicada da operação mudou, a autorização presa
  à versão anterior é marcada `INVALIDATED` e a validação retorna inválida
  (`AUTHORIZATION_INVALIDATED`).
- **Expiração preguiçosa**: `validUntil` vencido → `EXPIRED` (`AUTHORIZATION_EXPIRED`).
- **Status**: só `ACTIVE` é válida.

## Imutabilidade e auditoria

Transições de status são append-only na trilha (`action_authorization.granted`,
`.invalidated`, `.expired`). A autorização nunca é editável por um endpoint público nem
apagada.
