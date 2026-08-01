/**
 * Arden.AS — API v1 · enforcement (endpoints + schemas) (ARDEN-BE-004).
 */

import type { EndpointContract } from '../endpoint';
import { apiResponse } from '../common/pagination';
import {
  actionAuthorization,
  actionEvaluationResult,
  approvalDecisionResult,
  actionValidationResult,
  evaluateActionRequest,
  validateAuthorizationRequest,
} from './enforcement.schemas';

const ORG = '/api/v1/organizations/{organizationId}';

export const enforcementSchemas = {
  ActionAuthorization: actionAuthorization,
  ActionEvaluationResult: actionEvaluationResult,
  ApprovalDecisionResult: approvalDecisionResult,
  ActionValidationResult: actionValidationResult,
  ActionEvaluationResponse: apiResponse(actionEvaluationResult),
  ApprovalDecisionResponse: apiResponse(approvalDecisionResult),
  ActionValidationResponse: apiResponse(actionValidationResult),
  ActionAuthorizationResponse: apiResponse(actionAuthorization),
  EvaluateActionRequest: evaluateActionRequest,
  ValidateAuthorizationRequest: validateAuthorizationRequest,
} as const;

export const enforcementEndpoints: EndpointContract[] = [
  {
    id: 'actions.evaluate', method: 'POST', path: `${ORG}/operations/{operationId}/actions/evaluate`,
    summary: 'Avalia uma ação (permitida/bloqueada/exige aprovação)', tag: 'Enforcement',
    permission: 'authority.evaluate', idempotent: true, optimisticConcurrency: false,
    requestSchema: 'EvaluateActionRequest', pathParams: ['organizationId', 'operationId'], successStatus: 200, responseSchema: 'ActionEvaluationResponse',
  },
  {
    id: 'actionAuthorizations.validate', method: 'POST', path: `${ORG}/action-authorizations/validate`,
    summary: 'Valida uma autorização de ação (sem executar)', tag: 'Enforcement',
    permission: 'authority.evaluate', idempotent: false, optimisticConcurrency: false,
    requestSchema: 'ValidateAuthorizationRequest', pathParams: ['organizationId'], successStatus: 200, responseSchema: 'ActionValidationResponse',
  },
];

export type EnforcementSchemas = typeof enforcementSchemas;
