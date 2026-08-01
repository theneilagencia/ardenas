/**
 * Arden.AS — API v1 · execuções (endpoints + schemas) (ARDEN-BE-005).
 */

import type { EndpointContract } from '../endpoint';
import { apiResponse, paginatedResponse } from '../common/pagination';
import {
  executionRun,
  executionStep,
  executionEvent,
  evidenceRecord,
  createExecutionRequest,
  executionCommandRequest,
  listExecutionsQuery,
  listExecutionEventsQuery,
} from './executions.schemas';

const ORG = '/api/v1/organizations/{organizationId}';

export const executionsSchemas = {
  ExecutionRun: executionRun,
  ExecutionStep: executionStep,
  ExecutionEvent: executionEvent,
  EvidenceRecord: evidenceRecord,
  ExecutionRunResponse: apiResponse(executionRun),
  ExecutionRunListResponse: paginatedResponse(executionRun),
  ExecutionStepResponse: apiResponse(executionStep),
  ExecutionStepListResponse: paginatedResponse(executionStep),
  ExecutionEventListResponse: paginatedResponse(executionEvent),
  EvidenceRecordResponse: apiResponse(evidenceRecord),
  EvidenceRecordListResponse: paginatedResponse(evidenceRecord),
  CreateExecutionRequest: createExecutionRequest,
  ExecutionCommandRequest: executionCommandRequest,
  ListExecutionsQuery: listExecutionsQuery,
  ListExecutionEventsQuery: listExecutionEventsQuery,
} as const;

export const executionsEndpoints: EndpointContract[] = [
  {
    id: 'executions.list', method: 'GET', path: `${ORG}/executions`, summary: 'Lista execuções', tag: 'Executions',
    permission: 'execution.view', idempotent: false, optimisticConcurrency: false,
    querySchema: 'ListExecutionsQuery', pathParams: ['organizationId'], successStatus: 200, responseSchema: 'ExecutionRunListResponse',
  },
  {
    id: 'executions.create', method: 'POST', path: `${ORG}/operations/{operationId}/executions`, summary: 'Inicia uma execução', tag: 'Executions',
    permission: 'execution.create', idempotent: true, optimisticConcurrency: false,
    requestSchema: 'CreateExecutionRequest', pathParams: ['organizationId', 'operationId'], successStatus: 201, responseSchema: 'ExecutionRunResponse',
  },
  {
    id: 'executions.get', method: 'GET', path: `${ORG}/executions/{executionId}`, summary: 'Consulta uma execução', tag: 'Executions',
    permission: 'execution.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'executionId'], successStatus: 200, responseSchema: 'ExecutionRunResponse',
  },
  {
    id: 'executions.pause', method: 'POST', path: `${ORG}/executions/{executionId}/pause`, summary: 'Pausa uma execução', tag: 'Executions',
    permission: 'execution.pause', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'ExecutionCommandRequest', pathParams: ['organizationId', 'executionId'], successStatus: 200, responseSchema: 'ExecutionRunResponse',
  },
  {
    id: 'executions.resume', method: 'POST', path: `${ORG}/executions/{executionId}/resume`, summary: 'Retoma uma execução', tag: 'Executions',
    permission: 'execution.resume', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'ExecutionCommandRequest', pathParams: ['organizationId', 'executionId'], successStatus: 200, responseSchema: 'ExecutionRunResponse',
  },
  {
    id: 'executions.cancel', method: 'POST', path: `${ORG}/executions/{executionId}/cancel`, summary: 'Cancela uma execução', tag: 'Executions',
    permission: 'execution.cancel', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'ExecutionCommandRequest', pathParams: ['organizationId', 'executionId'], successStatus: 200, responseSchema: 'ExecutionRunResponse',
  },
  {
    id: 'executions.retry', method: 'POST', path: `${ORG}/executions/{executionId}/retry`, summary: 'Reprocessa uma execução falha', tag: 'Executions',
    permission: 'execution.retry', idempotent: true, optimisticConcurrency: true,
    requestSchema: 'ExecutionCommandRequest', pathParams: ['organizationId', 'executionId'], successStatus: 200, responseSchema: 'ExecutionRunResponse',
  },
  {
    id: 'executionSteps.list', method: 'GET', path: `${ORG}/executions/{executionId}/steps`, summary: 'Lista etapas', tag: 'Executions',
    permission: 'execution.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'executionId'], successStatus: 200, responseSchema: 'ExecutionStepListResponse',
  },
  {
    id: 'executionSteps.get', method: 'GET', path: `${ORG}/executions/{executionId}/steps/{stepId}`, summary: 'Consulta etapa', tag: 'Executions',
    permission: 'execution.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'executionId', 'stepId'], successStatus: 200, responseSchema: 'ExecutionStepResponse',
  },
  {
    id: 'executionEvents.list', method: 'GET', path: `${ORG}/executions/{executionId}/events`, summary: 'Lista eventos', tag: 'Executions',
    permission: 'execution.view', idempotent: false, optimisticConcurrency: false,
    querySchema: 'ListExecutionEventsQuery', pathParams: ['organizationId', 'executionId'], successStatus: 200, responseSchema: 'ExecutionEventListResponse',
  },
  {
    id: 'executionEvidence.list', method: 'GET', path: `${ORG}/executions/{executionId}/evidence`, summary: 'Lista evidências', tag: 'Executions',
    permission: 'evidence.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'executionId'], successStatus: 200, responseSchema: 'EvidenceRecordListResponse',
  },
  {
    id: 'executionEvidence.get', method: 'GET', path: `${ORG}/executions/{executionId}/evidence/{evidenceId}`, summary: 'Consulta evidência', tag: 'Executions',
    permission: 'evidence.view', idempotent: false, optimisticConcurrency: false,
    pathParams: ['organizationId', 'executionId', 'evidenceId'], successStatus: 200, responseSchema: 'EvidenceRecordResponse',
  },
];

export type ExecutionsSchemas = typeof executionsSchemas;
