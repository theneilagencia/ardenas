/**
 * Arden.AS API — estimador de custo determinístico (ARDEN-BE-007.6 §12/§13).
 *
 * PURO. Custo em unidade menor (INTEIRO) — sem float monetário. Regra por componente:
 *   ceil(tokens × ratePerMillion / 1_000_000), somando input/output/cachedInput/cachedOutput.
 * Rate card AUSENTE → custo `null` + warning `COST_RATE_CARD_NOT_AVAILABLE` (NUNCA zero
 * inventado). Rate card ZERO conhecida (provider interno) → custo 0 (não `null`).
 */

import { Injectable } from '@nestjs/common';

export interface RateCardRates {
  currency: string;
  rateCardId: string;
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion: number;
  cachedOutputPerMillion: number;
}

export interface CostEstimate {
  estimatedCostMinor: number | null;
  currency: string | null;
  rateCardId: string | null;
  warningCode: string | null;
}

export interface CostUsageInput {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cachedOutputTokens: number;
}

const MILLION = 1_000_000n;

/** Divisão inteira com arredondamento para CIMA (ceil). Determinística, sem float. */
function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (numerator <= 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

export function estimateCost(usage: CostUsageInput, rate: RateCardRates | null): CostEstimate {
  if (!rate) {
    return { estimatedCostMinor: null, currency: null, rateCardId: null, warningCode: 'COST_RATE_CARD_NOT_AVAILABLE' };
  }
  const cost =
    ceilDiv(BigInt(Math.max(0, usage.inputTokens)) * BigInt(rate.inputPerMillion), MILLION) +
    ceilDiv(BigInt(Math.max(0, usage.outputTokens)) * BigInt(rate.outputPerMillion), MILLION) +
    ceilDiv(BigInt(Math.max(0, usage.cachedInputTokens)) * BigInt(rate.cachedInputPerMillion), MILLION) +
    ceilDiv(BigInt(Math.max(0, usage.cachedOutputTokens)) * BigInt(rate.cachedOutputPerMillion), MILLION);
  return { estimatedCostMinor: Number(cost), currency: rate.currency, rateCardId: rate.rateCardId, warningCode: null };
}

@Injectable()
export class AgentCostEstimator {
  estimate(usage: CostUsageInput, rate: RateCardRates | null): CostEstimate {
    return estimateCost(usage, rate);
  }
}
