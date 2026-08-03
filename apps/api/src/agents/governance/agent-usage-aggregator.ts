/**
 * Arden.AS API — agregação determinística de usage do agente (ARDEN-BE-007.6 §14).
 *
 * PURO. Soma tokens/contadores a partir das linhas por chamada de modelo/tool e VALIDA:
 * valores não negativos, contadores coerentes com as linhas, cached ≤ total aplicável.
 * Inconsistência → `problems[]` (o chamador emite `AGENT_USAGE_INVALID`).
 */

import { Injectable } from '@nestjs/common';
import type { AgentUsageSummary } from '@arden/contracts';
import type { AgentModelCallRecord, AgentToolCallRecord } from '../runtime/agent-runtime.types';

export interface UsageAggregateInput {
  providerKey: string;
  modelId: string;
  modelCalls: AgentModelCallRecord[];
  toolCalls: AgentToolCallRecord[];
  turnCount: number;
  repairAttemptCount: number;
  approvalCount: number;
  securitySignalCount: number;
  durationMs: number;
}

export interface UsageAggregateResult {
  summary: AgentUsageSummary;
  problems: string[];
}

@Injectable()
export class AgentUsageAggregator {
  aggregate(input: UsageAggregateInput): UsageAggregateResult {
    const problems: string[] = [];
    let inputTokens = 0, outputTokens = 0, cachedInputTokens = 0, cachedOutputTokens = 0;

    for (const c of input.modelCalls) {
      for (const [k, v] of Object.entries({ inputTokens: c.inputTokens, outputTokens: c.outputTokens, cachedInputTokens: c.cachedInputTokens, cachedOutputTokens: c.cachedOutputTokens, durationMs: c.durationMs })) {
        if (typeof v !== 'number' || v < 0 || !Number.isFinite(v)) problems.push(`model call ${c.callIndex} ${k} inválido`);
      }
      if (c.cachedInputTokens > c.inputTokens) problems.push(`model call ${c.callIndex} cachedInputTokens > inputTokens`);
      if (c.cachedOutputTokens > c.outputTokens) problems.push(`model call ${c.callIndex} cachedOutputTokens > outputTokens`);
      inputTokens += c.inputTokens;
      outputTokens += c.outputTokens;
      cachedInputTokens += c.cachedInputTokens;
      cachedOutputTokens += c.cachedOutputTokens;
    }

    for (const [k, v] of Object.entries({ turnCount: input.turnCount, repairAttemptCount: input.repairAttemptCount, approvalCount: input.approvalCount, securitySignalCount: input.securitySignalCount, durationMs: input.durationMs })) {
      if (typeof v !== 'number' || v < 0 || !Number.isFinite(v)) problems.push(`${k} inválido`);
    }

    const summary: AgentUsageSummary = {
      providerKey: input.providerKey,
      modelId: input.modelId,
      modelCallCount: input.modelCalls.length,
      toolCallCount: input.toolCalls.length,
      turnCount: Math.max(0, input.turnCount),
      repairAttemptCount: Math.max(0, input.repairAttemptCount),
      approvalCount: Math.max(0, input.approvalCount),
      securitySignalCount: Math.max(0, input.securitySignalCount),
      inputTokens,
      outputTokens,
      cachedInputTokens,
      cachedOutputTokens,
      durationMs: Math.max(0, input.durationMs),
    };
    return { summary, problems };
  }
}
