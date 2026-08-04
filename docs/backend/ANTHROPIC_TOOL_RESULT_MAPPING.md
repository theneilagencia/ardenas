<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — mapeamento de `tool_result` (ARDEN-BE-008.5)

> `anthropic-tool-result-mapper.ts` converte `AgentToolCallResult` (já isolado pelo runtime) em
> um bloco `tool_result` Anthropic, preservando exatamente o `tool_use_id`. O status governa
> `is_error`; `REQUIRES_APPROVAL` **nunca** é enviado (lança). Fonte:
> `anthropic-tool-result-mapper.ts`.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Status → bloco `tool_result` (VERIFIED)

| Status do runtime | `is_error` | Conteúdo enviado |
| --- | --- | --- |
| `SUCCEEDED` | `false` | conteúdo **sanitizado + redigido** |
| `FAILED` | `true` | mensagem de erro isolada |
| `DENIED` | `true` | mensagem **mínima** (sem detalhe de política) |
| `UNKNOWN` | `true` | **nunca** tratado como sucesso |
| `REQUIRES_APPROVAL` | — | **lança** — nunca vira `tool_result` |

`UNKNOWN` jamais é `is_error=false`: ambiguidade não é sucesso (ver
`ANTHROPIC_TOOL_CALLING_UNKNOWN.md`).

## 2. Preservação do `tool_use_id` (VERIFIED)

O `tool_result` preserva **exatamente** o `tool_use_id` do `tool_use` correspondente. É esse id
que amarra proposta ↔ execução ↔ resultado ↔ continuação.

## 3. Pipeline de isolamento (VERIFIED)

O conteúdo do resultado é tratado como não confiável antes de sair:

1. o runtime já entrega o resultado isolado (`AgentToolResultSanitizer` + `PromptInjectionGuard`,
   007.4);
2. o conteúdo é **clampado em 8000** caracteres;
3. passe final de `SensitiveDataRedactor` no mapper.

Resultado de tool nunca é reinjetado como instrução confiável — é dado isolado.

## 4. `REQUIRES_APPROVAL` nunca é enviado (VERIFIED)

Se o status for `REQUIRES_APPROVAL`, o mapper **lança** em vez de produzir um bloco. Aprovação é
uma pausa do runtime, não um `tool_result` (ver `ANTHROPIC_TOOL_CALLING_APPROVALS.md`). Enviar
um `tool_result` neste estado seria vazar decisão de autoridade para o modelo — PROIBIDO.

## 5. `DENIED` minimal

`DENIED` produz `is_error=true` com mensagem **mínima**: o modelo não recebe o motivo/política
da negação, apenas que a chamada não foi permitida.

## 6. NUNCA / PROIBIDO

- enviar `REQUIRES_APPROVAL` como `tool_result`;
- marcar `UNKNOWN` como sucesso (`is_error=false`);
- alterar o `tool_use_id` preservado;
- enviar conteúdo cru sem sanitização/redação ou acima de 8000 caracteres;
- expor detalhe de política numa negação.

## 7. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
