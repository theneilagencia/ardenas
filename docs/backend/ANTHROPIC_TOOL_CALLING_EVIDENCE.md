<!-- Milestone: ARDEN-BE-008.5 — Anthropic tool calling (validado OFFLINE apenas) -->
# Anthropic — evidência e auditoria de tool calling (ARDEN-BE-008.5)

> A evidência registra **metadados e hashes** do fluxo de tool na borda Anthropic — nunca
> conteúdo cru nem segredo. Os eventos genéricos `agent.*` seguem sendo a trilha primária do
> runtime; os nomes `anthropic.*` documentam a evidência de borda do provider. **Sem nova
> migração** (evidência/audit reusados). Fonte: mappers da Fatia 2 + runtime 007.5.

Status desta fatia:
- Tool calling implementation: **OFFLINE VERIFIED**
- Live Anthropic tool calling: **NOT EXECUTED**
- Production: **BLOCKED**

## 1. O que é registrado (VERIFIED)

| Campo | Forma |
| --- | --- |
| provider | identidade (`anthropic.direct@1`) |
| model | modelId |
| request/response | **hash** (não o corpo) |
| turno | `agentTurn` |
| tool use id | **hash** do `tool_use_id` |
| alias | alias da tool (não nome de provider) |
| input | **hash** do input normalizado |
| decisão de autoridade | ALLOW / REQUIRE_APPROVAL / DENY |
| aprovação | estado de aprovação |
| autorização | `ActionAuthorization` (single-use) |
| status da tool | SUCCEEDED / FAILED / DENIED / UNKNOWN |
| output | **hash** |
| status da continuação | started / succeeded / failed / unknown |
| usage | por propósito (`PRIMARY`/`TOOL_CONTINUATION`/`OUTPUT_REPAIR`) |
| sinais de segurança | prompt-injection, rejeição de descrição, canary |

## 2. O que NUNCA é registrado (PROIBIDO)

- conteúdo cru de request/response/descrição/resultado;
- segredo/credencial/apiKey;
- input cru do modelo (a continuação usa input mínimo — ver `ANTHROPIC_TOOL_CONTINUATION.md`);
- o canary de segredo em claro.

Sempre **hash sha256** para conteúdo; a descrição rejeitada guarda hash de evidência
(`AGENT_TOOL_DESCRIPTION_REJECTED`).

## 3. Nomes de eventos `anthropic.*` (evidência de borda)

Documentam a fronteira do provider:

- `anthropic.tools_mapped`
- `anthropic.tool_use_received`
- `anthropic.tool_use_normalized`
- `anthropic.tool_use_rejected`
- `anthropic.tool_result_prepared`
- `anthropic.tool_result_sent`
- `anthropic.tool_continuation_started` / `_succeeded` / `_failed` / `_unknown`

## 4. Trilha primária `agent.*` (VERIFIED)

Os eventos genéricos do runtime permanecem a trilha primária, por exemplo:

- `agent.tool_requested`
- `agent.tool_execution_succeeded`
- `agent.execution_completed`

Os `anthropic.*` complementam com evidência de borda; **não** substituem a trilha
provider-neutra.

## 5. Reuso, sem migração (VERIFIED)

Evidência, usage, checkpoint e audit são **reusados** do runtime — nenhuma tabela nova nesta
fatia. Nenhum endpoint novo; OpenAPI diff-free.

## 6. NUNCA / PROIBIDO

- gravar conteúdo cru ou segredo;
- gravar o canary em claro;
- tratar os `anthropic.*` como trilha primária;
- criar migração/endpoint novo para evidência nesta fatia.

## 7. Estado

Tool calling implementation: **OFFLINE VERIFIED**. Live Anthropic tool calling: **NOT
EXECUTED**. Production: **BLOCKED**.
