<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — estados UNKNOWN no tool calling (ARDEN-BE-008.5)

> Ambiguidade nunca é sucesso. Um resultado `UNKNOWN` de tool jamais vira `is_error=false`; um
> estado desconhecido do modelo (antes ou depois de uma tool) não é auto-retryado pelo provider.
> O comportamento em resultados desconhecidos é do runtime (`unknownResultBehavior`). Fonte:
> `anthropic-tool-result-mapper.ts`, `anthropic-response-mapper.ts`, runtime 007.5.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Tipos de UNKNOWN (VERIFIED)

| Caso | Cenário offline | Tratamento |
| --- | --- | --- |
| modelo desconhecido **antes** de tool | (resposta inesperada) | não é sucesso; sem auto-retry no provider |
| modelo desconhecido **depois** de tool | `model_unknown_after_tool` | não é sucesso; sem auto-retry no provider |
| resultado de tool `UNKNOWN` | (status do executor) | `is_error=true`, **nunca** sucesso |

## 2. `UNKNOWN` nunca é sucesso (VERIFIED)

No `anthropic-tool-result-mapper.ts`, status `UNKNOWN` mapeia para `is_error=true`. Nunca
`is_error=false`. Um efeito externo cujo desfecho é ambíguo não pode ser reportado ao modelo
como bem-sucedido.

## 3. Sem auto-retry no provider (VERIFIED)

O provider **não** re-tenta automaticamente diante de um estado desconhecido do modelo. A
decisão de re-tentar (ou não) é do runtime provider-neutro, governada por
`unknownResultBehavior` e pelos limites do loop.

## 4. `unknownResultBehavior` (VERIFIED)

O comportamento perante resultado desconhecido é uma política **do runtime**
(`unknownResultBehavior`), não do provider. O provider apenas propaga o status `UNKNOWN` de
forma fiel (nunca "otimizando" para sucesso).

## 5. Alinhamento com governança de resultados externos

Isto é consistente com a regra geral de resultado desconhecido do BE (ambiguidade tratada de
forma conservadora). Ver `EXTERNAL_RESULT_UNKNOWN.md` e `AGENT_TOOL_RESULT_HANDLING.md`.

## 6. NUNCA / PROIBIDO

- marcar `UNKNOWN` como `is_error=false`/sucesso;
- auto-retry no provider diante de estado desconhecido;
- o provider decidir a política de resultado desconhecido (é do runtime);
- inferir sucesso a partir de um desfecho ambíguo.

## 7. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
