<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — mapeamento de `tool_use` (ARDEN-BE-008.5)

> `anthropic-response-mapper.ts` normaliza blocos `tool_use` da Anthropic em `ModelToolCall`,
> revertendo o alias via `AnthropicToolNameCodec`. Nome de provider desconhecido é mantido cru
> **de propósito**, para que o `AgentToolCallValidator` do runtime o recuse como
> `AGENT_TOOL_NOT_ALLOWED` — o provider **nunca** decide autoridade. Fonte:
> `anthropic-response-mapper.ts`, `anthropic-tool-name-codec.ts`.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Reverse-alias via codec (VERIFIED)

O codec (`AnthropicToolNameCodec`) mantém um mapa **determinístico, reversível e por request**
(alias ↔ nome de provider). Na resposta, o mapper reverte o alias recebido para o nome de
provider:

| Situação | Comportamento |
| --- | --- |
| alias conhecido no mapa | revertido para o nome de provider correspondente |
| nome desconhecido (fora do mapa) | **mantido cru** — não é inventado nem "corrigido" |

Manter o desconhecido cru é intencional: o runtime é a autoridade e vai rejeitá-lo (§4).

## 2. Propriedades do codec

- padrão de alias: `^[a-zA-Z0-9_-]{1,64}$`;
- colisão-safe (mapa por request);
- nomes reservados re-codificados para `arden_t_<sha256[:24]>`.

## 3. Validação de id e input (VERIFIED)

| Campo | Regra |
| --- | --- |
| `tool_use.id` | preservado; **capado em 120** caracteres |
| input | normalizado; validação de input inválido no fluxo (cenário fake `tool_invalid_input`) |
| `stop_reason = tool_use` | mapeado para `finishReason = TOOL_CALL` |

O `tool_use_id` capado é o mesmo que será preservado no `tool_result` e na continuação (ver
`ANTHROPIC_TOOL_RESULT_MAPPING.md` e `ANTHROPIC_TOOL_CONTINUATION.md`).

## 4. Tool desconhecida → `AGENT_TOOL_NOT_ALLOWED` (VERIFIED)

O provider **não** decide se uma tool é permitida. Um nome de provider que não reverte para um
alias conhecido é entregue cru ao runtime; o `AgentToolCallValidator` o recusa como
`AGENT_TOOL_NOT_ALLOWED`. Cenário offline `tool_invalid_alias` cobre este caminho.

> Provider **nunca** decide autoridade — quem decide é o validator do runtime provider-neutro.

## 5. Múltiplas tool calls por turno

- Preferência **uma tool call por turno** (o loop do runtime dirige turno a turno).
- Cenários offline `tool_multiple_calls` e `tool_repeat_forever` exercitam múltiplas
  chamadas e o comportamento sob limites (`maximumToolCalls`, `maximumCallsPerAlias`,
  `maximumTurns`) aplicados pelo runtime.

## 6. NUNCA / PROIBIDO

- inventar/normalizar um nome de provider desconhecido para "encaixar" num alias;
- decidir no provider se a tool é permitida;
- exceder o cap de 120 no `tool_use.id`;
- tratar `stop_reason = tool_use` como algo diferente de `TOOL_CALL`.

## 7. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
