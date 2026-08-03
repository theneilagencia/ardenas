/**
 * Arden.AS — parâmetros permitidos da ModelConfiguration Anthropic (ARDEN-BE-008.1).
 *
 * Reutiliza a ModelConfiguration existente (providerKey/version/modelId/
 * credentialConnectionId/parameters/status/revision) — NENHUMA alteração de Prisma.
 * Parâmetros são um schema DISCRIMINADO por provider (não objeto livre). Faixas
 * exatas de temperature/top_p são UNVERIFIED (docs 403) → limites conservadores.
 */

import { z } from 'zod';
import { ANTHROPIC_ALLOWED_MODEL_IDS } from './anthropic-model-catalog.schema';

/**
 * Parâmetros de geração aceitos para Anthropic (subset seguro; ranges a confirmar).
 * `.strict()` REJEITA qualquer chave não listada — nunca aceita `model`, `apiKey`,
 * `baseUrl`, `headers`, `tools`, `system`, `organizationId`, `timeout` ou `retry` (§25).
 */
export const anthropicModelParameters = z
  .object({
    maximumOutputTokens: z.number().int().positive().max(200_000),
    temperature: z.number().min(0).max(1).optional(),
    topP: z.number().min(0).max(1).optional(),
    stopSequences: z.array(z.string().min(1).max(120)).max(8).optional(),
  })
  .strict();
export type AnthropicModelParameters = z.infer<typeof anthropicModelParameters>;

/** Validação de que o modelId pertence à allowlist do provider (nunca arbitrário). */
export function assertAllowedAnthropicModelId(modelId: string): void {
  if (!ANTHROPIC_ALLOWED_MODEL_IDS.includes(modelId)) {
    throw new Error(`modelId não allowlisted para anthropic.direct: ${modelId}`);
  }
}
