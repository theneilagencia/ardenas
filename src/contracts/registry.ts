/**
 * Arden.AS — API v1 · registro de schemas e endpoints (ARDEN-FE-003).
 *
 * Ponto único que agrega os schemas nomeados (para components.schemas do OpenAPI)
 * e todos os descritores de endpoint (para paths, matriz de autorização e testes
 * de contrato). Independente do frontend — não importa React/Zustand nem domínio.
 */

import type { z } from 'zod';
import { apiErrorResponse } from './common/api-error';
import type { EndpointContract } from './endpoint';
import { sessionSchemas, sessionEndpoints } from './session/session.contract';
import { operationsSchemas, operationsEndpoints } from './operations/operations.contract';
import {
  operationVersionsSchemas,
  operationVersionsEndpoints,
} from './operation-versions/operation-versions.contract';
import { authoritySchemas, authorityEndpoints } from './authority/authority.contract';
import { auditSchemas, auditEndpoints } from './audit/audit.contract';
import { policiesSchemas, policiesEndpoints } from './policies/policies.contract';
import { approvalsSchemas, approvalsEndpoints } from './approvals/approvals.contract';
import { enforcementSchemas, enforcementEndpoints } from './enforcement/enforcement.contract';
import { executionsSchemas, executionsEndpoints } from './executions/executions.contract';
import { connectorsSchemas, connectorsEndpoints } from './connectors/connectors.contract';

/** Schemas nomeados → components.schemas do OpenAPI. */
export const schemaRegistry: Record<string, z.ZodTypeAny> = {
  ApiErrorResponse: apiErrorResponse,
  ...sessionSchemas,
  ...operationsSchemas,
  ...operationVersionsSchemas,
  ...authoritySchemas,
  ...auditSchemas,
  ...policiesSchemas,
  ...approvalsSchemas,
  ...enforcementSchemas,
  ...executionsSchemas,
  ...connectorsSchemas,
};

/** Todos os endpoints da API v1. */
export const endpoints: EndpointContract[] = [
  ...sessionEndpoints,
  ...operationsEndpoints,
  ...operationVersionsEndpoints,
  ...authorityEndpoints,
  ...auditEndpoints,
  ...policiesEndpoints,
  ...approvalsEndpoints,
  ...enforcementEndpoints,
  ...executionsEndpoints,
  ...connectorsEndpoints,
];
