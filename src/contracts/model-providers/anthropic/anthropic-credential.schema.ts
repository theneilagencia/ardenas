/**
 * Arden.AS — contrato de credencial do Anthropic (ARDEN-BE-008.1).
 *
 * SOMENTE schema/contrato — NADA é persistido nesta fase. Credencial inicial:
 * API key (tenant-managed). WRITE-ONLY: nunca retornada, logada, colocada em
 * ModelConfiguration.parameters, prompt, job, evidence ou audit. Armazenamento real
 * (cofre BE-006) fica para 008.2. Aqui não há key real (canário de teste apenas).
 */

import { z } from 'zod';

/** Entrada sensível (WRITE-ONLY). Só trafega no request de escrita; nunca ecoada. */
export const anthropicCredentialInput = z.object({
  apiKey: z.string().min(1).max(512),
});
export type AnthropicCredentialInput = z.infer<typeof anthropicCredentialInput>;

/** Metadados NÃO sensíveis (o que a API pode devolver — nunca a key). */
export const anthropicCredentialMetadata = z.object({
  /** Fingerprint segura (hash), nunca a key. */
  fingerprint: z.string().max(128),
  status: z.enum(['ACTIVE', 'REVOKED']),
  createdAt: z.string(),
});
export type AnthropicCredentialMetadata = z.infer<typeof anthropicCredentialMetadata>;
