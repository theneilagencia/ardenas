/**
 * Arden.AS API — testes de unidade da governança operacional (ARDEN-BE-007.6 §41).
 * Componentes PUROS: custo, agregação de usage, avaliação, governança. Sem DB.
 */

import { describe, expect, it } from 'vitest';
import { estimateCost, type RateCardRates } from './agent-cost-estimator';
import { AgentUsageAggregator } from './agent-usage-aggregator';
import { AgentEvaluationEngine } from './agent-evaluation-engine';
import { AgentGovernanceEvaluator } from './agent-governance-evaluator';
import type { AgentModelCallRecord } from '../runtime/agent-runtime.types';

const ZERO_RATE: RateCardRates = { currency: 'USD', rateCardId: 'rc0', inputPerMillion: 0, outputPerMillion: 0, cachedInputPerMillion: 0, cachedOutputPerMillion: 0 };
const PAID_RATE: RateCardRates = { currency: 'USD', rateCardId: 'rc1', inputPerMillion: 3000, outputPerMillion: 15000, cachedInputPerMillion: 300, cachedOutputPerMillion: 0 };

const mc = (over: Partial<AgentModelCallRecord> = {}): AgentModelCallRecord => ({ callIndex: 0, purpose: 'PRIMARY', status: 'SUCCEEDED', finishReason: 'STOP', inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0, cachedOutputTokens: 0, durationMs: 10, requestHash: null, responseHash: null, ...over });

// ── Cost estimator ────────────────────────────────────────────────────────────────
describe('estimateCost', () => {
  it('rate card zero conhecida → custo 0, currency USD (não null)', () => {
    const r = estimateCost({ inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0, cachedOutputTokens: 0 }, ZERO_RATE);
    expect(r.estimatedCostMinor).toBe(0);
    expect(r.currency).toBe('USD');
    expect(r.warningCode).toBeNull();
  });
  it('rate card ausente → custo null + warning (nunca zero inventado)', () => {
    const r = estimateCost({ inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0, cachedOutputTokens: 0 }, null);
    expect(r.estimatedCostMinor).toBeNull();
    expect(r.currency).toBeNull();
    expect(r.warningCode).toBe('COST_RATE_CARD_NOT_AVAILABLE');
  });
  it('cálculo por componente com arredondamento para cima (ceil)', () => {
    // input: ceil(1000*3000/1e6)=ceil(3)=3 ; output: ceil(500*15000/1e6)=ceil(7.5)=8 → 11
    const r = estimateCost({ inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0, cachedOutputTokens: 0 }, PAID_RATE);
    expect(r.estimatedCostMinor).toBe(11);
  });
  it('inteiro, sem float; tokens 0 → custo 0', () => {
    expect(estimateCost({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cachedOutputTokens: 0 }, PAID_RATE).estimatedCostMinor).toBe(0);
  });
});

// ── Usage aggregator ──────────────────────────────────────────────────────────────
describe('AgentUsageAggregator', () => {
  const a = new AgentUsageAggregator();
  it('soma tokens e contadores; sem problemas', () => {
    const r = a.aggregate({ providerKey: 'p', modelId: 'm', modelCalls: [mc(), mc({ callIndex: 1, inputTokens: 200, outputTokens: 100 })], toolCalls: [], turnCount: 2, repairAttemptCount: 1, approvalCount: 0, securitySignalCount: 0, durationMs: 20 });
    expect(r.summary.inputTokens).toBe(1200);
    expect(r.summary.outputTokens).toBe(600);
    expect(r.summary.modelCallCount).toBe(2);
    expect(r.problems).toEqual([]);
  });
  it('usage negativa → problema', () => {
    const r = a.aggregate({ providerKey: 'p', modelId: 'm', modelCalls: [mc({ inputTokens: -5 })], toolCalls: [], turnCount: 1, repairAttemptCount: 0, approvalCount: 0, securitySignalCount: 0, durationMs: 1 });
    expect(r.problems.length).toBeGreaterThan(0);
  });
  it('cached > total → problema', () => {
    const r = a.aggregate({ providerKey: 'p', modelId: 'm', modelCalls: [mc({ inputTokens: 100, cachedInputTokens: 200 })], toolCalls: [], turnCount: 1, repairAttemptCount: 0, approvalCount: 0, securitySignalCount: 0, durationMs: 1 });
    expect(r.problems.some((p) => p.includes('cachedInputTokens'))).toBe(true);
  });
});

