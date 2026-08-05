# ARDEN-BE-007.3 — Relatório de implementação (runtime determinístico)

Primeiro runtime executável de agentes, 100% determinístico, sem provider comercial, SDK,
internet ou tool calling. Integra-se ao motor do BE-005 pela etapa `agent.execute`.

## Componentes (novos)

| Arquivo | Papel |
| --- | --- |
| `agents/runtime/internal-test-model.provider.ts` | Provider determinístico (`internal.test-model`), cenários por modelId (allowlist). |
| `agents/runtime/model-provider-registry.ts` | `ModelProviderRegistry` in-memory; provider desconhecido → `MODEL_PROVIDER_NOT_AVAILABLE`. |
| `agents/runtime/model-provider.errors.ts` | `ModelProviderInvocationError` (TIMEOUT/RATE_LIMIT/PROVIDER_ERROR/UNSUPPORTED_MODEL/UNKNOWN). |
| `agents/runtime/token-estimator.ts` | Estimativa determinística `ceil(bytesUTF8/4)`. |
| `agents/runtime/agent-context-assembler.ts` | Contexto v1 (input+objetivo+instruções), redação, sinais mínimos. |
| `agents/runtime/agent-output-validator.ts` | Validação de structured output (JSON Schema + bytes). |
| `agents/runtime/agent-evaluator.ts` | Avaliação determinística; LLM-judge não suportado (reprova tipado). |
| `agents/runtime/agent-runtime-resolver.ts` | Resolução tenant-scoped (§7); provider proibido em produção. |
| `agents/runtime/agent-runtime.ts` | Orquestração; devolve `AgentRuntimeOutcome` (resultado+evidência+eventos+audit). |
| `executions/agent-step.executor.ts` | Ponte StepExecutor→AgentRuntime; grava trilha; mapeia resultado (SUCCEEDED=return, demais=throw). |

## Integração (edições mínimas)

- `step-executor-registry.ts`: branch `isAgentExecutorActionKey` → `AgentStepExecutor` (DI).
- `executions.service.ts`: materialização `s.agent` (create + system trigger) com snapshot
  `$agent = {agentKey, agentDefinitionId, agentVersionId, actionKey}` (pin da versão publicada);
  fail-fast `assertAgentBinding`.
- `executions.module.ts`: importa `AgentsModule`; provê `AgentStepExecutor`.
- `agents.module.ts`: providers do runtime + `{ provide: AGENT_RUNTIME }`; exporta `AGENT_RUNTIME`
  e `AgentDefinitionsRepository`. Sem ciclo (AgentsModule não importa Executions).
- `execution.recorder.ts`: **endurecimento de redação** (cobre api-key/credential/nonce/…);
  mudança de sanitização apenas — NÃO altera o fluxo/estados do worker.

## Garantias

Sem SDK/internet/segredo; provider/modelId nunca do request; job mínimo (`{executionRunId}`);
structured output obrigatório; repair limitado; UNKNOWN nunca vira sucesso; provider de teste
proibido em produção (registry conhece, runtime não executa); tenant sempre da linha do run;
sem fila nova; sem endpoint de execução direta; sem tool calling; worker/processor/queue
inalterados funcionalmente; sem migration; sem alteração de contrato/OpenAPI.

## Fora de escopo (adiado)

Provider comercial, tool calling funcional, context assembly avançado/RAG/memória, LLM-judge,
guardrails completos e tool result isolation (007.4), persistência de usage/AgentModelCall
(007.6), billing.

## Gates

typecheck/lint/test (fe 214, api unit 342), a11y, build (fe+api), contracts:openapi sem diff,
migrate deploy/status (sem drift), seed idempotente. Integração real (PostgreSQL + worker):
suíte completa 215 testes, incluindo 8 E2E de runtime. Ver
[`ARDEN_BE_007_RUNTIME_TEST_EVIDENCE.md`](./ARDEN_BE_007_RUNTIME_TEST_EVIDENCE.md).
