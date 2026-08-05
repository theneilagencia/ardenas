/**
 * Arden.AS API — serialização DB→contrato de aprovações (ARDEN-BE-004).
 * Valida a saída contra o schema do contrato (nada vaza sem forma).
 */

import type {
  ApprovalFlow as DbFlow,
  ApprovalFlowStep as DbStep,
  ApprovalRequest as DbRequest,
  ApprovalDecision as DbDecision,
  ApprovalDelegation as DbDelegation,
} from '@prisma/client';
import {
  approvalFlow as flowSchema,
  approvalFlowStep as stepSchema,
  approvalRequest as requestSchema,
  approvalDecision as decisionSchema,
  approvalDelegation as delegationSchema,
  type ApprovalFlow,
  type ApprovalFlowStep,
  type ApprovalRequest,
  type ApprovalDecision,
  type ApprovalDelegation,
} from '@arden/contracts';

export function toStepContract(row: DbStep): ApprovalFlowStep {
  return stepSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    approvalFlowId: row.approvalFlowId,
    sequence: row.sequence,
    name: row.name,
    decisionMode: row.decisionMode,
    quorum: row.quorum ?? null,
    requiredPermission: row.requiredPermission ?? null,
    eligibleRoleKey: row.eligibleRoleKey ?? null,
    specificApproverUserId: row.specificApproverUserId ?? null,
    requesterCannotApprove: row.requesterCannotApprove,
    justificationRequired: row.justificationRequired,
    expiresAfterMinutes: row.expiresAfterMinutes ?? null,
    escalationAfterMinutes: row.escalationAfterMinutes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toFlowContract(row: DbFlow & { steps: DbStep[] }): ApprovalFlow {
  return flowSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    status: row.status,
    steps: [...row.steps].sort((a, b) => a.sequence - b.sequence).map(toStepContract),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revision: row.revision,
  });
}

export function toRequestContract(row: DbRequest): ApprovalRequest {
  return requestSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    operationId: row.operationId,
    operationVersionId: row.operationVersionId,
    actionKey: row.actionKey,
    actionPayloadHash: row.actionPayloadHash,
    actionContext: row.actionContext,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    approvalFlowId: row.approvalFlowId,
    currentStepSequence: row.currentStepSequence,
    status: row.status,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    policySnapshot: row.policySnapshot,
    authoritySnapshot: row.authoritySnapshot,
    correlationId: row.correlationId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function toDecisionContract(row: DbDecision): ApprovalDecision {
  return decisionSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    approvalRequestId: row.approvalRequestId,
    approvalFlowStepId: row.approvalFlowStepId,
    decidedBy: row.decidedBy,
    decision: row.decision,
    justification: row.justification ?? null,
    decidedAt: row.decidedAt.toISOString(),
    correlationId: row.correlationId,
  });
}

export function toDelegationContract(row: DbDelegation): ApprovalDelegation {
  return delegationSchema.parse({
    id: row.id,
    organizationId: row.organizationId,
    delegatorUserId: row.delegatorUserId,
    delegateUserId: row.delegateUserId,
    validFrom: row.validFrom.toISOString(),
    validUntil: row.validUntil.toISOString(),
    scope: row.scope,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  });
}
