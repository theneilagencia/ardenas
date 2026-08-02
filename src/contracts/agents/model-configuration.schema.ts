/**
 * Arden.AS — API v1 · configuração de modelo (ARDEN-BE-007.1).
 *
 * Tenant-scoped. Aponta para um provider + modelId + (futuro) credencial no cofre.
 * `modelId` e provider NÃO vêm livres do request de execução — são fixados aqui. A
 * RESPOSTA nunca inclui credencial. `REVOKED` é terminal. Parâmetros têm limites
 * contratuais. Espelha o padrão `OrganizationConnection` (status + revision).
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import {
  modelConfigurationId,
  organizationId,
  connectionId,
  userId,
} from '../common/identifiers';
import {
  modelProviderKey,
  modelProviderVersion,
  modelId,
  modelConfigurationStatus,
} from './agent-keys';

/** Parâmetros de geração, com limites contratuais. */
export const modelParameters = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maximumOutputTokens: z.number().int().positive().max(200_000),
  stopSequences: z.array(z.string().min(1).max(120)).max(8).optional(),
});
export type ModelParameters = z.infer<typeof modelParameters>;

/** Entidade (resposta) — nunca inclui credencial/segredo. */
export const modelConfiguration = z.object({
  id: modelConfigurationId,
  organizationId,
  providerKey: modelProviderKey,
  providerVersion: modelProviderVersion,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  modelId,
  /** Referência à conexão que guarda a credencial no cofre (BE-006.4). Nunca o segredo. */
  credentialConnectionId: connectionId.nullable(),
  parameters: modelParameters,
  status: modelConfigurationStatus,
  createdByUserId: userId,
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type ModelConfiguration = z.infer<typeof modelConfiguration>;

// ── Requests (tenant no path; sem organizationId no body) ───────────────────────
export const createModelConfigurationRequest = z.object({
  providerKey: modelProviderKey,
  providerVersion: modelProviderVersion,
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  modelId,
  credentialConnectionId: connectionId.optional(),
  parameters: modelParameters,
});
export type CreateModelConfigurationRequest = z.infer<typeof createModelConfigurationRequest>;

/** PATCH só edita metadados/parâmetros/credencial — NUNCA status (status via comando). */
export const updateModelConfigurationRequest = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  modelId: modelId.optional(),
  credentialConnectionId: connectionId.nullable().optional(),
  parameters: modelParameters.optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateModelConfigurationRequest = z.infer<typeof updateModelConfigurationRequest>;

/** Comando de estado (activate/suspend/revoke). Concorrência via expectedRevision. */
export const modelConfigurationCommandRequest = z.object({
  expectedRevision: z.number().int().min(0),
  reason: z.string().max(400).optional(),
});
export type ModelConfigurationCommandRequest = z.infer<typeof modelConfigurationCommandRequest>;

export const listModelConfigurationsQuery = z.object({
  providerKey: modelProviderKey.optional(),
  status: modelConfigurationStatus.optional(),
  modelId: z.string().max(200).optional(),
  search: z.string().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListModelConfigurationsQuery = z.infer<typeof listModelConfigurationsQuery>;
