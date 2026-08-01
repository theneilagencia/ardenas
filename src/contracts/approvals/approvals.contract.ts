/**
 * Arden.AS — API v1 · aprovações (endpoints + schemas) (ARDEN-BE-004).
 */

import type { EndpointContract } from '../endpoint';
import { apiResponse, paginatedResponse } from '../common/pagination';
import {
  approvalFlow,
  approvalFlowStep,
  approvalRequest,
  approvalDecision,
  approvalDelegation,
  createApprovalFlowRequest,
  updateApprovalFlowRequest,
  approvalFlowTransitionRequest,
  createApprovalRequestRequest,
  decideApprovalRequest,
  cancelApprovalRequest,
  listApprovalRequestsQuery,
  createApprovalDelegationRequest,
  revokeApprovalDelegationRequest,
} from './approvals.schemas';

const ORG = '/api/v1/organizations/{organizationId}';

export const approvalsSchemas = {
  ApprovalFlow: approvalFlow,
  ApprovalFlowStep: approvalFlowStep,
  ApprovalRequest: approvalRequest,
  ApprovalDecision: approvalDecision,
  ApprovalDelegation: approvalDelegation,
  ApprovalFlowResponse: apiResponse(approvalFlow),
  ApprovalFlowListResponse: paginatedResponse(approvalFlow),
  ApprovalRequestResponse: apiResponse(approvalRequest),
  ApprovalRequestListResponse: paginatedResponse(approvalRequest),
  ApprovalDelegationResponse: apiResponse(approvalDelegation),
  ApprovalDelegationListResponse: paginatedResponse(approvalDelegation),
  CreateApprovalFlowRequest: createApprovalFlowRequest,
  UpdateApprovalFlowRequest: updateApprovalFlowRequest,
  ApprovalFlowTransitionRequest: approvalFlowTransitionRequest,
  CreateApprovalRequestRequest: createApprovalRequestRequest,
  DecideApprovalRequest: decideApprovalRequest,
  CancelApprovalRequest: cancelApprovalRequest,
  ListApprovalRequestsQuery: listApprovalRequestsQuery,
  CreateApprovalDelegationRequest: createApprovalDelegationRequest,
  RevokeApprovalDelegationRequest: revokeApprovalDelegationRequest,
} as const;

