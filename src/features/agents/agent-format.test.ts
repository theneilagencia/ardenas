/**
 * Arden.AS — testes de formatação do domínio de agentes (ARDEN-BE-007.7 §46, §52).
 * Distinção CRÍTICA: custo `null` ("não disponível") ≠ custo 0 conhecido. Conversão
 * de unidade menor sem ponto flutuante monetário.
 */

import { describe, expect, it } from 'vitest';
import { COST_UNAVAILABLE, formatMinorCost, formatCostSummary, toMinorUnits, fromMinorUnits, formatCount } from './agent-format';
import type { AgentCostSummary } from '@/contracts';

describe('formatMinorCost — custo conhecido vs indisponível', () => {
  it('custo 0 conhecido → formata "US$ 0,00" (NUNCA indisponível)', () => {
    const out = formatMinorCost(0, 'USD', 'pt-BR');
    expect(out).not.toBe(COST_UNAVAILABLE);
    expect(String(out)).toMatch(/0,00/);
  });
  it('custo null → COST_UNAVAILABLE (NUNCA "0,00")', () => {
    expect(formatMinorCost(null, null)).toBe(COST_UNAVAILABLE);
    expect(formatMinorCost(null, 'USD')).toBe(COST_UNAVAILABLE);
    expect(formatMinorCost(1234, null)).toBe(COST_UNAVAILABLE);
  });
  it('custo positivo → formata o valor oficial (sem recalcular)', () => {
    const out = formatMinorCost(1234, 'USD', 'en-US');
    expect(String(out)).toMatch(/12\.34/);
  });
});

describe('formatCostSummary', () => {
  const base: AgentCostSummary = { estimatedCostMinor: null, currency: null, rateCardId: null, warningCode: 'COST_RATE_CARD_NOT_AVAILABLE' };
  it('rate card ausente → indisponível', () => {
    expect(formatCostSummary(base)).toBe(COST_UNAVAILABLE);
  });
  it('zero conhecido → formatado', () => {
    expect(formatCostSummary({ ...base, estimatedCostMinor: 0, currency: 'USD', warningCode: null })).not.toBe(COST_UNAVAILABLE);
  });
});

describe('toMinorUnits — sem float monetário', () => {
  it('"12.34" → 1234', () => expect(toMinorUnits('12.34')).toBe(1234));
  it('"12,5" (vírgula) → 1250', () => expect(toMinorUnits('12,5')).toBe(1250));
  it('"7" → 700', () => expect(toMinorUnits('7')).toBe(700));
  it('vazio → null', () => expect(toMinorUnits('')).toBeNull());
  it('inválido → null', () => { expect(toMinorUnits('abc')).toBeNull(); expect(toMinorUnits('1.234')).toBeNull(); });
  it('0.1 + 0.2 não sofre erro de float (10 + 20 = 30)', () => {
    expect((toMinorUnits('0.1')! + toMinorUnits('0.2')!)).toBe(30);
  });
});

describe('fromMinorUnits', () => {
  it('1234 → "12.34"', () => expect(fromMinorUnits(1234)).toBe('12.34'));
  it('null → ""', () => expect(fromMinorUnits(null)).toBe(''));
  it('roundtrip', () => expect(toMinorUnits(fromMinorUnits(999))).toBe(999));
});

describe('formatCount', () => {
  it('formata milhares', () => expect(formatCount(12345, 'en-US')).toBe('12,345'));
});
