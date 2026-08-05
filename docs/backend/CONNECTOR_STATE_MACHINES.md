# Máquinas de estado de conectores — ARDEN-BE-006.3

Funções PURAS em `apps/api/src/connectors/connector.state-machines.ts` — nenhuma
mudança de estado por PATCH genérico; toda transição passa por aqui, guardada por
`revision` no banco.

## Connection
`DRAFT → ACTIVE | REVOKED` · `ACTIVE → SUSPENDED | ERROR | REVOKED` ·
`SUSPENDED → ACTIVE | REVOKED` · `ERROR → ACTIVE | SUSPENDED | REVOKED`.
**`REVOKED` é terminal** — reativação é bloqueada (`CONNECTION_REVOKED`).

## Credential
`PENDING → ACTIVE | REVOKED` · `ACTIVE → SUPERSEDED | REVOKED` ·
`SUPERSEDED → REVOKED`. Nenhum estado volta a `ACTIVE`. `REVOKED` terminal. Ativar
supersede a ACTIVE anterior e aponta `currentCredentialVersionId`; a unicidade de
"uma única ACTIVE por conexão" é garantida por índice parcial único (concorrência-safe).

## WebhookEndpoint
`ACTIVE ↔ SUSPENDED` · `→ REVOKED` (terminal). Endpoint `REVOKED` não reativa
(`WEBHOOK_ENDPOINT_REVOKED`).

## WebhookDelivery (append-oriented)
`RECEIVED → ACCEPTED | REJECTED | REPLAYED` · `ACCEPTED → PROCESSED | FAILED`.
Estados finais não mudam. Transições só por service (nunca update genérico).

Transições inválidas → `INVALID_STATE_TRANSITION`. Cobertas por
`connector.state-machines.spec.ts` (unit) e pelos testes de integração.
