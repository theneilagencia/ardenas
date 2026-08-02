# Concorrência de conectores — ARDEN-BE-006.3

## Concorrência otimista (revision)
`OrganizationConnection`, `OrganizationToolBinding`, `OperationToolBinding` e
`WebhookEndpoint` usam `revision`. Toda atualização é **compare-and-set**:
`updateMany WHERE id = ? AND organization_id = ? AND revision = expected`, com
`revision := revision + 1`. Se `count = 0` → `VERSION_CONFLICT`. Nunca há
buscar-comparar-atualizar sem proteção transacional.

Comprovado: dois updates `revision=1` simultâneos → um vence (revision→2), o outro
`VERSION_CONFLICT` (`connectors-critical.integration.spec.ts`).

## Credencial ativa única
Índice parcial único `(connection_id) WHERE status='ACTIVE'`. Duas ativações
concorrentes → apenas uma fica `ACTIVE`; a outra recebe violação de unicidade,
traduzida em `CREDENTIAL_ROTATION_CONFLICT`. Comprovado por teste concorrente.

## Deduplicação de webhook delivery
Índice parcial único `(webhook_endpoint_id, external_delivery_id)`; a segunda entrega
com o mesmo id retorna a existente (deduplicada), sem criar efeito duplicado.

## Idempotência
Comandos de criação usam `runIdempotentCommand` (mesma chave + body → replay; body
diferente → `IDEMPOTENCY_CONFLICT`). Sem segunda infra de idempotência.
