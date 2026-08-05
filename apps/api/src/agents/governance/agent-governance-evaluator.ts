/**
 * Arden.AS API — governança operacional determinística (ARDEN-BE-007.6 §19–21).
 *
 * PURO. Combina limites de tokens/tools/turns/duração/custo, sinais críticos, unknown e
 * disponibilidade em: WITHIN_LIMITS / LIMIT_WARNING / LIMIT_EXCEEDED / BLOCKED. O custo
 * DESCONHECIDO nunca é tratado como zero. A ação (FAIL/SUSPEND/REQUIRE_APPROVAL) vem da
 * `AgentCostPolicy`. Custo interno = 0 → sempre dentro do teto monetário; tokens ainda valem.
 */

import { Injectable } from '@nestjs/common';
import type { AgentCostPolicy } from '@arden/contracts';

export type AgentGovernanceStatus = 'WITHIN_LIMITS' | 'LIMIT_WARNING' | 'LIMIT_EXCEEDED' | 'BLOCKED';

/** Erros da execução que já representam um teto atingido. */
const LIMIT_ERROR_CODES: ReadonlySet<string> = new Set([
  'AGENT_TOKEN_LIMIT_EXCEEDED', 'AGENT_TOOL_CALL_LIMIT_EXCEEDED', 'AGENT_TURN_LIMIT_EXCEEDED',
  'AGENT_COST_LIMIT_EXCEEDED', 'AGENT_TIMEOUT', 'AGENT_CONTEXT_TOO_LARGE', 'AGENT_CONTEXT_BUDGET_EXCEEDED',
]);
const WARN_RATIO = 0.8;

export interface AgentGovernanceInput {
  resultStatus: string;
  errorCode: string | null;
  costPolicy: AgentCostPolicy;
  inputTokens: number;
  toolCallCount: number;
  turnCount: number;
  estimatedCostMinor: number | null;
  criticalSignalCount: number;
}

export interface AgentGovernanceDecision {
  status: AgentGovernanceStatus;
  reasonCode: string;
  action: AgentCostPolicy['actionOnLimit'];
}

@Injectable()
export class AgentGovernanceEvaluator {
  evaluate(input: AgentGovernanceInput): AgentGovernanceDecision {
    const action = input.costPolicy.actionOnLimit;

    if (input.criticalSignalCount > 0 || input.errorCode === 'AGENT_PROMPT_INJECTION_DETECTED') {
      return { status: 'BLOCKED', reasonCode: 'CRITICAL_SECURITY_SIGNAL', action };
    }

    if (input.errorCode && LIMIT_ERROR_CODES.has(input.errorCode)) {
      return { status: 'LIMIT_EXCEEDED', reasonCode: input.errorCode, action };
    }

    const maxCost = input.costPolicy.maximumEstimatedCostMinor ?? null;
    if (maxCost != null && input.estimatedCostMinor != null && input.estimatedCostMinor > maxCost) {
      return { status: 'LIMIT_EXCEEDED', reasonCode: 'COST_LIMIT_EXCEEDED', action };
    }

    const nearToken = input.inputTokens >= WARN_RATIO * input.costPolicy.maximumInputTokens;
    const nearTool = input.costPolicy.maximumToolCalls > 0 && input.toolCallCount >= WARN_RATIO * input.costPolicy.maximumToolCalls;
    const nearCost = maxCost != null && maxCost > 0 && input.estimatedCostMinor != null && input.estimatedCostMinor >= WARN_RATIO * maxCost;
    if (nearToken || nearTool || nearCost) {
      return { status: 'LIMIT_WARNING', reasonCode: 'APPROACHING_LIMIT', action };
    }

    return { status: 'WITHIN_LIMITS', reasonCode: 'OK', action };
  }
}
