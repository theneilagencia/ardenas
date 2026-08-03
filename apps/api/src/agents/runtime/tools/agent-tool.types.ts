/**
 * Arden.AS API — tipos internos de tool calling do agente (ARDEN-BE-007.5).
 *
 * NÃO expostos por HTTP. O modelo apenas PROPÕE (`ModelToolCall`); o servidor resolve,
 * valida, autoriza e executa. `actionKey`, `connectionId`, credencial, URL e headers
 * NUNCA são expostos ao modelo — só a superfície mínima (`ModelToolDefinition`).
 */

import type { AgentToolRiskLevel, ModelMessage } from '@arden/contracts';

/** Definição resolvida (interna): a superfície do modelo + a actionKey server-side. */
export interface ResolvedAgentToolDefinition {
  alias: string;
  description: string;
  inputSchema: Record<string, unknown>;
  riskLevel: AgentToolRiskLevel;
  /** Action key externa (BE-006) — interna, jamais exposta ao modelo. */
  actionKey: string;
}

/** Histórico de tool calls de uma execução (para limites e dedup). */
export interface AgentToolCallHistoryEntry {
  alias: string;
  toolCallId: string;
  status: string;
  inputHash: string;
}

export type AgentToolAuthorityDecisionKind = 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY';

export interface AgentToolAuthorityDecision {
  decision: AgentToolAuthorityDecisionKind;
  reasonCode: string;
  authorizationId?: string;
  approvalRequestId?: string;
}

export interface AgentToolCallValidationResult {
  valid: boolean;
  code?: 'AGENT_TOOL_CALL_INVALID' | 'AGENT_TOOL_NOT_ALLOWED' | 'AGENT_TOOL_CALL_LIMIT_EXCEEDED';
  reason?: string;
}

/** Resultado do processamento de UMA tool call pelo servidor. */
export interface AgentToolCallOutcome {
  toolCallId: string;
  alias: string;
  status: 'SUCCEEDED' | 'FAILED' | 'DENIED' | 'REQUIRES_APPROVAL' | 'UNKNOWN';
  /** Mensagem TOOL isolada a reinserir no contexto (ausente em REQUIRES_APPROVAL). */
  toolMessage?: ModelMessage;
  output?: unknown;
  errorCode?: string;
  errorSummary?: string;
  evidenceReferenceIds: string[];
  approvalRequestId?: string;
  /** Metadados sanitizados para evidência/checkpoint (sem input/segredo bruto). */
  meta: {
    riskLevel: AgentToolRiskLevel;
    actionKey: string;
    inputHash: string;
    outputHash?: string;
    authorizationId?: string;
    idempotencyKey: string;
    isolated: boolean;
    securitySignalCount: number;
  };
}
