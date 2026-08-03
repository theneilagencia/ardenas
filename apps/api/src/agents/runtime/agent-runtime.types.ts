/**
 * Arden.AS API — tipos internos do runtime de agentes (ARDEN-BE-007.3).
 *
 * Tipos NÃO expostos por HTTP. Nenhum carrega segredo, credencial, SDK, provider client
 * ou prompt livre vindo do request. A execução ocorre exclusivamente pela etapa
 * `agent.execute` do motor do BE-005 — nunca por endpoint direto.
 */

import type {
  AgentExecutionResult,
  AgentContextPolicy,
  AgentExecutionPolicy,
  AgentToolPolicy,
  AgentEvaluationPolicy,
  AgentCostPolicy,
} from '@arden/contracts';

/** Entrada do runtime, montada pelo `AgentStepExecutor` a partir da LINHA do run. */
export interface AgentRuntimeExecutionInput {
  organizationId: string;
  operationId: string;
  operationVersionId: string;
  executionRunId: string;
  executionStepId: string;
  agentDefinitionId: string;
  agentVersionId: string;
  input: unknown;
  correlationId: string;
  attemptNumber: number;
  /** Usuário que originou a execução (para autoria de aprovação/autorização). */
  requestedByUserId: string;
  /** Timeout efetivo da etapa (ms); 0 = sem teto de etapa. */
  timeoutMs: number;
}

/** Runtime resolvido tenant-scoped — SEM segredo/credencial/SDK/provider client. */
export interface ResolvedAgentRuntime {
  agentDefinitionId: string;
  agentVersionId: string;
  agentKey: string;
  versionNumber: number;
  contentHash: string;

  modelConfigurationId: string;
  providerKey: string;
  providerVersion: string;
  modelId: string;
  /** Se o provider é permitido em produção (o de teste não é). */
  providerProductionAllowed: boolean;

  objective: string;
  systemInstructions: string;

  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;

  contextPolicy: AgentContextPolicy;
  executionPolicy: AgentExecutionPolicy;
  toolPolicy: AgentToolPolicy;
  evaluationPolicy: AgentEvaluationPolicy;
  costPolicy: AgentCostPolicy;
}

export interface AgentRuntimeResolver {
  resolveForExecution(input: {
    organizationId: string;
    operationId: string;
    operationVersionId: string;
    agentDefinitionId: string;
    agentVersionId: string;
  }): Promise<ResolvedAgentRuntime>;
}

/** Evento de ciclo de vida do agente (append-only no trail de execução). */
export interface AgentLifecycleEvent {
  eventType: string;
  payload: Record<string, unknown>;
}

/** Entrada de auditoria de negócio (audit_events) para início/fim da execução. */
export interface AgentAuditEntry {
  action: string;
  outcome: 'SUCCESS' | 'FAILURE';
  metadata: Record<string, unknown>;
}

/**
 * Resultado do runtime consumido pelo `AgentStepExecutor`. O runtime é PURO em relação
 * ao motor: NÃO grava eventos/evidência/auditoria — devolve os dados sanitizados para o
 * executor registrar via os recorders do BE-005 (evita ciclo de módulo).
 */
export interface AgentRuntimeOutcome {
  result: AgentExecutionResult;
  /** Se a falha é elegível a retry pelo motor (transiente). SUCCEEDED ignora. */
  retryable: boolean;
  /** Conteúdo de evidência SANITIZADO (hashes, usage, validação, avaliação, status). */
  evidence: Record<string, unknown>;
  /** Eventos `agent.*` do ciclo de vida (execução), em ordem. */
  events: AgentLifecycleEvent[];
  /** Auditoria de negócio (início + classificação final). */
  audit: AgentAuditEntry[];
}

export interface AgentRuntime {
  execute(input: AgentRuntimeExecutionInput): Promise<AgentRuntimeOutcome>;
}
