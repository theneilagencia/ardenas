/**
 * Arden.AS — API v1 · aprovações (schemas) (ARDEN-BE-004).
 *
 * Fluxos, etapas, solicitações, decisões e delegações. O backend determina o
 * fluxo, os aprovadores elegíveis, os prazos e os requisitos — o cliente apenas
 * solicita a ação. Decisões são imutáveis. Tenant sempre no path.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import {
  approvalFlowId,
  approvalFlowStepId,
  approvalRequestId,
  approvalDecisionId,
  approvalDelegationId,
  operationId,
  operationVersionId,
  organizationId,
  userId,
  correlationId,
} from '../common/identifiers';

/** Taxonomia ESTÁVEL de ações (ARDEN-BE-004 §14). Sem texto livre. */
export const actionKey = z.enum([
  'data.read',
  'data.write',
  'record.create',
  'record.update',
  'record.delete',
  'document.generate',
  'communication.prepare',
  'communication.send',
  'approval.request',
  'financial.prepare',
  'financial.execute',
  'access.grant',
  'access.revoke',
  'integration.invoke',
  'operation.pause',
  'operation.resume',
]);
export type ActionKey = z.infer<typeof actionKey>;

export const approvalFlowStatus = z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']);
export const approvalDecisionMode = z.enum(['ANY_ONE', 'ALL', 'QUORUM']);
export const approvalRequestStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'INVALIDATED']);
export const approvalDecisionType = z.enum(['APPROVE', 'REJECT']);
export const approvalDelegationStatus = z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']);

export const approvalFlowStep = z.object({
  id: approvalFlowStepId,
  organizationId,
  approvalFlowId,
  sequence: z.number().int().min(1),
  name: z.string().min(1).max(200),
  decisionMode: approvalDecisionMode,
  quorum: z.number().int().min(1).nullable(),
  requiredPermission: z.string().nullable(),
  eligibleRoleKey: z.string().nullable(),
  specificApproverUserId: userId.nullable(),
  requesterCannotApprove: z.boolean(),
  justificationRequired: z.boolean(),
  expiresAfterMinutes: z.number().int().min(1).nullable(),
  escalationAfterMinutes: z.number().int().min(1).nullable(),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type ApprovalFlowStep = z.infer<typeof approvalFlowStep>;

export const approvalFlow = z.object({
  id: approvalFlowId,
  organizationId,
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  status: approvalFlowStatus,
  steps: z.array(approvalFlowStep),
  createdBy: userId,
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
  revision: z.number().int().min(0),
});
export type ApprovalFlow = z.infer<typeof approvalFlow>;

export const approvalRequest = z.object({
  id: approvalRequestId,
  organizationId,
  operationId,
  operationVersionId,
  actionKey,
  actionPayloadHash: z.string(),
  actionContext: z.record(z.unknown()),
  requestedBy: userId,
  requestedAt: isoUtcDateTime,
  approvalFlowId,
  currentStepSequence: z.number().int().min(1),
  status: approvalRequestStatus,
  expiresAt: isoUtcDateTime.nullable(),
  decidedAt: isoUtcDateTime.nullable(),
  policySnapshot: z.record(z.unknown()),
  authoritySnapshot: z.record(z.unknown()),
  correlationId,
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  updatedAt: isoUtcDateTime,
});
export type ApprovalRequest = z.infer<typeof approvalRequest>;

export const approvalDecision = z.object({
  id: approvalDecisionId,
  organizationId,
  approvalRequestId,
  approvalFlowStepId,
  decidedBy: userId,
  decision: approvalDecisionType,
  justification: z.string().max(2000).nullable(),
  decidedAt: isoUtcDateTime,
  correlationId,
});
export type ApprovalDecision = z.infer<typeof approvalDecision>;

export const approvalDelegation = z.object({
  id: approvalDelegationId,
  organizationId,
  delegatorUserId: userId,
  delegateUserId: userId,
  validFrom: isoUtcDateTime,
  validUntil: isoUtcDateTime,
  scope: z.record(z.unknown()),
  status: approvalDelegationStatus,
  createdBy: userId,
  createdAt: isoUtcDateTime,
  revokedAt: isoUtcDateTime.nullable(),
});
export type ApprovalDelegation = z.infer<typeof approvalDelegation>;

// ── Requests ──────────────────────────────────────────────────────────────────
export const approvalFlowStepInput = z.object({
  sequence: z.number().int().min(1),
  name: z.string().min(1).max(200),
  decisionMode: approvalDecisionMode.default('ANY_ONE'),
  quorum: z.number().int().min(1).nullable().optional(),
  requiredPermission: z.string().nullable().optional(),
  eligibleRoleKey: z.string().nullable().optional(),
  specificApproverUserId: userId.nullable().optional(),
  requesterCannotApprove: z.boolean().default(true),
  justificationRequired: z.boolean().default(false),
  expiresAfterMinutes: z.number().int().min(1).nullable().optional(),
  escalationAfterMinutes: z.number().int().min(1).nullable().optional(),
});
export type ApprovalFlowStepInput = z.infer<typeof approvalFlowStepInput>;

export const createApprovalFlowRequest = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  steps: z.array(approvalFlowStepInput).min(1),
});
export type CreateApprovalFlowRequest = z.infer<typeof createApprovalFlowRequest>;

export const updateApprovalFlowRequest = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  steps: z.array(approvalFlowStepInput).min(1).optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateApprovalFlowRequest = z.infer<typeof updateApprovalFlowRequest>;

export const approvalFlowTransitionRequest = z.object({
  expectedRevision: z.number().int().min(0),
});
export type ApprovalFlowTransitionRequest = z.infer<typeof approvalFlowTransitionRequest>;

export const createApprovalRequestRequest = z.object({
  operationVersionId,
  actionKey,
  actionPayload: z.unknown(),
  expectedOperationRevision: z.number().int().min(0).optional(),
});
export type CreateApprovalRequestRequest = z.infer<typeof createApprovalRequestRequest>;

export const decideApprovalRequest = z.object({
  justification: z.string().max(2000).optional(),
  expectedRevision: z.number().int().min(0),
});
export type DecideApprovalRequest = z.infer<typeof decideApprovalRequest>;

export const cancelApprovalRequest = z.object({
  reason: z.string().max(400).optional(),
  expectedRevision: z.number().int().min(0),
});
export type CancelApprovalRequest = z.infer<typeof cancelApprovalRequest>;

export const listApprovalRequestsQuery = z.object({
  status: approvalRequestStatus.optional(),
  operationId: z.string().optional(),
  actionKey: actionKey.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListApprovalRequestsQuery = z.infer<typeof listApprovalRequestsQuery>;

export const createApprovalDelegationRequest = z.object({
  delegateUserId: userId,
  validFrom: isoUtcDateTime,
  validUntil: isoUtcDateTime,
  scope: z.record(z.unknown()).optional(),
});
export type CreateApprovalDelegationRequest = z.infer<typeof createApprovalDelegationRequest>;

export const revokeApprovalDelegationRequest = z.object({
  reason: z.string().max(400).optional(),
});
export type RevokeApprovalDelegationRequest = z.infer<typeof revokeApprovalDelegationRequest>;
