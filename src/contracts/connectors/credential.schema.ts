/**
 * Arden.AS — API v1 · credenciais de conexão (ARDEN-BE-006).
 *
 * REGRA CENTRAL: o REQUEST pode conter o valor sensível (só na criação/rotação, via
 * TLS); a RESPONSE NUNCA devolve o segredo — apenas metadados (status, fingerprint,
 * versão, datas). Schemas de request e response são DISTINTOS: o schema sensível
 * jamais é reutilizado como resposta.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import { connectionId, credentialVersionId, organizationId, userId } from '../common/identifiers';
import { credentialStatus } from './connector-keys';

/**
 * Payload sensível da credencial (write-only). Estrutura livre validada, na fase
 * futura, contra o `credentialSchema` do conector. Marcado como write-only no
 * OpenAPI; jamais ecoado em resposta.
 */
export const credentialSecretPayload = z.record(z.unknown());
export type CredentialSecretPayload = z.infer<typeof credentialSecretPayload>;

/** Metadados NÃO sensíveis anexáveis à versão de credencial (sem segredo). */
export const credentialMetadata = z.record(z.unknown());

// ── Requests (contêm o segredo — SÓ entrada) ────────────────────────────────────
export const createConnectionCredentialRequest = z.object({
  /** Valor sensível (write-only). Nunca retornado. */
  secret: credentialSecretPayload,
  metadata: credentialMetadata.optional(),
});
export type CreateConnectionCredentialRequest = z.infer<typeof createConnectionCredentialRequest>;

export const rotateConnectionCredentialRequest = z.object({
  secret: credentialSecretPayload,
  metadata: credentialMetadata.optional(),
});
export type RotateConnectionCredentialRequest = z.infer<typeof rotateConnectionCredentialRequest>;

// ── Response (SÓ metadados — nunca o segredo nem detalhes criptográficos) ────────
export const credentialMetadataResponseItem = z.object({
  id: credentialVersionId,
  organizationId,
  connectionId,
  versionNumber: z.number().int().min(1),
  status: credentialStatus,
  fingerprint: z.string(),
  keyVersion: z.string(),
  createdByUserId: userId,
  createdAt: isoUtcDateTime,
  activatedAt: isoUtcDateTime.nullable(),
  supersededAt: isoUtcDateTime.nullable(),
  revokedAt: isoUtcDateTime.nullable(),
});
export type CredentialMetadata = z.infer<typeof credentialMetadataResponseItem>;
