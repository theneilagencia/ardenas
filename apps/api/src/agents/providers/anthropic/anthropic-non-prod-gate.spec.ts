/**
 * Arden.AS API — testes do gate não produtivo Anthropic (ARDEN-BE-008.4 §29-37/§47).
 * Bloqueio de produção, allowlist de organização, gate de chamada externa, quotas,
 * concorrência e circuit breaker. Puro; sem DB, sem rede.
 */

import { describe, expect, it } from 'vitest';
import { AnthropicNonProdGate } from './anthropic-non-prod-gate';

function gate(over: Record<string, unknown> = {}): AnthropicNonProdGate {
  const config = {
    NODE_ENV: 'development',
    ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED: true,
    anthropicNonProdAllowedOrganizationIds: ['org-allowed'],
    ANTHROPIC_NON_PROD_MAX_OUTPUT_TOKENS: 256,
    ANTHROPIC_NON_PROD_DAILY_CALL_CAP: 2,
    ANTHROPIC_NON_PROD_MAX_CONCURRENCY: 1,
    ANTHROPIC_CIRCUIT_BREAKER_THRESHOLD: 2,
    ANTHROPIC_CIRCUIT_BREAKER_COOLDOWN_MS: 60_000,
    ...over,
  };
  return new AnthropicNonProdGate(config as never);
}
const DAY = '2026-08-03';

describe('AnthropicNonProdGate — bloqueios', () => {
  it('produção sempre bloqueia (mesmo com flags)', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => gate().assertRealCallAllowed('org-allowed', 0, DAY)).toThrow();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
  it('gate de chamada externa desligado bloqueia', () => {
    expect(() => gate({ ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED: false }).assertRealCallAllowed('org-allowed', 0, DAY)).toThrow();
  });
  it('organização fora da allowlist bloqueia', () => {
    expect(() => gate().assertRealCallAllowed('org-other', 0, DAY)).toThrow();
    expect(() => gate().assertRealCallAllowed('org-allowed', 0, DAY)).not.toThrow();
  });
});

describe('AnthropicNonProdGate — quotas e concorrência', () => {
  it('quota diária bloqueia após o teto', () => {
    const g = gate();
    g.assertRealCallAllowed('org-allowed', 0, DAY); g.acquire('org-allowed', DAY); g.release();
    g.assertRealCallAllowed('org-allowed', 0, DAY); g.acquire('org-allowed', DAY); g.release();
    expect(() => g.assertRealCallAllowed('org-allowed', 0, DAY)).toThrow(); // 3ª excede cap=2
  });
  it('concorrência bloqueia acima do limite', () => {
    const g = gate();
    g.acquire('org-allowed', DAY); // 1 em voo (cap=1)
    expect(() => g.assertRealCallAllowed('org-allowed', 0, DAY)).toThrow();
    g.release();
    expect(() => g.assertRealCallAllowed('org-allowed', 0, DAY)).not.toThrow();
  });
});

describe('AnthropicNonProdGate — circuit breaker', () => {
  it('abre após falhas consecutivas e vira half-open após cooldown', () => {
    const g = gate();
    expect(g.breakerState(0)).toBe('CLOSED');
    g.recordFailure(1000); g.recordFailure(1000); // threshold=2 → OPEN
    expect(g.breakerState(1000)).toBe('OPEN');
    expect(() => g.assertRealCallAllowed('org-allowed', 1000, DAY)).toThrow();
    expect(g.breakerState(1000 + 60_000)).toBe('HALF_OPEN');
    g.recordSuccess();
    expect(g.breakerState(1000 + 60_000)).toBe('CLOSED');
  });
});
