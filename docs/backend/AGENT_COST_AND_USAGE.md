# Custo e consumo do agente (ARDEN-BE-007, auditoria)

> Billing completo fica para outro milestone, mas o BE-007 DEVE registrar consumo por
> execução desde o início.

## 1. Registro mínimo por chamada de modelo (§25)

`AgentModelCall` (append-only, tenant-scoped, por `ExecutionRun`/step):
`provider`, `model`, `inputTokens`, `outputTokens`, `cachedTokens?`, `toolCalls`,
`durationMs`, `estimatedCost`, `providerRequestId` (externo), `retryCount`. Sem prompt
bruto, sem segredo.

`estimatedCost` = função determinística de tokens × tabela de preço da `ModelConfiguration`
(configurável). Não bloquear a implementação aguardando billing completo.

## 2. Enforcement de limites

O `AgentExecutionPolicy.maximumCost`/`maximumTurns`/tokens é verificado a cada turno; ao
exceder → `AGENT_LIMIT_EXCEEDED` (falha segura, sem retry que ignore o teto). O consumo
acumulado da execução é somado a partir dos `AgentModelCall`.

## 3. Classificação de dados (evidência/auditoria)

| Categoria | Exemplos | Tratamento |
| --- | --- | --- |
| Dados seguros | versões, model key, tokens, custo, durações, hashes | persistidos em claro |
| Dados sensíveis | prompt completo, system instructions, contexto bruto, segredo | **não** persistidos por padrão; apenas hash/summary |
| Hashes | promptHash, inputHash, outputHash, responseHash | persistidos |
| Versões | agentVersionId, modelConfigurationId | persistidos |
| Summaries | resumo de output/decisão | opcional, sanitizado |
| Retained payloads | somente sob política explícita | opt-in, sob os limites do BE-005 |

Reusa `EvidenceRecord`/`audit_events`. Prompts completos NÃO são registrados
indiscriminadamente.
