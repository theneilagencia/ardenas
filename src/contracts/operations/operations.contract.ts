/**
 * Arden.AS — API v1 · operações (endpoints) (ARDEN-FE-003).
 *
 * Path org-scoped: `/api/v1/organizations/{organizationId}/operations`. O path
 * IDENTIFICA o recurso organizacional; a AUTORIZAÇÃO é derivada da sessão e
 * validada no backend (o organizationId do path não é prova de acesso). Permissões
 * do catálogo estável do ARDEN-FE-002.
 */

import { z } from 'zod';
import type { EndpointContract } from '../endpoint';
import { apiResponse, paginatedResponse } from '../common/pagination';
import {
  archiveOperationRequest,
  createOperationRequest,
  duplicateOperationRequest,
  listOperationsQuery,
  operation,
  operationTransitionRequest,
  updateOperationRequest,
} from './operations.schemas';

const OPS = '/api/v1/organizations/{organizationId}/operations';
const OP = `${OPS}/{operationId}`;

export const operationsSchemas = {
  Operation: operation,
  ListOperationsQuery: listOperationsQuery,
  CreateOperationRequest: createOperationRequest,
  UpdateOperationRequest: updateOperationRequest,
  DuplicateOperationRequest: duplicateOperationRequest,
  ArchiveOperationRequest: archiveOperationRequest,
  OperationTransitionRequest: operationTransitionRequest,
  OperationResponse: apiResponse(operation),
  OperationListResponse: paginatedResponse(operation),
  NoContent: z.object({}),
} as const;

export const operationsEndpoints: EndpointContract[] = [
  {
    id: 'operations.list',
    method: 'GET',
    path: OPS,
    summary: 'Lista operações da organização (filtros + cursor).',
    tag: 'Operations',
    permission: 'operation.view',
    idempotent: false,
    optimisticConcurrency: false,
    querySchema: 'ListOperationsQuery',
    pathParams: ['organizationId'],
    successStatus: 200,
    responseSchema: 'OperationListResponse',
  },
  {
    id: 'operations.create',
    method: 'POST',
    path: OPS,
    summary: 'Cria operação + primeira versão em rascunho + auditoria (transacional).',
    tag: 'Operations',
    permission: 'operation.create',
    idempotent: true,
    optimisticConcurrency: false,
    requestSchema: 'CreateOperationRequest',
    pathParams: ['organizationId'],
    successStatus: 201,
    responseSchema: 'OperationResponse',
    description: 'Idempotency-Key obrigatório. Cria de forma transacional operação, versão inicial e evento.',
  },
  {
    id: 'operations.get',
    method: 'GET',
    path: OP,
    summary: 'Busca uma operação.',
    tag: 'Operations',
    permission: 'operation.view',
    idempotent: false,
    optimisticConcurrency: false,
    pathParams: ['organizationId', 'operationId'],
    successStatus: 200,
    responseSchema: 'OperationResponse',
  },
  {
    id: 'operations.update',
    method: 'PATCH',
    path: OP,
    summary: 'Edita metadados da operação (concorrência otimista).',
    tag: 'Operations',
    permission: 'operation.edit',
    idempotent: false,
    optimisticConcurrency: true,
    requestSchema: 'UpdateOperationRequest',
    pathParams: ['organizationId', 'operationId'],
    successStatus: 200,
    responseSchema: 'OperationResponse',
    description: 'Requer If-Match/expectedRevision. Conflito → VERSION_CONFLICT (409).',
  },
  {
    id: 'operations.archive',
    method: 'POST',
    path: `${OP}/archive`,
    summary: 'Arquiva a operação.',
    tag: 'Operations',
    permission: 'operation.edit',
    idempotent: true,
    optimisticConcurrency: true,
    requestSchema: 'ArchiveOperationRequest',
    pathParams: ['organizationId', 'operationId'],
    successStatus: 200,
    responseSchema: 'OperationResponse',
    description: 'Idempotente. §21 usa "operation.archive"; o catálogo estável (FE-002) usa operation.edit.',
  },
  {
    id: 'operations.duplicate',
    method: 'POST',
    path: `${OP}/duplicate`,
    summary: 'Duplica a operação (nova operação em rascunho).',
    tag: 'Operations',
    permission: 'operation.create',
    idempotent: true,
    optimisticConcurrency: false,
    requestSchema: 'DuplicateOperationRequest',
    pathParams: ['organizationId', 'operationId'],
    successStatus: 201,
    responseSchema: 'OperationResponse',
  },
  {
    id: 'operations.pause',
    method: 'POST',
    path: `${OP}/pause`,
    summary: 'Pausa a operação.',
    tag: 'Operations',
    permission: 'operation.pause',
    idempotent: false,
    optimisticConcurrency: true,
    requestSchema: 'OperationTransitionRequest',
    pathParams: ['organizationId', 'operationId'],
    successStatus: 200,
    responseSchema: 'OperationResponse',
    description: 'Transição inválida → INVALID_STATE_TRANSITION (409).',
  },
  {
    id: 'operations.resume',
    method: 'POST',
    path: `${OP}/resume`,
    summary: 'Retoma a operação.',
    tag: 'Operations',
    permission: 'operation.pause',
    idempotent: false,
    optimisticConcurrency: true,
    requestSchema: 'OperationTransitionRequest',
    pathParams: ['organizationId', 'operationId'],
    successStatus: 200,
    responseSchema: 'OperationResponse',
  },
];
