/**
 * Arden.AS — API v1 · políticas (endpoints + schemas registrados) (ARDEN-BE-004).
 */

import type { EndpointContract } from '../endpoint';
import { apiResponse, paginatedResponse, cursorPageParams } from '../common/pagination';
import {
  policy,
  policyVersion,
  operationPolicyBinding,
  createPolicyRequest,
  updatePolicyRequest,
  createPolicyVersionRequest,
  updatePolicyVersionRequest,
  publishPolicyVersionRequest,
  policyTransitionRequest,
  createPolicyBindingRequest,
  updatePolicyBindingRequest,
} from './policies.schemas';

const ORG = '/api/v1/organizations/{organizationId}';

export const policiesSchemas = {
  Policy: policy,
  PolicyVersion: policyVersion,
  OperationPolicyBinding: operationPolicyBinding,
  PolicyResponse: apiResponse(policy),
  PolicyListResponse: paginatedResponse(policy),
  PolicyVersionResponse: apiResponse(policyVersion),
  OperationPolicyBindingResponse: apiResponse(operationPolicyBinding),
  OperationPolicyBindingListResponse: paginatedResponse(operationPolicyBinding),
  CreatePolicyRequest: createPolicyRequest,
  UpdatePolicyRequest: updatePolicyRequest,
  CreatePolicyVersionRequest: createPolicyVersionRequest,
  UpdatePolicyVersionRequest: updatePolicyVersionRequest,
  PublishPolicyVersionRequest: publishPolicyVersionRequest,
  PolicyTransitionRequest: policyTransitionRequest,
  CreatePolicyBindingRequest: createPolicyBindingRequest,
  UpdatePolicyBindingRequest: updatePolicyBindingRequest,
  PolicyListQuery: cursorPageParams,
} as const;

export const policiesEndpoints: EndpointContract[] = [
  {
    id: 'policies.list', method: 'GET', path: `${ORG}/policies`, summary: 'Lista políticas', tag: 'Policies',
    permission: 'policy.view', idempotent: false, optimisticConcurrency: false,
    querySchema: 'PolicyListQuery', pathParams: ['organizationId'], successStatus: 200, responseSchema: 'PolicyListResponse',
  },
  {
    id: 'policies.create', method: 'POST', path: `${ORG}/policies`, summary: 'Cria política', tag: 'Policies',
    permission: 'policy.create', idempotent: true, optimisticConcurrency: false,
    requestSchema: 'CreatePolicyRequest', pathParams: ['organizationId'], successStatus: 201, responseSchema: 'PolicyResponse',
  },
  {
    id: 'policies.get', method: 'GET', path: `${ORG}/policies/{policyId}`, summary: 'Consulta política', tag: 'Policies',
    permission: 'policy.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'policyId'], successStatus: 200, responseSchema: 'PolicyResponse',
  },
  {
    id: 'policies.update', method: 'PATCH', path: `${ORG}/policies/{policyId}`, summary: 'Edita política', tag: 'Policies',
    permission: 'policy.edit', idempotent: false, optimisticConcurrency: true,
    requestSchema: 'UpdatePolicyRequest', pathParams: ['organizationId', 'policyId'], successStatus: 200, responseSchema: 'PolicyResponse',
  },
  {
    id: 'policyVersions.create', method: 'POST', path: `${ORG}/policies/{policyId}/versions`, summary: 'Cria versão de política', tag: 'Policies',
    permission: 'policy.edit', idempotent: true, optimisticConcurrency: false,
    requestSchema: 'CreatePolicyVersionRequest', pathParams: ['organizationId', 'policyId'], successStatus: 201, responseSchema: 'PolicyVersionResponse',
  },
  {
    id: 'policyVersions.update', method: 'PATCH', path: `${ORG}/policies/{policyId}/versions/{versionId}`, summary: 'Edita rascunho de política', tag: 'Policies',
    permission: 'policy.edit', idempotent: false, optimisticConcurrency: true,
    requestSchema: 'UpdatePolicyVersionRequest', pathParams: ['organizationId', 'policyId', 'versionId'], successStatus: 200, responseSchema: 'PolicyVersionResponse',
  },
  {
    id: 'policyVersions.publish', method: 'POST', path: `${ORG}/policies/{policyId}/versions/{versionId}/publish`, summary: 'Publica versão de política', tag: 'Policies',
    permission: 'policy.publish', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'PublishPolicyVersionRequest', pathParams: ['organizationId', 'policyId', 'versionId'], successStatus: 200, responseSchema: 'PolicyVersionResponse',
  },
  {
    id: 'policies.suspend', method: 'POST', path: `${ORG}/policies/{policyId}/suspend`, summary: 'Suspende política', tag: 'Policies',
    permission: 'policy.suspend', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'PolicyTransitionRequest', pathParams: ['organizationId', 'policyId'], successStatus: 200, responseSchema: 'PolicyResponse',
  },
  {
    id: 'policies.archive', method: 'POST', path: `${ORG}/policies/{policyId}/archive`, summary: 'Arquiva política', tag: 'Policies',
    permission: 'policy.suspend', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'PolicyTransitionRequest', pathParams: ['organizationId', 'policyId'], successStatus: 200, responseSchema: 'PolicyResponse',
  },
  {
    id: 'policyBindings.list', method: 'GET', path: `${ORG}/operations/{operationId}/policy-bindings`, summary: 'Lista vínculos de política', tag: 'Policies',
    permission: 'policy.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'operationId'], successStatus: 200, responseSchema: 'OperationPolicyBindingListResponse',
  },
  {
    id: 'policyBindings.create', method: 'POST', path: `${ORG}/operations/{operationId}/policy-bindings`, summary: 'Vincula política a operação', tag: 'Policies',
    permission: 'policy.edit', idempotent: true, optimisticConcurrency: false,
    requestSchema: 'CreatePolicyBindingRequest', pathParams: ['organizationId', 'operationId'], successStatus: 201, responseSchema: 'OperationPolicyBindingResponse',
  },
  {
    id: 'policyBindings.update', method: 'PATCH', path: `${ORG}/operations/{operationId}/policy-bindings/{bindingId}`, summary: 'Edita vínculo', tag: 'Policies',
    permission: 'policy.edit', idempotent: false, optimisticConcurrency: true,
    requestSchema: 'UpdatePolicyBindingRequest', pathParams: ['organizationId', 'operationId', 'bindingId'], successStatus: 200, responseSchema: 'OperationPolicyBindingResponse',
  },
  {
    id: 'policyBindings.delete', method: 'DELETE', path: `${ORG}/operations/{operationId}/policy-bindings/{bindingId}`, summary: 'Remove vínculo (não a política)', tag: 'Policies',
    permission: 'policy.edit', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'operationId', 'bindingId'], successStatus: 200, responseSchema: 'OperationPolicyBindingResponse',
  },
];

export type PoliciesSchemas = typeof policiesSchemas;
