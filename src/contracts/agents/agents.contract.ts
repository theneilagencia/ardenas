/**
 * Arden.AS — API v1 · runtime de agentes (endpoints + schemas) (ARDEN-BE-007.1).
 *
 * APIs ADMINISTRATIVAS contratadas (CRUD + publicação/estado de agentes, versões e
 * configurações de modelo; catálogo de providers). NÃO existe endpoint de execução
 * direta (`/agents/{id}/run`, `/chat`, `/models/generate`): a execução ocorre
 * EXCLUSIVAMENTE pelo motor de operações, via a etapa `agent.execute`. Segredos nunca
 * aparecem em resposta. Esta fase define contratos; runtime e persistência vêm depois.
 */

import { z } from 'zod';
import type { EndpointContract } from '../endpoint';
import { apiResponse, paginatedResponse } from '../common/pagination';
import {
  agentDefinition,
  createAgentRequest,
  updateAgentRequest,
  agentCommandRequest,
  listAgentsQuery,
} from './agent-definition.schema';
import {
  agentVersion,
  createAgentVersionRequest,
  updateAgentVersionRequest,
  publishAgentVersionRequest,
  retireAgentVersionRequest,
  listAgentVersionsQuery,
} from './agent-version.schema';
import { modelProviderDefinition, modelCatalogEntry } from './model-provider.schema';
import {
  modelConfiguration,
  createModelConfigurationRequest,
  updateModelConfigurationRequest,
  modelConfigurationCommandRequest,
  listModelConfigurationsQuery,
} from './model-configuration.schema';

const API = '/api/v1';
const ORG = `${API}/organizations/{organizationId}`;

// ── Registro de schemas (→ components.schemas) ──────────────────────────────────
export const agentsSchemas = {
  AgentDefinition: agentDefinition,
  AgentResponse: apiResponse(agentDefinition),
  AgentListResponse: paginatedResponse(agentDefinition),
  CreateAgentRequest: createAgentRequest,
  UpdateAgentRequest: updateAgentRequest,
  AgentCommandRequest: agentCommandRequest,
  ListAgentsQuery: listAgentsQuery,

  AgentVersion: agentVersion,
  AgentVersionResponse: apiResponse(agentVersion),
  AgentVersionListResponse: paginatedResponse(agentVersion),
  CreateAgentVersionRequest: createAgentVersionRequest,
  UpdateAgentVersionRequest: updateAgentVersionRequest,
  PublishAgentVersionRequest: publishAgentVersionRequest,
  RetireAgentVersionRequest: retireAgentVersionRequest,
  ListAgentVersionsQuery: listAgentVersionsQuery,

  ModelProviderDefinition: modelProviderDefinition,
  ModelProviderResponse: apiResponse(modelProviderDefinition),
  ModelProviderListResponse: apiResponse(z.array(modelProviderDefinition)),
  ModelCatalogEntry: modelCatalogEntry,
  ModelCatalogListResponse: apiResponse(z.array(modelCatalogEntry)),

  ModelConfiguration: modelConfiguration,
  ModelConfigurationResponse: apiResponse(modelConfiguration),
  ModelConfigurationListResponse: paginatedResponse(modelConfiguration),
  CreateModelConfigurationRequest: createModelConfigurationRequest,
  UpdateModelConfigurationRequest: updateModelConfigurationRequest,
  ModelConfigurationCommandRequest: modelConfigurationCommandRequest,
  ListModelConfigurationsQuery: listModelConfigurationsQuery,
} as const;

const TAG = 'Agents';

