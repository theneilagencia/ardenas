/**
 * Arden.AS — API v1 · identificadores (ARDEN-FE-003).
 *
 * IDs são OPACOS: strings não vazias sem semântica embutida (o cliente não deve
 * derivar informação do formato). Marcas (brands) dão segurança de tipo sem
 * alterar a representação em JSON (continua string).
 */

import { z } from 'zod';

/** Identificador opaco genérico. */
export const opaqueId = z.string().min(1).max(128);
export type OpaqueId = z.infer<typeof opaqueId>;

/** Idempotency-Key: string opaca gerada pelo cliente para comandos críticos. */
export const idempotencyKey = z.string().min(8).max(200);
export type IdempotencyKey = z.infer<typeof idempotencyKey>;

/** Correlation-Id: rastreia uma requisição fim a fim. */
export const correlationId = z.string().min(1).max(200);
export type CorrelationId = z.infer<typeof correlationId>;

// Aliases por entidade. IDs são opacos (strings sem semântica): usamos o mesmo
// schema para todos, mantendo os DTOs ergonômicos e sem brands que atrapalhem a
// interoperabilidade contrato ↔ domínio.
export const userId = opaqueId;
export type UserId = z.infer<typeof userId>;

export const organizationId = opaqueId;
export type OrganizationId = z.infer<typeof organizationId>;

export const membershipId = opaqueId;
export type MembershipId = z.infer<typeof membershipId>;

export const operationId = opaqueId;
export type OperationId = z.infer<typeof operationId>;

export const operationVersionId = opaqueId;
export type OperationVersionId = z.infer<typeof operationVersionId>;

export const auditEventId = opaqueId;
export type AuditEventId = z.infer<typeof auditEventId>;

// Governança, aprovações e autorizações (ARDEN-BE-004).
export const policyId = opaqueId;
export type PolicyId = z.infer<typeof policyId>;

export const policyVersionId = opaqueId;
export type PolicyVersionId = z.infer<typeof policyVersionId>;

export const policyBindingId = opaqueId;
export type PolicyBindingId = z.infer<typeof policyBindingId>;

export const approvalFlowId = opaqueId;
export type ApprovalFlowId = z.infer<typeof approvalFlowId>;

export const approvalFlowStepId = opaqueId;
export type ApprovalFlowStepId = z.infer<typeof approvalFlowStepId>;

export const approvalRequestId = opaqueId;
export type ApprovalRequestId = z.infer<typeof approvalRequestId>;

export const approvalDecisionId = opaqueId;
export type ApprovalDecisionId = z.infer<typeof approvalDecisionId>;

export const approvalDelegationId = opaqueId;
export type ApprovalDelegationId = z.infer<typeof approvalDelegationId>;

export const actionAuthorizationId = opaqueId;
export type ActionAuthorizationId = z.infer<typeof actionAuthorizationId>;
