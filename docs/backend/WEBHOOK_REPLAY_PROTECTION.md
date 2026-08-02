# Webhook de entrada — proteção de replay (ARDEN-BE-006.7)

## Chaves

Prioridade: (1) `externalDeliveryId` quando presente; (2) `payloadHash` + endpoint +
janela; (3) timestamp (janela).

- **Com `externalDeliveryId`**: a constraint única `(webhook_endpoint_id,
  external_delivery_id)` serializa requests concorrentes — um insere `RECEIVED`, o
  outro colide (P2002) e recai em replay. Mesmo id + mesmo `payloadHash` ⇒ `REPLAYED`
  (idempotente). Mesmo id + `payloadHash` diferente ⇒ `WEBHOOK_DELIVERY_CONFLICT` (409),
  sem nova execução.
- **Sem `externalDeliveryId`**: dedup por `payloadHash` entre deliveries `ACCEPTED/
  PROCESSED` dentro da janela de replay.

## Payload hash

`SHA-256(rawBody)` (bytes brutos, não JSON parseado). Persistido; usado para dedup;
não substitui autenticação.

## Idempotência da execução

A execução usa `triggerReference = webhookDeliveryId`. `createFromSystemTrigger`
verifica se já existe run para o gatilho e reutiliza — nunca duplica execução nem job.
Combinado com a serialização da delivery, dois requests idênticos simultâneos produzem
**uma** delivery efetiva, **uma** execução, **um** job.

## Estados da delivery

`RECEIVED → ACCEPTED → PROCESSED`; `RECEIVED → REJECTED`; `RECEIVED → REPLAYED`;
`ACCEPTED → FAILED`. Transições via state machine; sem update genérico; sem exclusão
física.
