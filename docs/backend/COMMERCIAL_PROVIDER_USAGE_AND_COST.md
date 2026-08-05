# Usage e custo com provider comercial (ARDEN-BE-008, auditoria)

> O adapter traduz a telemetria do provider para `agentUsage` canônico e o custo passa
> pelas rate cards versionadas — SEM chamada de preço em tempo real, SEM preço inventado
> nesta auditoria. Nenhum tipo do SDK escapa do domínio. NADA de código/SDK nesta fase.

## 1. Usage do provider → `agentUsage`

O adapter mapeia os campos de uso do provider para
`agentUsage = { inputTokens, outputTokens, cachedInputTokens?, cachedOutputTokens?,
toolCallCount, modelCallCount, durationMs, estimatedCostMinor?, currency? }`:

| Campo canônico | Origem |
| --- | --- |
| `inputTokens` / `outputTokens` | contadores de tokens do provider |
| `cachedInputTokens` / `cachedOutputTokens` | tokens servidos/gravados em cache (se houver) |
| `modelCallCount` | contado pelo SERVIDOR (1 por chamada; inclui repairs e continuations) |
| `toolCallCount` | contado pelo SERVIDOR (propostas aceitas/executadas) |
| `durationMs` | medido pelo SERVIDOR em torno da chamada |

> REQUER VERIFICAÇÃO EXTERNA: nomes exatos dos campos de usage do provider e a semântica
> de tokens de cache (input vs output, escrita vs leitura de cache).

`modelCallCount`, `toolCallCount` e `durationMs` são autoridade do servidor — nunca
lidos do provider. Ver `AGENT_MODEL_CALL_USAGE.md` (`purpose`: `PRIMARY` |
`OUTPUT_REPAIR` | `TOOL_CONTINUATION`).

## 2. Campos ausentes, cache, interrupções e erros

Nunca reportar como MEDIDO o que o provider não retornou:

- **campo de usage ausente** → deixar o opcional em branco (`cachedInputTokens?` etc.);
  NÃO preencher com zero como se fosse medição. `inputTokens`/`outputTokens` obrigatórios
  ausentes → tratar como resultado incerto (`MODEL_RESULT_UNKNOWN`), não zero.
- **tokens de cache** → só populados quando o provider os reporta; ausência ≠ 0.
- **requisição interrompida / `MAX_TOKENS`** → registrar o usage parcial retornado; o
  output continua sujeito à validação (output inválido nunca vira sucesso).
- **erro ANTES de qualquer resposta** → sem usage medido; a chamada é registrada com
  `status` de erro e usage nulo/parcial, não fabricado.
- **turnos de tool** → cada chamada de modelo (PRIMARY/TOOL_CONTINUATION) tem seu próprio
  usage; a etapa soma todas.
- **repairs e retries** → cada tentativa é uma chamada de modelo contada
  (`modelCallCount` inclui repairs); retries transientes (rate limit/provider error) que
  falham não inventam usage.

## 3. Custo via rate cards comerciais versionadas

O custo NÃO vem do provider em tempo real. Reusa `AGENT_COST_ESTIMATION.md` /
`AGENT_MODEL_RATE_CARDS.md`: `AgentCostEstimator` faz `ceilDiv` em BigInt (unidade menor)
por componente (input/output/cachedInput/cachedOutput), resolvendo a card `ACTIVE` por
`(providerKey, providerVersion, modelId)`.

- rate card comercial é catálogo SYSTEM-MANAGED, VERSIONADO: `currency` explícita,
  unidade menor por MILHÃO de tokens, `source`, datas efetivas (`status` ACTIVE/RETIRED),
  `catalog_hash` idempotente;
- rate card AUSENTE → `estimatedCostMinor = null` + `COST_RATE_CARD_NOT_AVAILABLE`
  (evento `agent.cost_rate_card_missing`); **nunca** zero inventado;
- **sem chamada de preço em tempo real** ao provider; sem internet neste milestone.

> REQUER VERIFICAÇÃO EXTERNA: os preços comerciais reais (por modelo, por milhão de
> tokens, input/output/cache), a moeda e as datas efetivas. Devem ser conferidos na
> tabela oficial do provider e inseridos no `MODEL_RATE_CARDS` ANTES da implementação —
> NÃO são inventados nesta auditoria.
