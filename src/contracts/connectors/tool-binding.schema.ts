/**
 * Arden.AS — API v1 · vínculos de ferramenta (ARDEN-BE-006).
 *
 * OrganizationToolBinding: org → ferramenta sobre uma conexão. OperationToolBinding:
 * ferramenta → operação/versão, com alias e mapeamento declarativo. `allowedActionKeys`
 * usa o enum de action keys externas (nunca texto livre) e NÃO referencia executor
 * ou classe. Mapeamentos são dados declarativos (sem código).
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import {
  organizationToolBindingId,
  operationToolBindingId,
  connectionId,
  connectorToolDefinitionId,
  operationId,
  operationVersionId,
  organizationId,
  userId,
} from '../common/identifiers';
import {
  connectorKey,
  toolKey,
  toolVersion,
  externalActionKey,
} from './connector-keys';

const overrides = z.record(z.unknown());
/** Mapeamento declarativo (path/rename/const/compose) — dados, nunca código. */
const mapping = z.record(z.unknown());

// ── Organization tool binding ───────────────────────────────────────────────────
export const organizationToolBinding = z.object({
  id: organizationToolBindingId,
  organizationId,
  connectionId,
  connectorToolDefinitionId,
  connectorToolKey: toolKey,
  connectorToolVersion: toolVersion,
  name: z.string().min(1).max(120),
  enabled: z.boolean(),
  configurationOverrides: overrides,
  policyOverrides: overrides,
  createdByUserId: userId,
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type OrganizationToolBinding = z.infer<typeof organizationToolBinding>;

export const createOrganizationToolBindingRequest = z.object({
  connectionId,
  connectorToolKey: toolKey,
  connectorToolVersion: toolVersion,
  name: z.string().min(1).max(120),
  configurationOverrides: overrides.optional(),
  policyOverrides: overrides.optional(),
});
export type CreateOrganizationToolBindingRequest = z.infer<typeof createOrganizationToolBindingRequest>;

export const updateOrganizationToolBindingRequest = z.object({
  name: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  configurationOverrides: overrides.optional(),
  policyOverrides: overrides.optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateOrganizationToolBindingRequest = z.infer<typeof updateOrganizationToolBindingRequest>;

export const listToolBindingsQuery = z.object({
  connectionId: connectionId.optional(),
  enabled: z.coerce.boolean().optional(),
  connectorKey: connectorKey.optional(),
  toolKey: toolKey.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListToolBindingsQuery = z.infer<typeof listToolBindingsQuery>;

// ── Operation tool binding ──────────────────────────────────────────────────────
export const operationToolBinding = z.object({
  id: operationToolBindingId,
  organizationId,
  operationId,
  operationVersionId: operationVersionId.nullable(),
  organizationToolBindingId,
  alias: z.string().min(1).max(60),
  enabled: z.boolean(),
  allowedActionKeys: z.array(externalActionKey).min(1).max(20),
  inputMapping: mapping,
  outputMapping: mapping,
  createdByUserId: userId,
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type OperationToolBinding = z.infer<typeof operationToolBinding>;

export const createOperationToolBindingRequest = z.object({
  organizationToolBindingId,
  alias: z.string().min(1).max(60),
  operationVersionId: operationVersionId.optional(),
  allowedActionKeys: z.array(externalActionKey).min(1).max(20),
  inputMapping: mapping.optional(),
  outputMapping: mapping.optional(),
});
export type CreateOperationToolBindingRequest = z.infer<typeof createOperationToolBindingRequest>;

export const updateOperationToolBindingRequest = z.object({
  alias: z.string().min(1).max(60).optional(),
  enabled: z.boolean().optional(),
  allowedActionKeys: z.array(externalActionKey).min(1).max(20).optional(),
  inputMapping: mapping.optional(),
  outputMapping: mapping.optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateOperationToolBindingRequest = z.infer<typeof updateOperationToolBindingRequest>;