export const approvalsEndpoints: EndpointContract[] = [
  // Fluxos
  {
    id: 'approvalFlows.list', method: 'GET', path: `${ORG}/approval-flows`, summary: 'Lista fluxos de aprovação', tag: 'Approvals',
    permission: 'approval.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId'], successStatus: 200, responseSchema: 'ApprovalFlowListResponse',
  },
  {
    id: 'approvalFlows.create', method: 'POST', path: `${ORG}/approval-flows`, summary: 'Cria fluxo de aprovação', tag: 'Approvals',
    permission: 'policy.manage', idempotent: true, optimisticConcurrency: false,
    requestSchema: 'CreateApprovalFlowRequest', pathParams: ['organizationId'], successStatus: 201, responseSchema: 'ApprovalFlowResponse',
  },
  {
    id: 'approvalFlows.get', method: 'GET', path: `${ORG}/approval-flows/{flowId}`, summary: 'Consulta fluxo', tag: 'Approvals',
    permission: 'approval.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'flowId'], successStatus: 200, responseSchema: 'ApprovalFlowResponse',
  },
  {
    id: 'approvalFlows.update', method: 'PATCH', path: `${ORG}/approval-flows/{flowId}`, summary: 'Edita fluxo', tag: 'Approvals',
    permission: 'policy.manage', idempotent: false, optimisticConcurrency: true,
    requestSchema: 'UpdateApprovalFlowRequest', pathParams: ['organizationId', 'flowId'], successStatus: 200, responseSchema: 'ApprovalFlowResponse',
  },
  {
    id: 'approvalFlows.activate', method: 'POST', path: `${ORG}/approval-flows/{flowId}/activate`, summary: 'Ativa fluxo', tag: 'Approvals',
    permission: 'policy.manage', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'ApprovalFlowTransitionRequest', pathParams: ['organizationId', 'flowId'], successStatus: 200, responseSchema: 'ApprovalFlowResponse',
  },
  {
    id: 'approvalFlows.suspend', method: 'POST', path: `${ORG}/approval-flows/{flowId}/suspend`, summary: 'Suspende fluxo', tag: 'Approvals',
    permission: 'policy.manage', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'ApprovalFlowTransitionRequest', pathParams: ['organizationId', 'flowId'], successStatus: 200, responseSchema: 'ApprovalFlowResponse',
  },
  // Solicitações
  {
    id: 'approvalRequests.list', method: 'GET', path: `${ORG}/approval-requests`, summary: 'Lista solicitações', tag: 'Approvals',
    permission: 'approval.view', idempotent: false, optimisticConcurrency: false,
    querySchema: 'ListApprovalRequestsQuery', pathParams: ['organizationId'], successStatus: 200, responseSchema: 'ApprovalRequestListResponse',
  },
  {
    id: 'approvalRequests.create', method: 'POST', path: `${ORG}/operations/{operationId}/approval-requests`, summary: 'Solicita aprovação de ação', tag: 'Approvals',
    permission: 'approval.request', idempotent: true, optimisticConcurrency: false,
    requestSchema: 'CreateApprovalRequestRequest', pathParams: ['organizationId', 'operationId'], successStatus: 201, responseSchema: 'ApprovalRequestResponse',
  },
  {
    id: 'approvalRequests.get', method: 'GET', path: `${ORG}/approval-requests/{requestId}`, summary: 'Consulta solicitação', tag: 'Approvals',
    permission: 'approval.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'requestId'], successStatus: 200, responseSchema: 'ApprovalRequestResponse',
  },
  {
    id: 'approvalRequests.approve', method: 'POST', path: `${ORG}/approval-requests/{requestId}/approve`, summary: 'Aprova solicitação', tag: 'Approvals',
    permission: 'approval.resolve', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'DecideApprovalRequest', pathParams: ['organizationId', 'requestId'], successStatus: 200, responseSchema: 'ApprovalDecisionResponse',
  },
  {
    id: 'approvalRequests.reject', method: 'POST', path: `${ORG}/approval-requests/{requestId}/reject`, summary: 'Rejeita solicitação', tag: 'Approvals',
    permission: 'approval.resolve', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'DecideApprovalRequest', pathParams: ['organizationId', 'requestId'], successStatus: 200, responseSchema: 'ApprovalRequestResponse',
  },
  {
    id: 'approvalRequests.cancel', method: 'POST', path: `${ORG}/approval-requests/{requestId}/cancel`, summary: 'Cancela solicitação', tag: 'Approvals',
    permission: 'approval.cancel', idempotent: false, optimisticConcurrency: true,
    requestSchema: 'CancelApprovalRequest', pathParams: ['organizationId', 'requestId'], successStatus: 200, responseSchema: 'ApprovalRequestResponse',
  },
  // Delegações
  {
    id: 'approvalDelegations.list', method: 'GET', path: `${ORG}/approval-delegations`, summary: 'Lista delegações', tag: 'Approvals',
    permission: 'approval.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId'], successStatus: 200, responseSchema: 'ApprovalDelegationListResponse',
  },
  {
    id: 'approvalDelegations.create', method: 'POST', path: `${ORG}/approval-delegations`, summary: 'Cria delegação', tag: 'Approvals',
    permission: 'approval.delegate', idempotent: true, optimisticConcurrency: false,
    requestSchema: 'CreateApprovalDelegationRequest', pathParams: ['organizationId'], successStatus: 201, responseSchema: 'ApprovalDelegationResponse',
  },
  {
    id: 'approvalDelegations.revoke', method: 'POST', path: `${ORG}/approval-delegations/{delegationId}/revoke`, summary: 'Revoga delegação', tag: 'Approvals',
    permission: 'approval.delegate', idempotent: true, optimisticConcurrency: false,
    requestSchema: 'RevokeApprovalDelegationRequest', pathParams: ['organizationId', 'delegationId'], successStatus: 200, responseSchema: 'ApprovalDelegationResponse',
  },
];

export type ApprovalsSchemas = typeof approvalsSchemas;
