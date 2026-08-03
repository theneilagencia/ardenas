# ARDEN-BE-007.5 — Tool calling funcional, autoridade, aprovações e retomada

Primeiro tool calling FUNCIONAL do agente sobre a infraestrutura segura do `ARDEN-BE-006`
(execução externa) e do `ARDEN-BE-004` (autoridade, aprovação, `ActionAuthorization`). O
modelo apenas PROPÕE a chamada; o SERVIDOR decide e executa. Sem provider comercial, SDK,
internet, tool dinâmica, execução paralela ou endpoint direto.

## Fluxo canônico

```
InternalTestModelProvider (propõe ModelToolCall)
  → AgentToolCallValidator      (schema/tamanho/limites/props de controle; não confia no provider)
  → AgentToolBindingResolver    (alias→binding→conexão→tool ATIVA; risco persistido; BE-006)
  → AgentToolAuthorityEvaluator (risco da policy + Gradiente/policies via integration.invoke + ActionAuthorization)
  → [REQUIRE_APPROVAL] ApprovalRequestsService.create → SUSPENDE a etapa/execução (PAUSED)
       … aprovação humana (endpoint existente) emite ActionAuthorization single-use …
       … retomada (endpoint /executions/{id}/resume) → worker reprocessa …
  → [ALLOW] consome ActionAuthorization (atômico) → ExternalToolExecutor (BE-006)
  → AgentToolExecutor: sanitiza + redige + inspeciona injeção + ISOLA como mensagem TOOL
  → reinsere resultado no contexto → nova chamada ao modelo
  → structured output final → avaliação → evidência + auditoria
```

## Componentes novos (`apps/api/src/agents/runtime/tools/`)

| Arquivo | Papel |
| --- | --- |
| `agent-tool.types.ts` | Tipos internos (definição resolvida, decisão de autoridade, resultado de tool call). |
| `agent-tool-call-validator.ts` | PURO. Valida id/alias/allowlist/schema/tamanho/limites; rejeita props de controle (tenant, connectionId, credential, endpoint, URL absoluta, authorization…) e tipos não serializáveis. |
| `agent-tool-binding-resolver.ts` | Camada de agente sobre o `ToolBindingResolver` do BE-006; interseção completa; risco da `ConnectorToolDefinition`. |
| `agent-tool-authority-evaluator.ts` | ALLOW/REQUIRE_APPROVAL/DENY combinando `AgentToolPolicy` + `evaluateCore('integration.invoke')` (BE-004) + `ActionAuthorization` ativa. |
| `agent-tool-approval.service.ts` | Cria/reutiliza a solicitação de aprovação via `ApprovalRequestsService` (motor BE-004 inalterado). |
| `agent-tool-executor.ts` | Consome autorização single-use, executa via `ExternalToolExecutor`, sanitiza/isola o resultado, grava evidência. |
| `agent-runtime-checkpoint.repository.ts` | Persistência mínima do loop (retomada idempotente + execução única por replay). |

## Reuso (sem duplicação)

- **Execução externa**: `ExternalToolExecutor` (BE-006) — alias→binding→conexão→credencial→
  SSRF-safe HTTP→classificação/UNKNOWN. O agente nunca chama `SecureHttpClient`,
  `CredentialResolver`, connector repo ou Prisma de execução diretamente.
- **Autoridade**: `enforcement.evaluateCore` sobre a action canônica `integration.invoke`
  (BE-004) — Gradiente de Autoridade + políticas da operação.
- **Autorização**: `ActionAuthorization` (BE-004) emitida na aprovação e consumida
  ATÔMICA e single-use (`EnforcementService.consumeAuthorization`, `ACTIVE→USED`).
- **Aprovação**: `ApprovalRequestsService.create/approve` (BE-004) — fluxo, quórum,
  segregação de funções, delegação, imutabilidade da decisão, concorrência (FOR UPDATE).
- **Suspensão/retomada**: pausa cooperativa do BE-005 (`ExecutionStepStatus.PAUSED` +
  run `PAUSED`) e retomada pelo endpoint `/executions/{id}/resume` (re-enfileira o job).

## Provider determinístico (cenários de tool)

`internal.test-model@1` ganhou cenários (modelId da allowlist, proibido em produção):
`tool-read-success`, `tool-write-authorized`, `tool-requires-approval`, `tool-denied`,
`tool-invalid-alias`, `tool-invalid-input`, `tool-limit`, `tool-unknown-result`,
`tool-result-injection`, `tool-then-final-output`. O provider apenas propõe a alias
oferecida e finaliza após o primeiro resultado — nunca decide/executa.

Tools de teste determinísticas adicionadas ao catálogo `internal.test` (sem internet):
`test.write` (WRITE), `test.unknown` (resultado UNKNOWN), `test.inject` (resultado com
injeção + cabeçalho sensível, para o teste de isolamento).

## Retomada e execução única

O checkpoint (`agent_runtime_checkpoints`, uma linha por etapa) guarda contadores, hashes e
metadados sanitizados — **nunca** prompt/contexto/segredo/credencial/input/output bruto. Na
retomada o loop determinístico é refeito: tool calls já concluídas são replayadas do
checkpoint (sem reexecutar); a tool aprovada encontra a `ActionAuthorization` ATIVA, a
consome (single-use) e executa **uma única vez**. Chave de idempotência estável:
`executionStepId:toolCallId:payloadHash`. A concorrência é contida pelo lease do job
(FOR UPDATE SKIP LOCKED) + consumo single-use da autorização.

## Risco e limites

Risco persistido na `ConnectorToolDefinition` (READ/WRITE/DESTRUCTIVE/FINANCIAL/
SECURITY_CRITICAL) — o agente NUNCA reduz o risco. `AgentToolPolicy` nega categorias
(defaults: DESTRUCTIVE/FINANCIAL/SECURITY_CRITICAL negados; WRITE controlado). Limites do
loop: `maximumTurns`, `maximumToolCalls`, `maximumCallsPerAlias`, orçamento de contexto/
tokens — a chamada excedente NÃO executa (`AGENT_TOOL_CALL_LIMIT_EXCEEDED`/
`AGENT_TURN_LIMIT_EXCEEDED`).

## Isolamento de resultado

O resultado externo é redigido (campos sensíveis removidos), classificado
`UNTRUSTED_EXTERNAL`, inspecionado pelo `PromptInjectionGuard` (007.4) e ISOLADO como
mensagem `TOOL` entre delimitadores `<untrusted_tool_result>`. Nunca entra como
system message; instruções no resultado não são promovidas; segredos não chegam ao modelo.

## Evidência e auditoria (sanitizadas)

Eventos `agent.tool_*` (definitions_resolved, requested, call_validated/rejected,
authority_evaluated, approval_requested/denied, execution_started/succeeded/failed/unknown,
result_isolated, limit_exceeded) + `agent.execution_suspended`. Evidência por tool call:
alias, actionKey, riskLevel, decision, inputHash/outputHash, authorizationId, status,
evidence do executor (só hashes). Sem input/output/headers/credential/segredo bruto.

## Persistência e migration

Migration CORRETIVA aditiva `20260803090000_agent_runtime_checkpoints` (novo enum + tabela).
Não altera migrations anteriores nem tabelas existentes. Sem nova fila, sem endpoint de
execução direta, sem endpoint de chat.

## Fora de escopo (adiado)

Provider comercial, SDK, internet, tool dinâmica, execução paralela/speculative/streaming,
delegação entre agentes/subagentes, código/shell/browser, marketplace, billing completo,
avaliação por LLM (007.6+).
