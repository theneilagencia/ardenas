/**
 * Arden.AS API — observabilidade do runtime de agentes (ARDEN-BE-007.6 §27/§28).
 *
 * Registro de métricas IN-MEMORY (sem dependência externa, sem rede). Counters e um
 * histograma simples (sum/count) com LABELS de baixa cardinalidade (status/provider/model/
 * risk/decision/errorCode). NUNCA usa labels de alta cardinalidade (org/run/user/agent/
 * correlation). `snapshot()` serve aos testes. Também emite log estruturado por execução.
 */

import { Injectable, Logger } from '@nestjs/common';

/** Labels permitidas (baixa cardinalidade). Qualquer outra chave é descartada. */
const ALLOWED_LABELS = new Set(['status', 'provider', 'model', 'risk', 'decision', 'error_code', 'governance', 'evaluation']);

function labelKey(name: string, labels: Record<string, string>): string {
  const parts = Object.keys(labels)
    .filter((k) => ALLOWED_LABELS.has(k) && labels[k] != null)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return parts.length ? `${name}{${parts.join(',')}}` : name;
}

@Injectable()
export class AgentMetrics {
  private readonly logger = new Logger(AgentMetrics.name);
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, { sum: number; count: number }>();

  increment(name: string, labels: Record<string, string> = {}, by = 1): void {
    const key = labelKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = labelKey(name, labels);
    const h = this.histograms.get(key) ?? { sum: 0, count: 0 };
    h.sum += value;
    h.count += 1;
    this.histograms.set(key, h);
  }

  /** Snapshot imutável (para inspeção/testes). */
  snapshot(): { counters: Record<string, number>; histograms: Record<string, { sum: number; count: number }> } {
    return { counters: Object.fromEntries(this.counters), histograms: Object.fromEntries(this.histograms) };
  }

  /** Emite o conjunto padrão de métricas + log estruturado de uma execução de agente. */
  recordExecution(input: {
    status: string; governanceStatus: string; evaluationStatus: string;
    providerKey: string; modelId: string; errorCode: string | null;
    modelCallCount: number; toolCallCount: number; inputTokens: number; outputTokens: number;
    estimatedCostMinor: number | null; approvalCount: number; securitySignalCount: number;
    criticalSignalCount: number; unknownResult: boolean; limitExceeded: boolean; durationMs: number;
    executionRunId: string; executionStepId: string; agentVersionId: string; correlationId: string;
  }): void {
    const l = { status: input.status, provider: input.providerKey, model: input.modelId, governance: input.governanceStatus, evaluation: input.evaluationStatus, error_code: input.errorCode ?? 'none' };
    this.increment('arden_agent_executions_total', l);
    this.observe('arden_agent_execution_duration_ms', input.durationMs, l);
    this.increment('arden_agent_model_calls_total', l, input.modelCallCount);
    this.increment('arden_agent_tool_calls_total', l, input.toolCallCount);
    this.increment('arden_agent_input_tokens_total', l, input.inputTokens);
    this.increment('arden_agent_output_tokens_total', l, input.outputTokens);
    if (input.estimatedCostMinor != null) this.increment('arden_agent_estimated_cost_minor_total', l, input.estimatedCostMinor);
    this.increment('arden_agent_approvals_total', l, input.approvalCount);
    this.increment('arden_agent_security_signals_total', l, input.securitySignalCount);
    if (input.unknownResult) this.increment('arden_agent_unknown_results_total', l);
    if (input.limitExceeded) this.increment('arden_agent_limit_exceeded_total', l);

    // Log estruturado (campos, nunca conteúdo).
    this.logger.log({
      executionRunId: input.executionRunId, executionStepId: input.executionStepId, agentVersionId: input.agentVersionId,
      provider: input.providerKey, model: input.modelId, status: input.status, governanceStatus: input.governanceStatus,
      evaluationStatus: input.evaluationStatus, modelCallCount: input.modelCallCount, toolCallCount: input.toolCallCount,
      inputTokens: input.inputTokens, outputTokens: input.outputTokens, estimatedCostMinor: input.estimatedCostMinor,
      durationMs: input.durationMs, correlationId: input.correlationId,
    }, 'agent execution recorded');
  }
}
