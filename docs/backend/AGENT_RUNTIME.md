# Runtime de agentes (ARDEN-BE-007.3)

Primeiro runtime executável de agentes — 100% DETERMINÍSTICO, sem SDK comercial, sem
internet, sem tool calling. Uma etapa publicada com `actionKey: agent.execute` é executada
pelo motor do BE-005, sem fila nova nem endpoint direto.

## Fluxo
```
ExecutionWorker → ExecutionProcessor → StepExecutorRegistry
  → AgentStepExecutor (ponte fina; lê $agent do snapshot; tenant da LINHA do run)
    → AgentRuntime (AgentsModule; PURO em relação ao motor)
      → AgentRuntimeResolver (tenant-scoped; §7)
      → AgentContextAssemblerV1 (input + objective + systemInstructions; redação)
      → ModelProviderRegistry → InternalTestModelProvider (determinístico)
      → AgentOutputValidator (JSON Schema) → repair limitado
      → AgentEvaluator (determinístico)
  → ExecutionRecorder (eventos agent.* + evidência) + AuditRecorder (agent.execution_*)
```
O `AgentStepExecutor` é uma PONTE: não resolve provider nem duplica regra de runtime.
`AgentRuntime` não grava nada — devolve `AgentRuntimeOutcome` (resultado + evidência +
eventos + auditoria sanitizados) e o executor persiste via os recorders do BE-005.

## Garantias
Sem SDK/internet/segredo; job mínimo (`{executionRunId}`); provider/modelId nunca vêm do
request; structured output obrigatório; UNKNOWN nunca vira sucesso; provider de teste
proibido em produção; tenant sempre da linha do run; sem endpoint de execução direta.
Módulos sem ciclo: `ExecutionsModule → AgentsModule` (AgentsModule não importa Executions).
