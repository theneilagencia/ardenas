/**
 * Arden.AS — rate cards comerciais do Anthropic (ARDEN-BE-008.1).
 *
 * Unidade: MINOR UNITS (cents de USD) por MILHÃO de tokens — BigInt, sem float.
 * Precisão: preços atuais da Anthropic têm granularidade de cents inteiros por
 * milhão, então a unidade menor do BE-007.6 basta (sem microunits, sem alterar
 * contrato existente). Preços NÃO foram verificados diretamente (docs 403,
 * PENDING_DIRECT) → catálogo VAZIO nesta fase; preenchido em 008.2 após verificação
 * direta. Custo ausente permanece `null` (nunca 0) — semântica do BE-007.6 mantida.
 */

import { z } from 'zod';
import { ANTHROPIC_PROVIDER_KEY, ANTHROPIC_PROVIDER_VERSION } from './anthropic-provider-keys';

export const commercialModelRateCardDefinition = z.object({
  key: z.string().min(1).max(120),
  providerKey: z.literal(ANTHROPIC_PROVIDER_KEY),
  providerVersion: z.literal(ANTHROPIC_PROVIDER_VERSION),
  modelId: z.string().min(1).max(120),
  currency: z.literal('USD'),
  inputCostPerMillionTokensMinor: z.bigint().nonnegative(),
  outputCostPerMillionTokensMinor: z.bigint().nonnegative(),
  /** Escrita de cache (cache_creation_input_tokens) — rate distinto (VERIFIED que o campo existe). */
  cachedInputWriteCostPerMillionTokensMinor: z.bigint().nonnegative().nullable().optional(),
  /** Leitura de cache (cache_read_input_tokens) — rate distinto. */
  cachedInputReadCostPerMillionTokensMinor: z.bigint().nonnegative().nullable().optional(),
  effectiveFrom: z.string().min(1),
  effectiveUntil: z.string().nullable().optional(),
  sourceUrl: z.string().min(1),
  sourceAccessedAt: z.string().min(1),
  catalogHash: z.string().min(1),
});
export type CommercialModelRateCardDefinition = z.infer<typeof commercialModelRateCardDefinition>;

/**
 * VAZIO nesta fase: nenhum preço verificado diretamente (Cloudflare 403 nas páginas
 * oficiais de preço). Inventar preço é reprovação automática. Será preenchido em
 * 008.2 após leitura direta da página oficial de preços.
 */
export const ANTHROPIC_RATE_CARDS: readonly CommercialModelRateCardDefinition[] = Object.freeze([]);

/** ceil(tokens × ratePerMillionMinor / 1_000_000) — inteiro, BigInt, sem float. */
export function estimateComponentCostMinor(tokens: number, ratePerMillionMinor: bigint): bigint {
  if (tokens <= 0 || ratePerMillionMinor === 0n) return 0n;
  const num = BigInt(tokens) * ratePerMillionMinor;
  const denom = 1_000_000n;
  // Arredondamento para cima (ceil) inteiro.
  return (num + denom - 1n) / denom;
}
