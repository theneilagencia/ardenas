# Arquitetura de execução de agente (ARDEN-BE-007, auditoria)

> Como uma etapa de IA entra no motor de execução do BE-005 SEM criar nova fila, worker
> ou infraestrutura. Reutiliza tudo o que 006.6 provou.

## 1. Fluxo (reuso do BE-005)

```
ExecutionWorker → ExecutionProcessor → StepExecutorRegistry
  → AgentStepExecutor (DI, registrado por action key 'agent.execute')
    → AgentBindingResolver (tenant-scoped: agent version publicada + tool bindings)
    → ContextAssembler (fontes filtradas por policy + budget de tokens + redação)
    → ModelProvider.generate (structured output; tool-use quando permitido)
    → AgentToolCallGate (valida cada tool call: alias permitido + autoridade BE-004)
      → ExternalToolExecutor / executores internos (reuso de 006.6)
    → AgentEvaluator (verificações determinísticas)
  → ExecutionRecorder (evidência sanitizada) + AuditRecorder (agent.*)
```

- `AgentStepExecutor` implementa a MESMA interface `StepExecutor` do BE-005 e é
  selecionado por **action key registrada** (`agent.execute`) no `StepExecutorRegistry`
  — nunca por classe vinda do banco, sem `eval`.
- A resolução do agente é tenant-scoped (`findFirst` por `organizationId`), como os
  resolvers do BE-006.

## 2. Action keys candidatas (§14) — decisão: começar MÍNIMO

| Action key | Fase | Observação |
| --- | --- | --- |
| `agent.execute` | 007 (slice) | ÚNICA necessária para o primeiro vertical slice. |
| `agent.evaluate` | futura | Avaliação isolada; adiar até o slice validar. |
| `model.generate_structured` | futura | Geração estruturada sem tool-use. |
| `model.classify` / `model.extract` / `model.summarize` | futura | Tarefas específicas; NÃO criar antes de validar. |

**Decisão:** o vertical slice usa **apenas `agent.execute`**. Não criar as demais por
antecipação. Todas entram no `executorActionKey` (contrato de execução) como as externas
de 006.6.

## 3. Sem endpoint público direto

**PROIBIDO** criar `POST /agents/{id}/run`, `POST /models/generate`, `POST /chat`. A
execução ocorre EXCLUSIVAMENTE pelo motor de operações (`POST .../executions` ou gatilho
de webhook do BE-006.7). Endpoints administrativos (CRUD de agentes/versões/model
configs) são tenant-scoped e permissionados, como os de conectores.

## 4. Loop do agente — limites obrigatórios (§22)

`AgentExecutionPolicy` (versionada, aplicada pelo `AgentStepExecutor`):

```ts
interface AgentExecutionPolicy {
  maximumTurns: number;          // ex.: 6
  maximumToolCalls: number;      // ex.: 4
  maximumDurationMs: number;     // ≤ timeout do step/execução
  maximumInputTokens: number;
  maximumOutputTokens: number;
  maximumCost: number;           // teto de custo estimado (moeda base)
}
```

Sem loop infinito; sem execução autônoma fora de uma `ExecutionRun`. Exceder qualquer
limite → falha segura tipada (`AGENT_LIMIT_EXCEEDED`), evidência registrada, sem retry
automático que ignore o limite. O timeout efetivo é `min(policy, step.timeoutAt,
execução)` — mesmo padrão do BE-006.6.

## 5. Resultado

`SUCCEEDED` (output estruturado válido + avaliação passou) · `FAILED` (erro determinístico
ou avaliação reprovou) · `SUSPENDED` (aprovação humana pendente para uma tool call que a
autoridade exige — reusa o fluxo de `ActionAuthorization`/approval do BE-004/BE-005).
Nunca "sucesso silencioso" com output inválido.

## 6. Eventos de auditoria mínimos (§26)

`agent.execution_started`, `agent.context_assembled`, `agent.model_called`,
`agent.output_received`, `agent.tool_requested`, `agent.tool_authorized`,
`agent.tool_denied`, `agent.tool_completed`, `agent.evaluation_passed`,
`agent.evaluation_failed`, `agent.execution_completed`, `agent.execution_failed`,
`agent.execution_suspended`. Reutiliza `audit_events` (BE-002/004) e o
`ExecutionRecorder` (BE-005) — **nenhuma auditoria/evidência nova**. Prompts completos
NÃO são registrados indiscriminadamente (ver `AGENT_COST_AND_USAGE.md` e
`AGENT_CONTEXT_AND_PROMPT_MODEL.md` para a classificação de dados).
