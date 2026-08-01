/**
 * Arden.AS — API v1 · enforcement de autoridade (schemas) (ARDEN-BE-004).
 *
 * Avaliação determinística de ações (ALLOWED | DENIED | APPROVAL_REQUIRED),
 * autorização de ação emitida após aprovação e validação da autorização (sem
 * executar a ação — execução é ARDEN-BE-005).
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import {
  actionAuthorizationId,
  approvalRequestId,
  operationId,
  operationVersionId,
  organizationId,
  policyId,
  policyVersionId,
  userId,
  correlationId,
} from '../common/identifiers';
import { actionKey, approvalRequest } from '../approvals/approvals.schemas';

export const actionAuthorizationStatus = z.enum(['ACTIVE', 'USED', 'EXPIRED', 'REVOKED', 'INVALIDATED']);

export const actionAuthorization = z.object({
  id: actionAuthorizationId,
  organizationId,
  approvalRequestId: approvalRequestId.nullable(),
  operationId,
  operationVersionId,
  actionKey,
  actionPayloadHash: z.string(),
  grantedToUserId: userId.nullable(),
  status: actionAuthorizationStatus,
  validFrom: isoUtcDateTime,
  validUntil: isoUtcDateTime.nullable(),
  grantedAt: isoUtcDateTime,
  usedAt: isoUtcDateTime.nullable(),
  authoritySnapshot: z.record(z.unknown()),
  policySnapshot: z.record(z.unknown()),
  correlationId,
  revision: z.number().int().min(0),
});
export type ActionAuthorization = z.infer<typeof actionAuthorization>;

export const actionDecision = z.enum(['ALLOWED', 'DENIED', 'APPROVAL_REQUIRED']);

export const applicablePolicyRef = z.object({
  policyId,
  policyVersionId,
  effect: z.string(),
  priority: z.number().int(),
});

export const actionEvaluationResult = z.object({
  decision: actionDecision,
  reasonCodes: z.array(z.string()),
  applicablePolicies: z.array(applicablePolicyRef),
  approvalRequest: approvalRequest.optional(),
  authorization: actionAuthorization.optional(),
});
export type ActionEvaluationResult = z.infer<typeof actionEvaluationResult>;

/** Resultado da decisão de aprovação: a solicitação + a autorização emitida (se houver). */
export const approvalDecisionResult = z.object({
  request: approvalRequest,
  authorization: actionAuthorization.nullable(),
});
export type ApprovalDecisionResult = z.infer<typeof approvalDecisionResult>;

export const actionValidationResult = z.object({
  valid: z.boolean(),
  reasonCodes: z.array(z.string()),
  authorization: actionAuthorization.optional(),
});
export type ActionValidationResult = z.infer<typeof actionValidationResult>;

// ── Requests ──────────────────────────────────────────────────────────────────
export const evaluateActionRequest = z.object({
  operationVersionId,
  actionKey,
  actionPayload: z.unknown(),
  expectedOperationRevision: z.number().int().min(0).optional(),
  existingAuthorizationId: z.string().optional(),
});
export type EvaluateActionRequest = z.infer<typeof evaluateActionRequest>;

export const validateAuthorizationRequest = z.object({
  authorizationId: z.string().optional(),
  operationId,
  operationVersionId,
  actionKey,
  actionPayload: z.unknown(),
  grantedToUserId: userId.optional(),
});
export type ValidateAuthorizationRequest = z.infer<typeof validateAuthorizationRequest>;
