# Anthropic — mapeamento request/response (ARDEN-BE-008.1)

> Mapeamento verificado sobre `@anthropic-ai/sdk@0.115.0` (ver
> `ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md`). O adapter usa tipos de transporte INTERNOS
> (`AnthropicTransportRequest/Response`); nenhum tipo do SDK escapa do domínio. Doc de
> auditoria — NADA de código/SDK nesta fase.

## 1. `AnthropicRequestMapper`: `ModelGenerationRequest` → `AnthropicTransportRequest`

Params VERIFICADOS da Messages API: `model, max_tokens, messages, system?, temperature?,
top_p?, top_k?, stop_sequences?, tools?, tool_choice?, metadata?, stream?, thinking?,
service_tier?`. Blocos de conteúdo: `text | tool_use | tool_result | thinking`.

| Alvo (transporte) | Origem canônica |
| --- | --- |
| `model` | `modelId` (allowlist fechada do register; não inventar alias) |
| `system` | `systemInstructions` |
| `messages` | `messages[]` (role/content mapeados; TOOL → bloco `tool_result`) |
| `max_tokens` | `maximumOutputTokens` |
| `temperature` / `top_p` / `stop_sequences` | da configuração de modelo (quando presentes) |
| `tools` | `tools[]` (`ModelToolDefinition`; ver mapeamento de tool calling — compat futura) |
| `tool_choice` / tool de resposta | estratégia de structured output (ver mapeamento próprio) |
| `metadata` | apenas metadados SEGUROS/não sensíveis |

**Nunca** mapear para o payload: `organizationId`, credenciais/segredos, políticas
completas de tool/autoridade, dados de auditoria, `connectionId`, binding ids ou
`correlationId` bruto como identidade externa. `system` NÃO vem de input externo (BE-007).

## 2. `AnthropicResponseMapper`: `AnthropicTransportResponse` → `ModelGenerationResult`

| Alvo canônico | Origem (transporte) |
| --- | --- |
| `text` | bloco de conteúdo `text` concatenado |
| `structuredOutput` | `input` do bloco `tool_use` da tool de resposta |
| `toolCalls[]` | blocos `tool_use` → `ModelToolCall` (`id` normalizado pelo servidor, `alias` do allowlist, `input` revalidado) |
| `finishReason` | `StopReason` → enum canônico (ver §3) |
| `usage` | `Usage` → `agentUsage` (ver `ANTHROPIC_USAGE_MAPPING.md`) |
| `providerRequestId` | id do response — mantido INTERNO, nunca exposto ao frontend; persistido só como hash |

Resposta malformada/ilegível → `finishReason = ERROR` e resultado tratado como
`UNKNOWN`/erro (nunca SUCCEEDED sem output válido).

## 3. `StopReason` → `finishReason`

`StopReason` VERIFICADO: `end_turn | max_tokens | stop_sequence | tool_use | pause_turn |
refusal | model_context_window_exceeded`. Canônico: `STOP | TOOL_CALL | MAX_TOKENS |
CONTENT_FILTER | ERROR`.

| `StopReason` | `finishReason` |
| --- | --- |
| `end_turn`, `stop_sequence` | `STOP` |
| `tool_use` | `TOOL_CALL` |
| `max_tokens`, `model_context_window_exceeded` | `MAX_TOKENS` |
| `refusal` | `CONTENT_FILTER` |
| `pause_turn` | continuação de turno no runtime; não é sucesso final |
| desconhecido | `ERROR` (conservador; nunca `STOP`) |
