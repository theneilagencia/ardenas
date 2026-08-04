<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — continuação de tool (ARDEN-BE-008.5)

> Depois de executar uma tool, o `anthropic-request-mapper.ts` sintetiza um histórico canônico:
> uma mensagem `TOOL` do domínio vira um bloco `assistant` `tool_use` (id = `toolCallId`, input
> **mínimo**) + um bloco `user` `tool_result`, preservando o `tool_use_id`. O input cru do
> modelo **não** é re-persistido. Fonte: `anthropic-request-mapper.ts`.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Síntese de histórico (VERIFIED)

Na continuação, uma mensagem canônica `TOOL` é sintetizada em dois blocos:

| Bloco | Papel | Conteúdo |
| --- | --- | --- |
| `assistant` → `tool_use` | proposta reconstruída | `id = toolCallId`, input **mínimo** |
| `user` → `tool_result` | resultado isolado | preserva `tool_use_id` exatamente |

O par reconstrói o turno anterior no formato que a API Anthropic espera, sem depender de guardar
o corpo bruto da resposta do modelo.

## 2. Input mínimo — por que não re-persistir o input cru (VERIFIED)

O bloco `tool_use` sintetizado usa um input **mínimo**, não o input cru originalmente proposto
pelo modelo. Racional:

- o efeito externo já ocorreu via `ExternalToolExecutor`; reenviar o input cru não muda o
  resultado e amplia a superfície de conteúdo não confiável reintroduzido;
- o Arden não re-persiste o input cru do modelo — o histórico canônico guarda o suficiente para
  amarrar o `tool_use_id`, não para reidratar o payload original.

## 3. Sem persistência de histórico completo (VERIFIED)

A continuação **não** persiste o histórico completo de mensagens. O runtime provider-neutro é a
fonte da verdade (checkpoints, usage, evidência); o mapper apenas reconstrói o mínimo canônico
por request.

## 4. Loop de tool e limites (VERIFIED)

O loop é dirigido pelo `AgentRuntimeService`, sujeito a limites do runtime:

| Limite | Efeito |
| --- | --- |
| `maximumTurns` | teto de rodadas de tool |
| `maximumToolCalls` | teto total de tool calls |
| `maximumCallsPerAlias` | teto por alias |

Cenários offline `tool_repeat_forever` e `tool_multiple_calls` exercitam o loop contra esses
limites. O loop segue até o structured output final (ver `ANTHROPIC_TOOL_CALLING_RUNTIME.md`).

## 5. Propósitos de usage (VERIFIED)

Cada chamada ao modelo registra usage por propósito: `PRIMARY`, `TOOL_CONTINUATION`,
`OUTPUT_REPAIR` (herdado do runtime 007.5). A continuação de tool contabiliza como
`TOOL_CONTINUATION`.

## 6. Custo (VERIFIED)

Custo permanece `null` — `COST_RATE_CARD_NOT_AVAILABLE`. Não há rate card verificado nesta
fatia; nenhuma estimativa de preço é inventada.

## 7. NUNCA / PROIBIDO

- re-persistir/reenviar o input cru do modelo na continuação;
- persistir histórico completo de mensagens no mapper;
- ignorar os limites `maximumTurns`/`maximumToolCalls`/`maximumCallsPerAlias`;
- inventar custo enquanto o rate card não é verificado.

## 8. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
