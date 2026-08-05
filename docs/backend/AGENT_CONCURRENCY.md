# Concorrência do runtime de agentes (ARDEN-BE-007.2)

## Revisão (compare-and-set)
`AgentDefinition`, `AgentVersion` (DRAFT) e `ModelConfiguration` usam `revision` (desde 1).
O service faz `assertRevision` (pré-checagem) e um `updateMany where { id, organizationId,
revision: expected }` cujo `count === 0` lança `VERSION_CONFLICT` — protege contra corrida
mesmo sob leitura concorrente.

## Idempotência
`runIdempotentCommand` (infra do BE-003, sem nova tabela) envolve create/version.create/
publish/retire/model-config.create e comandos de estado. Escopo = método + rota tenant +
`usuário:chave` + hash do body. Replay devolve a resposta armazenada; body diferente →
`IDEMPOTENCY_CONFLICT`. Mutações + auditoria + registro de idempotência numa única transação.

## Publicação concorrente
Duas publicações simultâneas da mesma versão DRAFT: a transição é guardada por `revision`
**E** `status='DRAFT'`, então apenas uma linha é afetada. A vencedora vira PUBLISHED (uma
única auditoria `agent_version.published`); a perdedora recebe `VERSION_CONFLICT` ou replay
idempotente. Sem estado parcial. Coberto por `agents-critical.integration.spec.ts §32`.
