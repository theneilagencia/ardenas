/**
 * Arden.AS — API v1 · Gradiente de Autoridade (endpoints) (ARDEN-FE-003).
 * Consultar/atualizar o gradiente de uma VERSÃO em rascunho. Validação das regras
 * mínimas ocorre também na publicação. Não implementa autorização final (D-003/004).
 */

import type { EndpointContract } from '../endpoint';
import { apiResponse } from '../common/pagination';
import { authorityProfile, updateAuthorityProfileRequest } from './authority.schemas';

const V = '/api/v1/organizations/{organizationId}/operations/{operationId}/versions/{versionId}';

export const authoritySchemas = {
  AuthorityProfile: authorityProfile,
  UpdateAuthorityProfileRequest: updateAuthorityProfileRequest,
  AuthorityProfileResponse: apiResponse(authorityProfile),
} as const;

export const authorityEndpoints: EndpointContract[] = [
  {
    id: 'authority.get',
    method: 'GET',
    path: `${V}/authority`,
    summary: 'Consulta o Gradiente de Autoridade da versão.',
    tag: 'Authority',
    permission: 'operation.view',
    idempotent: false,
    optimisticConcurrency: false,
    pathParams: ['organizationId', 'operationId', 'versionId'],
    successStatus: 200,
    responseSchema: 'AuthorityProfileResponse',
  },
  {
    id: 'authority.update',
    method: 'PATCH',
    path: `${V}/authority`,
    summary: 'Atualiza o Gradiente de Autoridade em rascunho (concorrência otimista).',
    tag: 'Authority',
    permission: 'operation.edit',
    idempotent: false,
    optimisticConcurrency: true,
    requestSchema: 'UpdateAuthorityProfileRequest',
    pathParams: ['organizationId', 'operationId', 'versionId'],
    successStatus: 200,
    responseSchema: 'OperationVersionResponse',
    description: 'Somente rascunho (publicada → ALREADY_PUBLISHED). Regras mínimas validadas na publicação.',
  },
];
