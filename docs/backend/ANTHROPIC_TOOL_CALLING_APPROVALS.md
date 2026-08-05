<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — aprovações no tool calling (ARDEN-BE-008.5)

> Quando a autoridade avalia `REQUIRE_APPROVAL`, o runtime **pausa** o loop, grava um checkpoint
> (só conteúdo sanitizado), retoma após decisão, emite uma `ActionAuthorization` single-use,
> executa **uma única vez** via `ExternalToolExecutor` e só então o resultado vira `tool_result`
> + continuação. O provider Anthropic **não participa** de nada disso. Fonte: runtime 007.5.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. Fluxo de aprovação (VERIFIED)

```
AgentToolAuthorityEvaluator → REQUIRE_APPROVAL
  → runtime PAUSA o loop
  → checkpoint em agent_runtime_checkpoints (apenas conteúdo sanitizado)
  → [decisão externa de aprovação]
  → runtime RESUME
  → ActionAuthorization (single-use)
  → ExternalToolExecutor executa UMA vez
  → AgentToolResultSanitizer + PromptInjectionGuard
  → anthropic-tool-result-mapper → tool_result
  → continuação (assistant tool_use + user tool_result) → novo generate
```

## 2. Papel do provider (VERIFIED)

O provider Anthropic **nunca**:

- cria aprovação;
- emite `ActionAuthorization`;
- executa a tool;
- decide autoridade.

Além disso, `REQUIRES_APPROVAL` **nunca** é enviado como `tool_result` — o mapper lança nesse
estado (ver `ANTHROPIC_TOOL_RESULT_MAPPING.md`). O modelo não é informado de que há uma pausa de
aprovação em curso.

## 3. Checkpoint só com sanitizado (VERIFIED)

O checkpoint em `agent_runtime_checkpoints` guarda **apenas conteúdo sanitizado** — sem input
cru, sem segredo. A retomada reidrata o loop a partir desse estado isolado. **Sem nova
migração** nesta fatia: checkpoint/usage/evidência/audit são reusados.

## 4. Autorização single-use (VERIFIED)

Após a aprovação, a `ActionAuthorization` é **single-use**: autoriza exatamente uma execução.
Combinada com a idempotência do runtime (ver `ANTHROPIC_TOOL_CALLING_IDEMPOTENCY.md`), garante
**um único efeito externo** mesmo com resume/replay.

## 5. Execução única (VERIFIED)

`ExternalToolExecutor` (BE-006) é o **único** caminho de execução e roda **uma vez** por
autorização. Não há execução paralela nem caminho alternativo no provider.

## 6. NUNCA / PROIBIDO

- provider criar aprovação, emitir autorização ou executar tool;
- enviar `REQUIRES_APPROVAL` como `tool_result`;
- gravar input cru/segredo no checkpoint;
- reutilizar uma `ActionAuthorization` single-use;
- expor ao modelo o motivo/estado da aprovação.

## 7. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
