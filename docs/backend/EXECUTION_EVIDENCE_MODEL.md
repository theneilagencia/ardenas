# Modelo de Evidências (ARDEN-BE-005 §26)

`EvidenceRecord` é **append-only**. Tipos: `INPUT`, `OUTPUT`, `DECISION`,
`AUTHORIZATION`, `ERROR`, `STATE_TRANSITION`, `COMPENSATION`. Cada evidência tem tenant,
execução, etapa (quando aplicável), `contentHash` (SHA-256 do conteúdo canônico
sanitizado), `correlationId`, origem (`USER|SYSTEM|WORKER`) e timestamp.

Sanitização (`sanitizeContent`): chaves sensíveis (`authorization|token|secret|password|
cookie|bearer`) são redigidas em profundidade antes de persistir. Nunca grava segredo
bruto nem o header `Authorization`. Não há endpoint público para editar/apagar evidência.