// ── Evaluation engine ─────────────────────────────────────────────────────────────
describe('AgentEvaluationEngine', () => {
  const e = new AgentEvaluationEngine();
  const base = { reachedEvaluation: true, outputSchemaValid: true, outputEvaluationPassed: true, requireEvidenceReferences: false, evidenceReferenceIds: [], turnCount: 1, maxTurns: 4, toolCallCount: 0, maxToolCalls: 5, durationMs: 10, maxDurationMs: 60000, criticalSignalCount: 0, nonCriticalSignalCount: 0, hadUnknownResult: false, hadDeniedToolCall: false, pendingApproval: false, policyHash: 'h' };
  it('tudo passa → PASSED', () => expect(e.evaluate(base).status).toBe('PASSED'));
  it('required path ausente (outputEvaluationPassed false) → FAILED', () => expect(e.evaluate({ ...base, outputEvaluationPassed: false }).status).toBe('FAILED'));
  it('schema inválido → FAILED', () => expect(e.evaluate({ ...base, outputSchemaValid: false }).status).toBe('FAILED'));
  it('unknown result → FAILED', () => expect(e.evaluate({ ...base, hadUnknownResult: true }).status).toBe('FAILED'));
  it('sinal crítico → FAILED', () => expect(e.evaluate({ ...base, criticalSignalCount: 1 }).status).toBe('FAILED'));
  it('só warning (sinal não crítico) → PARTIAL', () => expect(e.evaluate({ ...base, nonCriticalSignalCount: 1 }).status).toBe('PARTIAL'));
  it('não chegou à avaliação → NOT_RUN', () => expect(e.evaluate({ ...base, reachedEvaluation: false }).status).toBe('NOT_RUN'));
  it('aprovação pendente → FAILED (approval check)', () => expect(e.evaluate({ ...base, pendingApproval: true }).status).toBe('FAILED'));
});

// ── Governance evaluator ────────────────────────────────────────────────────────────
describe('AgentGovernanceEvaluator', () => {
  const g = new AgentGovernanceEvaluator();
  const cp = (over: Record<string, unknown> = {}) => ({ maximumEstimatedCostMinor: null, currency: null, maximumInputTokens: 8000, maximumOutputTokens: 2000, maximumToolCalls: 5, actionOnLimit: 'FAIL' as const, ...over });
  const base = { resultStatus: 'SUCCEEDED', errorCode: null as string | null, inputTokens: 100, toolCallCount: 1, turnCount: 1, estimatedCostMinor: 0 as number | null, criticalSignalCount: 0 };
  it('dentro dos limites → WITHIN_LIMITS', () => expect(g.evaluate({ ...base, costPolicy: cp() }).status).toBe('WITHIN_LIMITS'));
  it('erro de token limit → LIMIT_EXCEEDED', () => expect(g.evaluate({ ...base, errorCode: 'AGENT_TOKEN_LIMIT_EXCEEDED', costPolicy: cp() }).status).toBe('LIMIT_EXCEEDED'));
  it('sinal crítico → BLOCKED', () => expect(g.evaluate({ ...base, criticalSignalCount: 1, costPolicy: cp() }).status).toBe('BLOCKED'));
  it('custo acima do teto → LIMIT_EXCEEDED', () => expect(g.evaluate({ ...base, estimatedCostMinor: 100, costPolicy: cp({ maximumEstimatedCostMinor: 50, currency: 'USD' }) }).status).toBe('LIMIT_EXCEEDED'));
  it('próximo do teto de tokens → LIMIT_WARNING', () => expect(g.evaluate({ ...base, inputTokens: 7000, costPolicy: cp() }).status).toBe('LIMIT_WARNING'));
});