function pathParamsOf(path: string): string[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

/** Comando de mudança de estado (suspend/reactivate/revoke/activate). */
function command(
  id: string,
  path: string,
  permission: string,
  summary: string,
  request: string,
  response: string,
): EndpointContract {
  return {
    id, method: 'POST', path, summary, tag: TAG, permission,
    idempotent: true, optimisticConcurrency: true,
    requestSchema: request, pathParams: pathParamsOf(path), successStatus: 200, responseSchema: response,
  };
}

// ── Endpoints ───────────────────────────────────────────────────────────────────
export const agentsEndpoints: EndpointContract[] = [
  // Agentes
  { id: 'agents.list', method: 'GET', path: `${ORG}/agents`, summary: 'Lista agentes', tag: TAG, permission: 'agent.view', idempotent: false, optimisticConcurrency: false, querySchema: 'ListAgentsQuery', pathParams: ['organizationId'], successStatus: 200, responseSchema: 'AgentListResponse' },
  { id: 'agents.create', method: 'POST', path: `${ORG}/agents`, summary: 'Cria um agente', tag: TAG, permission: 'agent.create', idempotent: true, optimisticConcurrency: false, requestSchema: 'CreateAgentRequest', pathParams: ['organizationId'], successStatus: 201, responseSchema: 'AgentResponse', description: 'Contrato definido em ARDEN-BE-007.1. Persistência e runtime em fases futuras.' },
  { id: 'agents.get', method: 'GET', path: `${ORG}/agents/{agentId}`, summary: 'Consulta um agente', tag: TAG, permission: 'agent.view', idempotent: false, optimisticConcurrency: false, pathParams: ['organizationId', 'agentId'], successStatus: 200, responseSchema: 'AgentResponse' },
  { id: 'agents.update', method: 'PATCH', path: `${ORG}/agents/{agentId}`, summary: 'Edita metadados do agente', tag: TAG, permission: 'agent.edit', idempotent: false, optimisticConcurrency: true, requestSchema: 'UpdateAgentRequest', pathParams: ['organizationId', 'agentId'], successStatus: 200, responseSchema: 'AgentResponse', description: 'PATCH não altera status (transição só por comando dedicado).' },
  command('agents.suspend', `${ORG}/agents/{agentId}/suspend`, 'agent.suspend', 'Suspende o agente', 'AgentCommandRequest', 'AgentResponse'),
  command('agents.reactivate', `${ORG}/agents/{agentId}/reactivate`, 'agent.suspend', 'Reativa o agente', 'AgentCommandRequest', 'AgentResponse'),
  command('agents.revoke', `${ORG}/agents/{agentId}/revoke`, 'agent.revoke', 'Revoga o agente (terminal)', 'AgentCommandRequest', 'AgentResponse'),

  // Versões de agente
  { id: 'agentVersions.list', method: 'GET', path: `${ORG}/agents/{agentId}/versions`, summary: 'Lista versões do agente', tag: TAG, permission: 'agent.view', idempotent: false, optimisticConcurrency: false, querySchema: 'ListAgentVersionsQuery', pathParams: ['organizationId', 'agentId'], successStatus: 200, responseSchema: 'AgentVersionListResponse' },
  { id: 'agentVersions.create', method: 'POST', path: `${ORG}/agents/{agentId}/versions`, summary: 'Cria um rascunho de versão', tag: TAG, permission: 'agent.edit', idempotent: true, optimisticConcurrency: false, requestSchema: 'CreateAgentVersionRequest', pathParams: ['organizationId', 'agentId'], successStatus: 201, responseSchema: 'AgentVersionResponse' },
  { id: 'agentVersions.get', method: 'GET', path: `${ORG}/agents/{agentId}/versions/{agentVersionId}`, summary: 'Consulta uma versão', tag: TAG, permission: 'agent.view', idempotent: false, optimisticConcurrency: false, pathParams: ['organizationId', 'agentId', 'agentVersionId'], successStatus: 200, responseSchema: 'AgentVersionResponse' },
  { id: 'agentVersions.update', method: 'PATCH', path: `${ORG}/agents/{agentId}/versions/{agentVersionId}`, summary: 'Edita o rascunho da versão', tag: TAG, permission: 'agent.edit', idempotent: false, optimisticConcurrency: true, requestSchema: 'UpdateAgentVersionRequest', pathParams: ['organizationId', 'agentId', 'agentVersionId'], successStatus: 200, responseSchema: 'AgentVersionResponse', description: 'Só rascunho: versão publicada é imutável (ALREADY_PUBLISHED).' },
  { id: 'agentVersions.publish', method: 'POST', path: `${ORG}/agents/{agentId}/versions/{agentVersionId}/publish`, summary: 'Publica a versão (imutável)', tag: TAG, permission: 'agent.publish', idempotent: true, optimisticConcurrency: true, requestSchema: 'PublishAgentVersionRequest', pathParams: ['organizationId', 'agentId', 'agentVersionId'], successStatus: 200, responseSchema: 'AgentVersionResponse' },
  { id: 'agentVersions.retire', method: 'POST', path: `${ORG}/agents/{agentId}/versions/{agentVersionId}/retire`, summary: 'Retira a versão (não volta a publicada)', tag: TAG, permission: 'agent.publish', idempotent: true, optimisticConcurrency: true, requestSchema: 'RetireAgentVersionRequest', pathParams: ['organizationId', 'agentId', 'agentVersionId'], successStatus: 200, responseSchema: 'AgentVersionResponse' },

  // Providers de modelo (público, não tenant-scoped; leitura)
  { id: 'modelProviders.list', method: 'GET', path: `${API}/model-providers`, summary: 'Lista providers de modelo', tag: TAG, permission: 'model_provider.view', idempotent: false, optimisticConcurrency: false, pathParams: [], successStatus: 200, responseSchema: 'ModelProviderListResponse' },
  { id: 'modelProviders.get', method: 'GET', path: `${API}/model-providers/{providerKey}`, summary: 'Consulta um provider de modelo', tag: TAG, permission: 'model_provider.view', idempotent: false, optimisticConcurrency: false, pathParams: ['providerKey'], successStatus: 200, responseSchema: 'ModelProviderResponse' },
  { id: 'modelProviders.listModels', method: 'GET', path: `${API}/model-providers/{providerKey}/versions/{providerVersion}/models`, summary: 'Lista o catálogo persistido de modelos de um provider', tag: TAG, permission: 'model_provider.view', idempotent: false, optimisticConcurrency: false, pathParams: ['providerKey', 'providerVersion'], successStatus: 200, responseSchema: 'ModelCatalogListResponse', description: 'Leitura system-scoped. Modelos comerciais permanecem DISABLED até verificação/execução (008.3+). Sem segredo, sem preço.' },

  // Configurações de modelo (tenant-scoped)
  { id: 'modelConfigurations.list', method: 'GET', path: `${ORG}/model-configurations`, summary: 'Lista configurações de modelo', tag: TAG, permission: 'model_configuration.view', idempotent: false, optimisticConcurrency: false, querySchema: 'ListModelConfigurationsQuery', pathParams: ['organizationId'], successStatus: 200, responseSchema: 'ModelConfigurationListResponse' },
  { id: 'modelConfigurations.create', method: 'POST', path: `${ORG}/model-configurations`, summary: 'Cria uma configuração de modelo', tag: TAG, permission: 'model_configuration.create', idempotent: true, optimisticConcurrency: false, requestSchema: 'CreateModelConfigurationRequest', pathParams: ['organizationId'], successStatus: 201, responseSchema: 'ModelConfigurationResponse', description: 'A credencial é referenciada por conexão (cofre) e nunca retornada.' },
  { id: 'modelConfigurations.get', method: 'GET', path: `${ORG}/model-configurations/{configurationId}`, summary: 'Consulta uma configuração de modelo', tag: TAG, permission: 'model_configuration.view', idempotent: false, optimisticConcurrency: false, pathParams: ['organizationId', 'configurationId'], successStatus: 200, responseSchema: 'ModelConfigurationResponse' },
  { id: 'modelConfigurations.update', method: 'PATCH', path: `${ORG}/model-configurations/{configurationId}`, summary: 'Edita a configuração de modelo', tag: TAG, permission: 'model_configuration.edit', idempotent: false, optimisticConcurrency: true, requestSchema: 'UpdateModelConfigurationRequest', pathParams: ['organizationId', 'configurationId'], successStatus: 200, responseSchema: 'ModelConfigurationResponse', description: 'PATCH não altera status (transição só por comando dedicado).' },
  command('modelConfigurations.activate', `${ORG}/model-configurations/{configurationId}/activate`, 'model_configuration.edit', 'Ativa a configuração de modelo', 'ModelConfigurationCommandRequest', 'ModelConfigurationResponse'),
  command('modelConfigurations.suspend', `${ORG}/model-configurations/{configurationId}/suspend`, 'model_configuration.edit', 'Suspende a configuração de modelo', 'ModelConfigurationCommandRequest', 'ModelConfigurationResponse'),
  command('modelConfigurations.revoke', `${ORG}/model-configurations/{configurationId}/revoke`, 'model_configuration.revoke', 'Revoga a configuração de modelo (terminal)', 'ModelConfigurationCommandRequest', 'ModelConfigurationResponse'),
];

export type AgentsSchemas = typeof agentsSchemas;
