/**
 * Arden.AS — compatibilidade do cliente v1 com governança/aprovações (ARDEN-BE-004).
 * Prova, em runtime, que os tipos do contrato bastam para tipar um cliente das
 * rotas de políticas, fluxos, solicitações, delegações e enforcement. Sem servidor.
 */

import { describe, expect, it } from 'vitest';
import type { ArdenApiV1Client } from './api-v1-client';
import type {
  Policy,
  ApprovalFlow,
  ApprovalRequest,
  ActionEvaluationResult,
  ApprovalDecisionResult,
  ActionValidationResult,
} from '@/contracts';

const policy: Policy = {
  id: 'pol_1', organizationId: 'org_1', key: 'fin', name: 'Financeira', description: null,
  category: 'APPROVAL', status: 'PUBLISHED', currentDraftVersionId: null, publishedVersionId: 'pv_1',
  createdBy: 'user_1', createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', revision: 2,
};

const flow: ApprovalFlow = {
  id: 'flow_1', organizationId: 'org_1', key: 'f', name: 'Fluxo', description: null, status: 'ACTIVE',
  steps: [{ id: 's1', organizationId: 'org_1', approvalFlowId: 'flow_1', sequence: 1, name: 'E1', decisionMode: 'ANY_ONE', quorum: null, requiredPermission: null, eligibleRoleKey: 'approver', specificApproverUserId: null, requesterCannotApprove: true, justificationRequired: false, expiresAfterMinutes: null, escalationAfterMinutes: null, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' }],
  createdBy: 'user_1', createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', revision: 1,
};

const req: ApprovalRequest = {
  id: 'req_1', organizationId: 'org_1', operationId: 'op_1', operationVersionId: 'v_1', actionKey: 'communication.send',
  actionPayloadHash: 'h', actionContext: {}, requestedBy: 'user_1', requestedAt: '2026-07-01T00:00:00.000Z',
  approvalFlowId: 'flow_1', currentStepSequence: 1, status: 'PENDING', expiresAt: null, decidedAt: null,
  policySnapshot: {}, authoritySnapshot: {}, correlationId: 'c', revision: 1, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
};

const evaluation: ActionEvaluationResult = { decision: 'APPROVAL_REQUIRED', reasonCodes: ['GRADIENT_EXECUTE_WITH_APPROVAL'], applicablePolicies: [] };
const decision: ApprovalDecisionResult = { request: { ...req, status: 'APPROVED' }, authorization: null };
const validation: ActionValidationResult = { valid: true, reasonCodes: ['ALLOWED_DIRECTLY'] };

function fakeClient(): ArdenApiV1Client {
  const client = {
    listPolicies: async () => ({ data: [policy], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } }),
    getPolicy: async () => policy,
    listApprovalFlows: async () => ({ data: [flow], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } }),
    getApprovalRequest: async () => req,
    evaluateAction: async () => evaluation,
    approveApprovalRequest: async () => decision,
    validateAuthorization: async () => validation,
  } as Partial<ArdenApiV1Client>;
  return client as ArdenApiV1Client;
}

describe('cliente v1 ↔ governança e aprovações', () => {
  it('tipa listagem de políticas e fluxos', async () => {
    const c = fakeClient();
    expect((await c.listPolicies('org_1', {})).data[0].status).toBe('PUBLISHED');
    expect((await c.listApprovalFlows('org_1', {})).data[0].steps[0].decisionMode).toBe('ANY_ONE');
  });

  it('tipa avaliação de ação e decisão de aprovação', async () => {
    const c = fakeClient();
    expect((await c.evaluateAction('org_1', 'op_1', { operationVersionId: 'v', actionKey: 'communication.send', actionPayload: {} })).decision).toBe('APPROVAL_REQUIRED');
    const d = await c.approveApprovalRequest('org_1', 'req_1', { expectedRevision: 1 });
    expect(d.request.status).toBe('APPROVED');
    expect(d.authorization).toBeNull();
  });

  it('tipa validação de autorização', async () => {
    const c = fakeClient();
    expect((await c.validateAuthorization('org_1', { operationId: 'op_1', operationVersionId: 'v', actionKey: 'communication.send', actionPayload: {} })).valid).toBe(true);
  });
});
