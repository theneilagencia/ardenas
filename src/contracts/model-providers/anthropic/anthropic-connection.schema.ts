/**
 * Arden.AS — configuração (não sensível) da conexão Anthropic (ARDEN-BE-008.1).
 *
 * Base URL é FIXA na oficial no primeiro slice — sem override, sem proxy, sem
 * endpoint/domínio/header customizado. Só campos operacionais não sensíveis.
 */

import { z } from 'zod';

export const anthropicConnectionConfiguration = z.object({
  /** Somente o domínio oficial. Override arbitrário é proibido (sem SSRF/proxy). */
  baseUrlMode: z.literal('OFFICIAL'),
  timeoutMs: z.number().int().positive().max(600_000),
  maximumRetries: z.number().int().min(0).max(5),
  regionPolicy: z.string().max(64).nullable().optional(),
});
export type AnthropicConnectionConfiguration = z.infer<typeof anthropicConnectionConfiguration>;

/** Default seguro (timeout 10min alinhado ao SDK; retries controlados pelo adapter). */
export const ANTHROPIC_CONNECTION_DEFAULT: AnthropicConnectionConfiguration = {
  baseUrlMode: 'OFFICIAL',
  timeoutMs: 600_000,
  maximumRetries: 2,
  regionPolicy: null,
};
