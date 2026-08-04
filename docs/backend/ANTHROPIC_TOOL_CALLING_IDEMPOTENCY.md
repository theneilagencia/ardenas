<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — idempotência no tool calling (ARDEN-BE-008.5)

> A idempotência é do runtime provider-neutro (007.5): uma chave composta identifica cada
> execução de tool; um replay reusa o resultado sanitizado já persistido, sem novo efeito
> externo e sem duplicar contadores/rollups. O provider Anthropic **reusa** isso sem alteração.
> Fonte: runtime 007.5.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Derivação da chave (VERIFIED)

A chave de idempotência combina:

| Componente | Papel |
| --- | --- |
| `executionRunId` | identifica a execução |
| `executionStepId` | identifica o passo |
| `agentTurn` | identifica o turno do agente |
| `toolCallId` | identifica a tool call |
| `alias` | identifica a tool (alias, não nome de provider) |
| `normalizedInputHash` | identifica o input normalizado |

A combinação é o que amarra proposta ↔ execução ↔ resultado de forma reproduzível.

## 2. Replay reusa resultado persistido (VERIFIED)

Em um replay (resume após aprovação, retry de infra, reentrada), a mesma chave resolve o
**resultado sanitizado já persistido** — o runtime não executa a tool de novo.

## 3. Sem efeito externo duplicado (VERIFIED)

Como `ExternalToolExecutor` é o único caminho de execução e a `ActionAuthorization` é
single-use (ver `ANTHROPIC_TOOL_CALLING_APPROVALS.md`), a idempotência garante **um único
efeito externo** por chave.

## 4. Contadores e rollups não duplicados (VERIFIED)

Um replay **não** duplica contadores nem rollups de usage: a contabilização é atrelada à chave,
não à re-tentativa. Usage por chamada de modelo segue os propósitos `PRIMARY`,
`TOOL_CONTINUATION`, `OUTPUT_REPAIR`.

## 5. Papel do provider (VERIFIED)

O provider Anthropic não implementa idempotência própria — ele apenas produz o `ModelToolCall`
(com `toolCallId`/alias) e consome o `AgentToolCallResult`. A chave e a reuse são inteiramente do
runtime provider-neutro. **Sem nova migração** nesta fatia (usage/checkpoint/evidência
reusados).

## 6. NUNCA / PROIBIDO

- executar a tool novamente para uma chave já resolvida;
- produzir efeito externo duplicado em replay/resume;
- duplicar contadores/rollups de usage num replay;
- o provider inventar seu próprio esquema de idempotência.

## 7. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
