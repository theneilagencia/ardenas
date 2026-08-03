/**
 * Arden.AS — API v1 · consultas administrativas de resultados e uso de agentes
 * (ARDEN-BE-007.6). SOMENTE LEITURA, tenant-scoped, paginação por cursor. Nunca expõe
 * prompt/contexto/output/segredo — apenas status, contadores, tokens, custo e hashes.
 */

import { z } from 'zod';
import type { EndpointContract } from '../endpoint';
import { apiResponse, paginatedResponse, cursorPageParams } from '../common/pagination';
import { modelProviderKey, modelId } from './agent-keys';
import {
  agentOperationalResult,
  agentResultStatus,
  agentEvaluationStatusEnum,
  agentGovernanceStatus,
  agentUsageBucket,
  agentUsageRollupDimension,
} from './agent-operational-result.schema';

const ORG = '/api/v1/organizations/{organizationId}';

// ── Query: lista de resultados operacionais ──────────────────────────────────────
export const listAgentResultsQuery = cursorPageParams.extend({
  status: agentResultStatus.optional(),
  evaluationStatus: agentEvaluationStatusEnum.optional(),
  governanceStatus: agentGovernanceStatus.optional(),
  agentDefinitionId: z.string().uuid().optional(),
  agentVersionId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  executionRunId: z.string().uuid().optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
});
export type ListAgentResultsQuery = z.infer<typeof listAgentResultsQuery>;

export const agentResultListResponse = paginatedResponse(agentOperationalResult);
export const agentResultResponse = apiResponse(agentOperationalResult);

// ── Query: uso agregado ──────────────────────────────────────────────────────────
export const agentUsageQuery = z.object({
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
  groupBy: agentUsageRollupDimension.default('ORGANIZATION'),
  agentDefinitionId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  providerKey: modelProviderKey.optional(),
  modelId: modelId.optional(),
});
export type AgentUsageQuery = z.infer<typeof agentUsageQuery>;

export const agentUsageResponse = z.object({
  data: z.array(agentUsageBucket),
  meta: z.object({ groupBy: agentUsageRollupDimension, periodFrom: z.string().nullable(), periodTo: z.string().nullable() }),
});

export const executionAgentUsageResponse = apiResponse(z.object({
  executionRunId: z.string(),
  results: z.array(agentOperationalResult),
}));

// ── Schemas nomeados (OpenAPI) ────────────────────────────────────────────────────
export const agentResultsSchemas = {
  AgentOperationalResult: agentOperationalResult,
  AgentUsageBucket: agentUsageBucket,
  ListAgentResultsQuery: listAgentResultsQuery,
  AgentResultListResponse: agentResultListResponse,
  AgentResultResponse: agentResultResponse,
  AgentUsageQuery: agentUsageQuery,
  AgentUsageResponse: agentUsageResponse,
  ExecutionAgentUsageResponse: executionAgentUsageResponse,
};

// ── Endpoints ─────────────────────────────────────────────────────────────────────
export const agentResultsEndpoints: EndpointContract[] = [
  {
    id: 'agentResults.list', method: 'GET', path: `${ORG}/agent-execution-results`, summary: 'Lista resultados operacionais de agentes', tag: 'Agents',
    permission: 'agent.view', idempotent: false, optimisticConcurrency: false,
    querySchema: 'ListAgentResultsQuery', responseSchema: 'AgentResultListResponse', pathParams: ['organizationId'], successStatus: 200,
  },
  {
    id: 'agentResults.get', method: 'GET', path: `${ORG}/agent-execution-results/{resultId}`, summary: 'Obtém um resultado operacional de agente', tag: 'Agents',
    permission: 'agent.view', idempotent: false, optimisticConcurrency: false,
    responseSchema: 'AgentResultResponse', pathParams: ['organizationId', 'resultId'], successStatus: 200,
  },
  {
    id: 'agentUsage.summary', method: 'GET', path: `${ORG}/agent-usage`, summary: 'Uso agregado de agentes por dimensão', tag: 'Agents',
    permission: 'agent.cost.view', idempotent: false, optimisticConcurrency: false,
    querySchema: 'AgentUsageQuery', responseSchema: 'AgentUsageResponse', pathParams: ['organizationId'], successStatus: 200,
  },
  {
    id: 'agentUsage.execution', method: 'GET', path: `${ORG}/executions/{executionRunId}/agent-usage`, summary: 'Uso de agentes de uma execução', tag: 'Agents',
    permission: 'agent.view', idempotent: false, optimisticConcurrency: false,
    responseSchema: 'ExecutionAgentUsageResponse', pathParams: ['organizationId', 'executionRunId'], successStatus: 200,
  },
];
