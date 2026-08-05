/**
 * Arden.AS — API v1 · conexões de organização (ARDEN-BE-006).
 *
 * A conexão é tenant-scoped. A RESPOSTA pública carrega apenas metadados seguros:
 * NUNCA plaintext, ciphertext, encryptedDataKey, nonce, authTag, master key ou
 * headers sensíveis. `configuration` é sempre não sensível (segredos vão para
 * ConnectionCredentialVersion). `organizationId` NUNCA aparece em request body.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import {
  connectionId,
  credentialVersionId,
  connectorDefinitionId,
  organizationId,
  userId,
} from '../common/identifiers';
import {
  connectorKey,
  connectorVersion,
  connectionStatus,
  connectionTestStatus,
} from './connector-keys';
import { connectorNetworkPolicy } from './network-policy.schema';

/** Configuração não sensível da conexão (nunca guarda segredo). */
export const connectionConfiguration = z.record(z.unknown());

/** Entidade de conexão (resposta) — somente metadados seguros. */
export const connection = z.object({
  id: connectionId,
  organizationId,
  connectorDefinitionId,
  connectorKey,
  connectorVersion,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  status: connectionStatus,
  configuration: connectionConfiguration,
  networkPolicy: connectorNetworkPolicy,
  currentCredentialVersionId: credentialVersionId.nullable(),
  lastTestedAt: isoUtcDateTime.nullable(),
  lastTestStatus: connectionTestStatus,
  lastErrorCode: z.string().nullable(),
  lastErrorSummary: z.string().nullable(),
  createdByUserId: userId,
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type Connection = z.infer<typeof connection>;

// ── Requests (tenant no path; sem organizationId no body) ───────────────────────
export const createConnectionRequest = z.object({
  connectorKey,
  connectorVersion,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  configuration: connectionConfiguration.optional(),
  networkPolicy: connectorNetworkPolicy.optional(),
});
export type CreateConnectionRequest = z.infer<typeof createConnectionRequest>;

/** PATCH só altera metadados/config/policy — NUNCA status (status via comando). */
export const updateConnectionRequest = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  configuration: connectionConfiguration.optional(),
  networkPolicy: connectorNetworkPolicy.optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateConnectionRequest = z.infer<typeof updateConnectionRequest>;

/** Teste de conexão (operação segura declarada pelo conector). */
export const testConnectionRequest = z.object({
  note: z.string().max(200).optional(),
});
export type TestConnectionRequest = z.infer<typeof testConnectionRequest>;

/** Resultado do teste — sanitizado; NUNCA devolve segredo. */
export const testConnectionResult = z.object({
  status: connectionTestStatus,
  checkedAt: isoUtcDateTime,
  latencyMs: z.number().int().min(0).nullable(),
  credentialFingerprint: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorSummary: z.string().nullable(),
});
export type TestConnectionResult = z.infer<typeof testConnectionResult>;

/** Comando de mudança de estado (activate/suspend/reactivate/revoke). */
export const connectionCommandRequest = z.object({
  expectedRevision: z.number().int().min(0),
  reason: z.string().max(400).optional(),
});
export type ConnectionCommandRequest = z.infer<typeof connectionCommandRequest>;

/**
 * Status de verificação COM O PROVIDER REAL (ARDEN-BE-008.2 §17). Nesta fase o Arden
 * NUNCA contata o provider — validação é sempre local. Por isso o único valor produzido
 * é `NOT_VERIFIED_WITH_PROVIDER`; `VERIFIED_WITH_PROVIDER` fica reservado para 008.3+.
 */
export const providerVerificationStatus = z.enum([
  'NOT_VERIFIED_WITH_PROVIDER',
  'VERIFIED_WITH_PROVIDER',
]);
export type ProviderVerificationStatus = z.infer<typeof providerVerificationStatus>;

/** Requisição de VALIDAÇÃO LOCAL de configuração — nunca contata a rede/o provider. */
export const validateConnectionConfigurationRequest = z.object({
  note: z.string().max(200).optional(),
});
export type ValidateConnectionConfigurationRequest = z.infer<typeof validateConnectionConfigurationRequest>;

/**
 * Resultado da validação LOCAL (§17): schema de configuração válido, presença e
 * decifrabilidade da credencial no cofre, compatibilidade provider/conector — SEM
 * chamada ao provider. `providerVerificationStatus` é sempre `NOT_VERIFIED_WITH_PROVIDER`.
 * Nunca devolve segredo (somente fingerprint sanitizado).
 */
export const connectionConfigurationValidationResult = z.object({
  connectionId,
  configurationValid: z.boolean(),
  credentialPresent: z.boolean(),
  credentialDecryptable: z.boolean(),
  providerCompatible: z.boolean(),
  providerVerificationStatus,
  credentialFingerprint: z.string().nullable(),
  issues: z.array(z.string().max(200)).max(20),
  validatedAt: isoUtcDateTime,
});
export type ConnectionConfigurationValidationResult = z.infer<typeof connectionConfigurationValidationResult>;

export const listConnectionsQuery = z.object({
  connectorKey: connectorKey.optional(),
  status: connectionStatus.optional(),
  search: z.string().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListConnectionsQuery = z.infer<typeof listConnectionsQuery>;
