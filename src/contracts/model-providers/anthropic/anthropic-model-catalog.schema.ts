/**
 * Arden.AS — catálogo allowlisted de modelos Anthropic (ARDEN-BE-008.1).
 *
 * Catálogo FECHADO. `modelId` é exato e VERIFIED da união `Model` do SDK oficial
 * `@anthropic-ai/sdk@0.115.0` (ver ANTHROPIC_OFFICIAL_SOURCE_REGISTER.md). NÃO se
 * inventa alias/ID; modelId de request de execução é proibido; modelo DISABLED não é
 * selecionável. Limites de token por modelo NÃO foram verificáveis (docs 403) → null.
 */

import { z } from 'zod';
import { modelProviderCapability } from '../../agents/agent-keys';
import { ANTHROPIC_PROVIDER_KEY, ANTHROPIC_PROVIDER_VERSION } from './anthropic-provider-keys';

export const commercialModelCatalogEntry = z.object({
  providerKey: z.literal(ANTHROPIC_PROVIDER_KEY),
  providerVersion: z.literal(ANTHROPIC_PROVIDER_VERSION),
  /** ID EXATO da API (VERIFIED). Nunca alias inventado. */
  modelId: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120),
  status: z.enum(['ACTIVE', 'DEPRECATED', 'DISABLED']),
  /** Falso nesta fase — provider ainda não executável (CONTRACT_ONLY). */
  productionAllowed: z.boolean(),
  capabilities: z.array(modelProviderCapability).max(5),
  /** null quando não verificado em fonte oficial (docs 403). */
  maximumInputTokens: z.number().int().positive().nullable(),
  maximumOutputTokens: z.number().int().positive().nullable(),
  supportsStructuredOutput: z.boolean(),
  supportsToolCalling: z.boolean(),
  supportsPromptCaching: z.boolean(),
  supportsVision: z.boolean(),
  supportsStreaming: z.boolean(),
  rateCardKey: z.string().max(120).nullable(),
  releasedAt: z.string().nullable().optional(),
  deprecatedAt: z.string().nullable().optional(),
  sunsetAt: z.string().nullable().optional(),
  /** Fontes oficiais que suportam a entrada (obrigatório ≥1). */
  sourceReferences: z.array(z.string().min(1).max(300)).min(1),
});
export type CommercialModelCatalogEntry = z.infer<typeof commercialModelCatalogEntry>;

const SDK_SOURCE = '@anthropic-ai/sdk@0.115.0 Model union (VERIFIED 2026-08-03)';

/**
 * Catálogo INICIAL pequeno: snapshots datados (reprodutibilidade, §10). Todos
 * DISABLED / productionAllowed=false nesta fase (não executável). Limites null
 * (UNVERIFIED). Capabilities de nível de API verificadas (tools, tool_choice,
 * cache_creation/cache_read, stream); vision por modelo não verificado → false.
 * `rateCardKey` null enquanto preços não forem verificados diretamente (008.2).
 */
export const ANTHROPIC_MODEL_CATALOG: readonly CommercialModelCatalogEntry[] = Object.freeze([
  entry('claude-opus-4-5-20251101', 'Claude Opus 4.5 (2025-11-01)'),
  entry('claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5 (2025-09-29)'),
  entry('claude-haiku-4-5-20251001', 'Claude Haiku 4.5 (2025-10-01)'),
]);

function entry(modelId: string, displayName: string): CommercialModelCatalogEntry {
  return {
    providerKey: ANTHROPIC_PROVIDER_KEY,
    providerVersion: ANTHROPIC_PROVIDER_VERSION,
    modelId,
    displayName,
    status: 'DISABLED',
    productionAllowed: false,
    // Capability = suporte técnico IMPLEMENTADO (ARDEN-BE-008.5), não disponibilidade de
    // produção. Modelos permanecem DISABLED / productionAllowed=false.
    capabilities: ['STRUCTURED_OUTPUT', 'TOOL_CALLING'],
    maximumInputTokens: null,
    maximumOutputTokens: null,
    supportsStructuredOutput: true,
    supportsToolCalling: true,
    supportsPromptCaching: true,
    supportsVision: false,
    supportsStreaming: true,
    rateCardKey: null,
    releasedAt: null,
    deprecatedAt: null,
    sunsetAt: null,
    sourceReferences: [SDK_SOURCE],
  };
}

/** Model IDs allowlisted (para validação — request de execução nunca escolhe modelId). */
export const ANTHROPIC_ALLOWED_MODEL_IDS: readonly string[] = Object.freeze(
  ANTHROPIC_MODEL_CATALOG.map((m) => m.modelId),
);

export function isAllowedAnthropicModelId(modelId: string): boolean {
  return ANTHROPIC_ALLOWED_MODEL_IDS.includes(modelId);
}
