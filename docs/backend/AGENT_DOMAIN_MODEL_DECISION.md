# Modelo de domínio de agente — decisão (ARDEN-BE-007, auditoria)

> Documento de AUDITORIA/decisão. Nenhum código nesta etapa. Define o que é um agente
> no Arden.AS e sua relação com o domínio existente (operações, versões, execução,
> autoridade). Confronta o modelo proposto no prompt com a arquitetura real do BE-003/
> BE-004/BE-005/BE-006.

## 1. Princípio: Arden.AS NÃO é um chat

Um **agente** existe para executar **operações corporativas versionadas** — não para
conversar. A unidade central permanece a **operação publicada** (BE-003) com sua
autoridade (BE-004), execução (BE-005) e ferramentas (BE-006). O agente é um EXECUTOR
de IA que roda DENTRO de uma `ExecutionRun`, sob as mesmas garantias de tenant,
autoridade, auditoria e evidência.

## 2. Relação Agent × Operation — decisão: **A + C** (combinação controlada)

Avaliadas as três alternativas do prompt:

- **A — agente é uma etapa da operação**: `OperationVersion → AgentStep → AgentVersion`.
- **B — agente é a própria operação** (executa independente): **REJEITADA** — quebraria
  a operação como unidade central, a autoridade e a auditoria; viraria "chat/execução
  autônoma".
- **C — agente é um executor reutilizável**: `OperationStep → agent.execute →
  AgentVersion`.

**Decisão: A + C.** O agente é uma entidade **versionada e reutilizável** (C),
**selecionada por uma etapa da operação** via a `action key` `agent.execute` (A). Isso
espelha exatamente o padrão do BE-006.6, onde `operationStep.tool = { alias, actionKey }`
seleciona uma ferramenta externa por alias. Um agente será selecionado por um
`operationStep.agent = { agentKey|alias, actionKey: 'agent.execute' }` (a confirmar no
006/007 contrato), e resolvido tenant-scoped na execução — **nunca** por endpoint
público direto.

Justificativa: reusa o motor do BE-005 (fila/worker/processor/registry de executores),
o `StepExecutorRegistry` (roteia por action key registrada via DI) e as garantias de
autoridade/auditoria/evidência já provadas. Um `AgentStepExecutor` entra no registry do
mesmo modo que o `ExternalToolStepExecutor` entrou em 006.6.

## 3. `AgentDefinition` (proposto, a confrontar com a persistência real)

```ts
interface AgentDefinition {
  id: string; organizationId: string; key: string; name: string; description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  createdByUserId: string; createdAt: string; updatedAt: string; revision: number;
}
```

Espelha `OrganizationConnection`/`ConnectorDefinition`: tenant-scoped, `status` com state
machine, `revision` (concorrência otimista), auditado. `key` estável por tenant.

## 4. `AgentVersion` (proposto)

```ts
interface AgentVersion {
  id: string; organizationId: string; agentDefinitionId: string; versionNumber: number;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  objective: string; systemInstructions: string;
  modelConfigurationId: string;
  toolBindingAliases: string[];        // aliases de tool binding da operação (BE-006), não IDs livres
  inputSchema: JsonSchema; outputSchema: JsonSchema;
  contextPolicy: AgentContextPolicy;   // fontes permitidas + budget de tokens + redação
  executionPolicy: AgentExecutionPolicy; // limites do loop (turns/tool calls/tokens/custo/timeout)
  evaluationPolicy: AgentEvaluationPolicy; // verificações determinísticas + judge opcional
  createdAt: string; publishedAt?: string;
}
```

Espelha `OperationVersion` (BE-003): DRAFT→PUBLISHED→RETIRED, imutável após publicação,
publicação transacional. **`systemInstructions` e `objective` são versionados** — nunca
vêm do request de execução (anti-prompt-injection e reprodutibilidade).

### Nota de alinhamento com o domínio real
O Arden.AS já tem `authorityProfile` na `OperationVersion` (nível 1–5, allowedActions,
approvalRequired). A `executionPolicy` do agente NÃO substitui o Gradiente de Autoridade
— ela o COMPLEMENTA com limites de runtime (custo/turnos). A autoridade de cada
`tool call` continua sendo decidida pela política da operação (BE-004).

## 5. Invariantes preservadas

O agente **não substitui**: operação, versão publicada, policy, approval,
`ActionAuthorization`, `ExecutionRun`, `ExecutionStep`, audit trail, evidence. Ele é um
**executor** entre eles. Nenhuma execução de agente ocorre fora de uma `ExecutionRun`.
Modelos são **infraestrutura substituível** (ver `MODEL_PROVIDER_ABSTRACTION.md`).
Segredos permanecem no cofre (nunca no prompt).
