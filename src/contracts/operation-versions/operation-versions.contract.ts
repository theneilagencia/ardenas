/**
 * Arden.AS — API v1 · versões de operação (endpoints) (ARDEN-FE-003).
 * Publicação é comando próprio (idempotente + concorrência otimista). PATCH só em
 * rascunho — publicada é imutável (ALREADY_PUBLISHED).
 */

import type { EndpointContract } from '../endpoint';
import { apiResponse, paginatedResponse } from '../common/pagination';
import {
  createOperationVersionRequest,
  operationVersion,
  publishOperationVersionRequest,
  publishOperationVersionResult,
  updateOperationVersionRequest,
  versionComparison,
} from './operation-versions.schemas';

const BASE = '/api/v1/organizations/{organizationId}/operations/{operationId}/versions';
const V = `${BASE}/{versionId}`;

export const operationVersionsSchemas = {
  OperationVersion: operationVersion,
  CreateOperationVersionRequest: createOperationVersionRequest,
  UpdateOperationVersionRequest: updateOperationVersionRequest,
  PublishOperationVersionRequest: publishOperationVersionRequest,
  PublishOperationVersionResult: publishOperationVersionResult,
  VersionComparison: versionComparison,
  OperationVersionResponse: apiResponse(operationVersion),
  OperationVersionListResponse: paginatedResponse(operationVersion),
  PublishOperationVersionResponse: apiResponse(publishOperationVersionResult),
  VersionComparisonResponse: apiResponse(versionComparison),
} as const;

export const operationVersionsEndpoints: EndpointContract[] = [
  {
    id: 'operationVersions.list',
    method: 'GET',
    path: BASE,
    summary: 'Lista versões da operação.',
    tag: 'OperationVersions',
    permission: 'operation.view',
    idempotent: false,
    optimisticConcurrency: false,
    pathParams: ['organizationId', 'operationId'],
    successStatus: 200,
    responseSchema: 'OperationVersionListResponse',
  },
  {
    id: 'operationVersions.create',
    method: 'POST',
    path: BASE,
    summary: 'Cria nova versão em rascunho (copia outra quando basedOnVersionId).',
    tag: 'OperationVersions',
    permission: 'operation.edit',
    idempotent: true,
    optimisticConcurrency: false,
    requestSchema: 'CreateOperationVersionRequest',
    pathParams: ['organizationId', 'operationId'],
    successStatus: 201,
    responseSchema: 'OperationVersionResponse',
  },
  {
    id: 'operationVersions.get',
    method: 'GET',
    path: V,
    summary: 'Busca uma versão (rascunho ou publicada).',
    tag: 'OperationVersions',
    permission: 'operation.view',
    idempotent: false,
    optimisticConcurrency: false,
    pathParams: ['organizationId', 'operationId', 'versionId'],
    successStatus: 200,
    responseSchema: 'OperationVersionResponse',
  },
  {
    id: 'operationVersions.update',
    method: 'PATCH',
    path: V,
    summary: 'Edita a definição do rascunho (concorrência otimista).',
    tag: 'OperationVersions',
    permission: 'operation.edit',
    idempotent: false,
    optimisticConcurrency: true,
    requestSchema: 'UpdateOperationVersionRequest',
    pathParams: ['organizationId', 'operationId', 'versionId'],
    successStatus: 200,
    responseSchema: 'OperationVersionResponse',
    description: 'Somente rascunho. Versão publicada → ALREADY_PUBLISHED (409). Conflito → VERSION_CONFLICT.',
  },
  {
    id: 'operationVersions.publish',
    method: 'POST',
    path: `${V}/publish`,
    summary: 'Publica a versão (comando explícito e idempotente).',
    tag: 'OperationVersions',
    permission: 'operation.publish',
    idempotent: true,
    optimisticConcurrency: true,
    requestSchema: 'PublishOperationVersionRequest',
    pathParams: ['organizationId', 'operationId', 'versionId'],
    successStatus: 200,
    responseSchema: 'PublishOperationVersionResponse',
    description:
      'Valida: versão pertence à operação/organização; está em rascunho; permissão; gradiente válido; ' +
      'campos obrigatórios; revisão atual; idempotência; publicação anterior. Republicar → ALREADY_PUBLISHED.',
  },
  {
    id: 'operationVersions.compare',
    method: 'GET',
    path: `${V}/compare/{otherVersionId}`,
    summary: 'Compara duas versões da mesma operação.',
    tag: 'OperationVersions',
    permission: 'operation.view',
    idempotent: false,
    optimisticConcurrency: false,
    pathParams: ['organizationId', 'operationId', 'versionId', 'otherVersionId'],
    successStatus: 200,
    responseSchema: 'VersionComparisonResponse',
  },
];
