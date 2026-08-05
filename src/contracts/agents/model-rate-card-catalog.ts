/**
 * Arden.AS — API v1 · catálogo INTERNO de rate cards estimados (ARDEN-BE-007.6).
 *
 * SYSTEM-MANAGED. NÃO é preço comercial real — apenas estimativa determinística, sem
 * internet. Custos em unidade menor por MILHÃO de tokens. `internal.test-model` = tudo 0
 * USD (custo ZERO CONHECIDO, nunca `null`). Rate cards comerciais reais chegam com o
 * provider real (fase futura). Projeção idempotente (upsert por hash).
 */

export interface ModelRateCardCanonical {
  providerKey: string;
  providerVersion: string;
  modelId: string;
  currency: string;
  inputCostPerMillionTokensMinor: number;
  outputCostPerMillionTokensMinor: number;
  cachedInputCostPerMillionTokensMinor: number;
  cachedOutputCostPerMillionTokensMinor: number;
  source: string;
}

/** Model IDs determinísticos do provider interno (custo zero conhecido em USD). */
const INTERNAL_TEST_MODEL_IDS = [
  'test/structured-success', 'test/structured-invalid', 'test/structured-repairable',
  'test/timeout', 'test/rate-limit', 'test/provider-error', 'test/content-filtered', 'test/unknown-result',
  'test/tool-read-success', 'test/tool-write-authorized', 'test/tool-requires-approval', 'test/tool-denied',
  'test/tool-invalid-alias', 'test/tool-invalid-input', 'test/tool-limit', 'test/tool-unknown-result',
  'test/tool-result-injection', 'test/tool-then-final-output', 'test-deterministic',
];

export const MODEL_RATE_CARDS: readonly ModelRateCardCanonical[] = Object.freeze(
  INTERNAL_TEST_MODEL_IDS.map((modelId) => ({
    providerKey: 'internal.test-model',
    providerVersion: '1',
    modelId,
    currency: 'USD',
    inputCostPerMillionTokensMinor: 0,
    outputCostPerMillionTokensMinor: 0,
    cachedInputCostPerMillionTokensMinor: 0,
    cachedOutputCostPerMillionTokensMinor: 0,
    source: 'INTERNAL',
  })),
);

/** Projeção pura (rows a serem upsertadas). Não toca no banco. */
export function projectRateCards(): readonly ModelRateCardCanonical[] {
  return MODEL_RATE_CARDS;
}
