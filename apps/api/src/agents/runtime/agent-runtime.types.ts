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
  /** Conexão que guarda a credencial no cofre (ARDEN-BE-008.3); null quando não exigida. */
  credentialConnectionId: string | null;
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

/** Uso SANITIZADO de UMA chamada ao provider de modelo (ARDEN-BE-007.6). */
export interface AgentModelCallRecord {
  callIndex: number;
  purpose: 'PRIMARY' | 'OUTPUT_REPAIR' | 'TOOL_CONTINUATION' | 'EVALUATION';
  status: string;
  finishReason: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cachedOutputTokens: number;
  durationMs: number;
  requestHash: string | null;
  responseHash: string | null;
}

/** Metadados SANITIZADOS de UMA tool call (ARDEN-BE-007.6). */
export interface AgentToolCallRecord {
  toolCallId: string;
  alias: string;
  actionKey: string;
  riskLevel: string;
  decision: string;
  status: string;
  authorizationId: string | null;
  approvalRequestId: string | null;
  inputHash: string | null;
  outputHash: string | null;
  durationMs: number;
  retryCount: number;
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
  /** Uso por chamada de modelo (sanitizado) — para persistência de usage (007.6). */
  modelCalls: AgentModelCallRecord[];
  /** Metadados por tool call (sanitizado) — para persistência de usage (007.6). */
  toolCalls: AgentToolCallRecord[];
}

export interface AgentRuntime {
  execute(input: AgentRuntimeExecutionInput): Promise<AgentRuntimeOutcome>;
}
