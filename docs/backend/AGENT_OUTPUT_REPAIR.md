# Repair de saída (ARDEN-BE-007.3 §17)

Correção determinística e limitada. Só quando `retryInvalidOutput=true`; no máximo
`maximumOutputRepairAttempts` (teto global do contrato ≤ 5). Cada tentativa: nova chamada ao
MESMO provider, com uma mensagem de correção acrescentada (`[arden:repair]` + erros de
validação); registra `agent.output_repair_started`; soma usage (`modelCallCount` inclui
repairs). Ao esgotar → `AGENT_OUTPUT_REPAIR_EXHAUSTED` (evento
`agent.output_repair_exhausted`); sem repair habilitado → `AGENT_OUTPUT_INVALID`. Falhas
nunca são ocultadas. Cenário coberto: 1ª inválida + 2ª válida → SUCCEEDED, `modelCallCount=2`,
`repairAttemptCount=1`; todas inválidas → exhausted.
