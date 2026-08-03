# Anthropic — retry e resultado UNKNOWN (ARDEN-BE-008.1)

> Verificado sobre `@anthropic-ai/sdk@0.115.0` (defaults do cliente em
> `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`). O retry é do motor do BE-005; o adapter usa
> tipos de transporte INTERNOS. Doc de auditoria — NADA de código/SDK nesta fase.

## 1. Defaults do SDK (VERIFICADO) e recomendação

Do `.d.ts` do cliente: `baseURL = https://api.anthropic.com`, timeout default **10 min**,
`maxRetries` default **2**, e **timeouts são retriados por default**.

Recomendação: **desabilitar/limitar o auto-retry do SDK** (`maxRetries = 0` ou controle
explícito) e centralizar o retry no adapter/motor do Arden. Motivo: o auto-retry do SDK
não conhece idempotência de efeitos (orquestração de tools) nem o deadline/lease do job,
e retriar timeout às cegas viola a invariante de resultado incerto.

## 2. Política de retry (Arden)

- retriar SÓ falhas classificadas como retryáveis (ver `ANTHROPIC_ERROR_MAPPING.md`):
  `MODEL_RATE_LIMITED`, `MODEL_PROVIDER_ERROR` transiente/rede/5xx;
- **backoff exponencial + jitter**; honrar `Retry-After` no 429;
- teto de tentativas (`maxAttempts`) + **deadline global** do passo;
- `AbortSignal` ligado ao timeout do `AgentExecutionPolicy`; sem espera ativa (`sleep`);
- **sem retry após cancelamento** (`APIUserAbortError` = abort, não retry);
- **nunca** retriar resultado incerto às cegas (efeito não-idempotente possível);
- usage/custo de CADA tentativa é registrado (ver `ANTHROPIC_USAGE_MAPPING.md`).

## 3. Classificação UNKNOWN → `MODEL_RESULT_UNKNOWN`

Vira `MODEL_RESULT_UNKNOWN` (nunca SUCCEEDED, nunca retry cego):

- request pode ter sido recebido, sem resposta confirmada;
- conexão caiu ANTES de uma resposta conclusiva;
- resposta parcial/ilegível após envio;
- timeout depois do envio (efeito possível);
- existe `providerRequestId` mas o resultado é desconhecido.

Ao classificar UNKNOWN: persistir o usage já conhecido (nunca fabricar), preservar
evidência, e deixar a GOVERNANÇA decidir (`unknownResultBehavior`: FAIL/SUSPEND — ver
`AGENT_RUNTIME_ERROR_MODEL.md`). O recorder nunca marca UNKNOWN como PASSED (BE-007.6).

## 4. Deadline efetivo

O timeout efetivo de cada chamada = **mínimo** de: timeout do passo, política do agente
(`AgentExecutionPolicy`), timeout de request do provider (default SDK 10 min) e o deadline
seguro do lease do job. Nenhuma tentativa pode ultrapassar o lease do job.
