/**
 * Arden.AS — API v1 · políticas de governança (schemas) (ARDEN-BE-004).
 *
 * Políticas versionadas: DRAFT editável, PUBLISHED imutável. A definição é
 * DECLARATIVA (condições + efeito + limites) — NUNCA código/eval. O tenant vem do
 * path (nunca do body).
 */

import { z } from 'zod';
import { isoUtcDateTime, money } from '../common/timestamps';
import {
  policyId,
  policyVersionId,
  policyBindingId,
  approvalFlowId,
  operationId,
  operationVersionId,
  organizationId,
  userId,
} from '../common/identifiers';

export const policyCategory = z.enum(['AUTHORITY', 'APPROVAL', 'FINANCIAL', 'SECURITY', 'OPERATIONAL']);
export const policyStatus = z.enum(['DRAFT', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED']);
export const policyVersionStatus = z.enum(['DRAFT', 'PUBLISHED', 'SUPERSEDED']);
export const policyEffect = z.enum(['ALLOW', 'DENY', 'REQUIRE_APPROVAL']);
export const policyConditionOperator = z.enum([
  'EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN',
  'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'EXISTS',
]);
export type PolicyEffect = z.infer<typeof policyEffect>;
export type PolicyConditionOperator = z.infer<typeof policyConditionOperator>;

/** Condição declarativa (sem expressões arbitrárias). */
export const policyCondition = z.object({
  field: z.string().min(1).max(200),
  operator: policyConditionOperator,
  value: z.unknown().optional(),
});
export type PolicyCondition = z.infer<typeof policyCondition>;

export const policyFrequency = z.object({
  count: z.number().int().min(1),
  period: z.enum(['MINUTE', 'HOUR', 'DAY', 'MONTH']),
});

export const policyDefinition = z.object({
  appliesWhen: z.array(policyCondition),
  effect: policyEffect,
  approvalFlowId: z.string().optional(),
  limits: z
    .object({
      financial: money.optional(),
      quantity: z.number().int().min(0).optional(),
      frequency: policyFrequency.optional(),
    })
    .optional(),
  validFrom: isoUtcDateTime.optional(),
  validUntil: isoUtcDateTime.optional(),
});
export type PolicyDefinition = z.infer<typeof policyDefinition>;

export const policy = z.object({
  id: policyId,
  organizationId,
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  category: policyCategory,
  status: policyStatus,
  currentDraftVersionId: policyVersionId.nullable(),
  publishedVersionId: policyVersionId.nullable(),
  createdBy: userId,
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
  revision: z.number().int().min(0),
});
export type Policy = z.infer<typeof policy>;

export const policyVersion = z.object({
  id: policyVersionId,
  organizationId,
  policyId,
  versionNumber: z.number().int().min(1),
  status: policyVersionStatus,
  definition: policyDefinition,
  changeSummary: z.string().max(1000).nullable(),
  createdBy: userId,
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
  publishedBy: userId.nullable(),
  publishedAt: isoUtcDateTime.nullable(),
  revision: z.number().int().min(0),
});
export type PolicyVersion = z.infer<typeof policyVersion>;

export const policyBindingScope = z.enum(['OPERATION', 'VERSION']);
export const operationPolicyBinding = z.object({
  id: policyBindingId,
  organizationId,
  operationId,
  operationVersionId: operationVersionId.nullable(),
  policyId,
  policyVersionId,
  scope: policyBindingScope,
  priority: z.number().int(),
  enabled: z.boolean(),
  createdBy: userId,
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
  revision: z.number().int().min(0),
});
export type OperationPolicyBinding = z.infer<typeof operationPolicyBinding>;

// ── Requests ──────────────────────────────────────────────────────────────────
export const createPolicyRequest = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  category: policyCategory,
});
export type CreatePolicyRequest = z.infer<typeof createPolicyRequest>;

export const updatePolicyRequest = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdatePolicyRequest = z.infer<typeof updatePolicyRequest>;

export const createPolicyVersionRequest = z.object({
  basedOnVersionId: z.string().optional(),
  changeSummary: z.string().max(1000).optional(),
});
export type CreatePolicyVersionRequest = z.infer<typeof createPolicyVersionRequest>;

export const updatePolicyVersionRequest = z.object({
  definition: policyDefinition.optional(),
  changeSummary: z.string().max(1000).optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdatePolicyVersionRequest = z.infer<typeof updatePolicyVersionRequest>;

export const publishPolicyVersionRequest = z.object({
  expectedRevision: z.number().int().min(0),
  changeSummary: z.string().min(1).max(1000),
});
export type PublishPolicyVersionRequest = z.infer<typeof publishPolicyVersionRequest>;

export const policyTransitionRequest = z.object({
  expectedRevision: z.number().int().min(0),
  reason: z.string().max(400).optional(),
});
export type PolicyTransitionRequest = z.infer<typeof policyTransitionRequest>;

export const createPolicyBindingRequest = z.object({
  policyId,
  policyVersionId,
  scope: policyBindingScope.default('OPERATION'),
  operationVersionId: operationVersionId.nullable().optional(),
  priority: z.number().int().min(0).max(100000).default(100),
  enabled: z.boolean().default(true),
});
export type CreatePolicyBindingRequest = z.infer<typeof createPolicyBindingRequest>;

export const updatePolicyBindingRequest = z.object({
  priority: z.number().int().min(0).max(100000).optional(),
  enabled: z.boolean().optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdatePolicyBindingRequest = z.infer<typeof updatePolicyBindingRequest>;

// Referência cruzada usada pela definição (aprovação): mantém o id do fluxo.
export type ReferencedApprovalFlowId = z.infer<typeof approvalFlowId>;
