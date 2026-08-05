# Anthropic — mapeamento de usage (ARDEN-BE-008.1)

> Mapeamento verificado sobre `@anthropic-ai/sdk@0.115.0` (ver
> `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`). O adapter usa tipos de transporte INTERNOS;
> nenhum tipo do SDK escapa do domínio. Custo passa pelas rate cards versionadas — SEM
> preço em tempo real, SEM preço inventado. Doc de auditoria — NADA de código nesta fase.

## 1. `Usage` da Anthropic → `agentUsage`

Campos VERIFICADOS em `Usage`: `input_tokens`, `output_tokens`,
`cache_creation_input_tokens` (escrita de cache), `cache_read_input_tokens` (leitura de
cache), `cache_creation` (breakdown por TTL), `service_tier`, `inference_geo`.

| Campo canônico (`agentUsage`) | Origem (`Usage`) |
| --- | --- |
| `inputTokens` | `input_tokens` |
| `outputTokens` | `output_tokens` |
| `cachedInputTokens` | `cache_read_input_tokens` (LEITURA de cache) |
| `cachedOutputTokens` | — (sem correspondente na Anthropic; não preencher) |
| `modelCallCount` / `toolCallCount` / `durationMs` | contados pelo SERVIDOR, nunca do provider |

## 2. Gap: `cache_creation_input_tokens` (escrita de cache)

`cache_creation_input_tokens` mede tokens GRAVADOS em cache (write) e **não tem campo
canônico** em `agentUsage` (`cachedInputTokens` é semanticamente LEITURA). Regras:

- documentar como GAP conhecido; **não** dobrar em `cachedInputTokens` (misturaria
  leitura com escrita e distorceria custo);
- cobrar à parte via rate card, com a tarifa de cache-write específica quando os rate
  cards forem definidos (ver `AGENT_MODEL_RATE_CARDS.md`);
- `service_tier`/`inference_geo`/`cache_creation` (breakdown) podem ser preservados como
  metadados internos de telemetria, não como campos de usage canônico.

## 3. Campos ausentes ≠ zero medido

- campo de usage ausente → deixar o opcional em branco; **não** preencher com zero como
  se fosse medição;
- `input_tokens`/`output_tokens` obrigatórios ausentes → resultado incerto
  (`MODEL_RESULT_UNKNOWN`), não zero;
- tokens de cache só populados quando a Anthropic os reporta; ausência ≠ 0.

## 4. Somatório entre chamadas

`agentUsage` é acumulado somando o `Usage` de CADA chamada de modelo do passo:

- tentativas de repair (structured output inválido);
- turnos de tool (PRIMARY + TOOL_CONTINUATION);
- retry ANTES de qualquer resposta (usage medido = 0 na tentativa que não respondeu);
- retry APÓS resposta parcial (registrar o usage parcial retornado, nunca fabricar).

`modelCallCount`, `toolCallCount` e `durationMs` são autoridade do servidor. Ver
`AGENT_MODEL_CALL_USAGE.md` (`purpose`: `PRIMARY | OUTPUT_REPAIR | TOOL_CONTINUATION`).
