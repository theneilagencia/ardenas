/**
 * Arden.AS — API v1 · conectores (endpoints + schemas) (ARDEN-BE-006).
 *
 * Endpoints CONTRATADOS (a implementação funcional vem nas fases 006.3+). Catálogo
 * é público (não tenant-scoped); demais recursos são tenant-scoped (tenant no path).
 * Segredos nunca aparecem em schema de resposta; requests sensíveis são distintos.
 */

import { z } from 'zod';
import type { EndpointContract } from '../endpoint';
import { apiResponse, paginatedResponse } from '../common/pagination';
import { connectorDefinition } from './connector-definition.schema';
import { connectorToolDefinition } from './connector-tool-definition.schema';
import {
  connection,
  createConnectionRequest,
  updateConnectionRequest,
  testConnectionRequest,
  testConnectionResult,
  connectionCommandRequest,
  listConnectionsQuery,
} from './connection.schema';
import {
  createConnectionCredentialRequest,
  rotateConnectionCredentialRequest,
  credentialMetadataResponseItem,
} from './credential.schema';
import {
  organizationToolBinding,
  createOrganizationToolBindingRequest,
  updateOrganizationToolBindingRequest,
  listToolBindingsQuery,
  operationToolBinding,
  createOperationToolBindingRequest,
  updateOperationToolBindingRequest,
} from './tool-binding.schema';
import {
  webhookEndpoint,
  webhookEndpointSecret,
  webhookDelivery,
  createWebhookEndpointRequest,
  updateWebhookEndpointRequest,
  webhookCommandRequest,
  listWebhookEndpointsQuery,
  inboundWebhookAcceptedResponse,
} from './webhook.schema';

const API = '/api/v1';
const ORG = `${API}/organizations/{organizationId}`;

// ── Registro de schemas (→ components.schemas) ──────────────────────────────────
export const connectorsSchemas = {
  ConnectorDefinition: connectorDefinition,
  ConnectorToolDefinition: connectorToolDefinition,
  ConnectorCatalogListResponse: apiResponse(z.array(connectorDefinition)),
  ConnectorDefinitionResponse: apiResponse(connectorDefinition),
  ConnectorToolListResponse: apiResponse(z.array(connectorToolDefinition)),

  Connection: connection,
  ConnectionResponse: apiResponse(connection),
  ConnectionListResponse: paginatedResponse(connection),
  CreateConnectionRequest: createConnectionRequest,
  UpdateConnectionRequest: updateConnectionRequest,
  TestConnectionRequest: testConnectionRequest,
  TestConnectionResult: testConnectionResult,
  TestConnectionResponse: apiResponse(testConnectionResult),
  ConnectionCommandRequest: connectionCommandRequest,
  ListConnectionsQuery: listConnectionsQuery,

  CredentialMetadata: credentialMetadataResponseItem,
  CredentialMetadataResponse: apiResponse(credentialMetadataResponseItem),
  CredentialMetadataListResponse: paginatedResponse(credentialMetadataResponseItem),
  CreateConnectionCredentialRequest: createConnectionCredentialRequest,
  RotateConnectionCredentialRequest: rotateConnectionCredentialRequest,

  OrganizationToolBinding: organizationToolBinding,
  OrganizationToolBindingResponse: apiResponse(organizationToolBinding),
  OrganizationToolBindingListResponse: paginatedResponse(organizationToolBinding),
  CreateOrganizationToolBindingRequest: createOrganizationToolBindingRequest,
  UpdateOrganizationToolBindingRequest: updateOrganizationToolBindingRequest,
  ListToolBindingsQuery: listToolBindingsQuery,
  ToolBindingCommandRequest: connectionCommandRequest,

  OperationToolBinding: operationToolBinding,
  OperationToolBindingResponse: apiResponse(operationToolBinding),
  OperationToolBindingListResponse: apiResponse(z.array(operationToolBinding)),
  CreateOperationToolBindingRequest: createOperationToolBindingRequest,
  UpdateOperationToolBindingRequest: updateOperationToolBindingRequest,

  WebhookEndpoint: webhookEndpoint,
  WebhookEndpointResponse: apiResponse(webhookEndpoint),
  WebhookEndpointListResponse: paginatedResponse(webhookEndpoint),
  WebhookEndpointSecret: webhookEndpointSecret,
  WebhookEndpointSecretResponse: apiResponse(webhookEndpointSecret),
  WebhookDelivery: webhookDelivery,
  CreateWebhookEndpointRequest: createWebhookEndpointRequest,
  UpdateWebhookEndpointRequest: updateWebhookEndpointRequest,
  WebhookCommandRequest: webhookCommandRequest,
  ListWebhookEndpointsQuery: listWebhookEndpointsQuery,
  InboundWebhookAcceptedResponse: inboundWebhookAcceptedResponse,
} as const;

const TAG = 'Connectors';

/** Comando de mudança de estado (activate/suspend/reactivate/revoke). */
function command(
  id: string,
  path: string,
  permission: string,
  summary: string,
  request: string,
  response = 'ConnectionResponse',
  concurrency = true,
): EndpointContract {
  return {
    id, method: 'POST', path, summary, tag: TAG, permission,
    idempotent: true, optimisticConcurrency: concurrency,
    requestSchema: request, pathParams: pathParamsOf(path), successStatus: 200, responseSchema: response,
  };
}

function pathParamsOf(path: string): string[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

// ── Endpoints ───────────────────────────────────────────────────────────────────
export const connectorsEndpoints: EndpointContract[] = [
  // Catálogo (público, não tenant-scoped; leitura)
  { id: 'connectors.list', method: 'GET', path: `${API}/connectors`, summary: 'Lista o catálogo de conectores', tag: TAG, permission: 'connector.view', idempotent: false, optimisticConcurrency: false, pathParams: [], successStatus: 200, responseSchema: 'ConnectorCatalogListResponse' },
  { id: 'connectors.get', method: 'GET', path: `${API}/connectors/{connectorKey}`, summary: 'Consulta um conector', tag: TAG, permission: 'connector.view', idempotent: false, optimisticConcurrency: false, pathParams: ['connectorKey'], successStatus: 200, responseSchema: 'ConnectorDefinitionResponse' },
  { id: 'connectors.listTools', method: 'GET', path: `${API}/connectors/{connectorKey}/tools`, summary: 'Lista ferramentas de um conector', tag: TAG, permission: 'connector.view', idempotent: false, optimisticConcurrency: false, pathParams: ['connectorKey'], successStatus: 200, responseSchema: 'ConnectorToolListResponse' },

  // Conexões
  { id: 'connections.list', method: 'GET', path: `${ORG}/connections`, summary: 'Lista conexões', tag: TAG, permission: 'connection.view', idempotent: false, optimisticConcurrency: false, querySchema: 'ListConnectionsQuery', pathParams: ['organizationId'], successStatus: 200, responseSchema: 'ConnectionListResponse' },
  { id: 'connections.create', method: 'POST', path: `${ORG}/connections`, summary: 'Cria uma conexão', tag: TAG, permission: 'connection.create', idempotent: true, optimisticConcurrency: false, requestSchema: 'CreateConnectionRequest', pathParams: ['organizationId'], successStatus: 201, responseSchema: 'ConnectionResponse' },
  { id: 'connections.get', method: 'GET', path: `${ORG}/connections/{connectionId}`, summary: 'Consulta uma conexão', tag: TAG, permission: 'connection.view', idempotent: false, optimisticConcurrency: false, pathParams: ['organizationId', 'connectionId'], successStatus: 200, responseSchema: 'ConnectionResponse' },
  { id: 'connections.update', method: 'PATCH', path: `${ORG}/connections/{connectionId}`, summary: 'Edita metadados/config/política da conexão', tag: TAG, permission: 'connection.edit', idempotent: false, optimisticConcurrency: true, requestSchema: 'UpdateConnectionRequest', pathParams: ['organizationId', 'connectionId'], successStatus: 200, responseSchema: 'ConnectionResponse', description: 'PATCH não altera status (transição só por comando dedicado).' },
  { id: 'connections.test', method: 'POST', path: `${ORG}/connections/{connectionId}/test`, summary: 'Testa a conexão (sem revelar segredo)', tag: TAG, permission: 'connection.test', idempotent: true, optimisticConcurrency: false, requestSchema: 'TestConnectionRequest', pathParams: ['organizationId', 'connectionId'], successStatus: 200, responseSchema: 'TestConnectionResponse' },
  command('connections.activate', `${ORG}/connections/{connectionId}/activate`, 'connection.edit', 'Ativa a conexão', 'ConnectionCommandRequest'),
  command('connections.suspend', `${ORG}/connections/{connectionId}/suspend`, 'connection.edit', 'Suspende a conexão', 'ConnectionCommandRequest'),
  command('connections.reactivate', `${ORG}/connections/{connectionId}/reactivate`, 'connection.edit', 'Reativa a conexão', 'ConnectionCommandRequest'),
  command('connections.revoke', `${ORG}/connections/{connectionId}/revoke`, 'connection.revoke', 'Revoga a conexão (terminal)', 'ConnectionCommandRequest'),

  // Credenciais (request sensível; response só metadados)
  { id: 'credentials.list', method: 'GET', path: `${ORG}/connections/{connectionId}/credentials`, summary: 'Lista metadados de credenciais', tag: TAG, permission: 'connection.view', idempotent: false, optimisticConcurrency: false, pathParams: ['organizationId', 'connectionId'], successStatus: 200, responseSchema: 'CredentialMetadataListResponse', description: 'Retorna apenas metadados: nunca o segredo.' },
  { id: 'credentials.create', method: 'POST', path: `${ORG}/connections/{connectionId}/credentials`, summary: 'Cria uma credencial (segredo write-only)', tag: TAG, permission: 'connection.rotate_credentials', idempotent: true, optimisticConcurrency: false, requestSchema: 'CreateConnectionCredentialRequest', pathParams: ['organizationId', 'connectionId'], successStatus: 201, responseSchema: 'CredentialMetadataResponse', description: 'O segredo é cifrado e nunca retornado.' },
  { id: 'credentials.rotate', method: 'POST', path: `${ORG}/connections/{connectionId}/credentials/rotate`, summary: 'Rotaciona a credencial', tag: TAG, permission: 'connection.rotate_credentials', idempotent: true, optimisticConcurrency: false, requestSchema: 'RotateConnectionCredentialRequest', pathParams: ['organizationId', 'connectionId'], successStatus: 201, responseSchema: 'CredentialMetadataResponse', description: 'Cria uma nova versão cifrada e a ativa (supersede a anterior). Concorrência garantida pelo índice de credencial ativa única; o segredo é write-only e nunca retornado.' },
  { id: 'credentials.revoke', method: 'POST', path: `${ORG}/connections/{connectionId}/credentials/{credentialVersionId}/revoke`, summary: 'Revoga uma versão de credencial', tag: TAG, permission: 'connection.revoke', idempotent: true, optimisticConcurrency: false, pathParams: ['organizationId', 'connectionId', 'credentialVersionId'], successStatus: 200, responseSchema: 'CredentialMetadataResponse' },

  // Organization tool bindings
  { id: 'toolBindings.list', method: 'GET', path: `${ORG}/tool-bindings`, summary: 'Lista vínculos de ferramenta', tag: TAG, permission: 'tool.view', idempotent: false, optimisticConcurrency: false, querySchema: 'ListToolBindingsQuery', pathParams: ['organizationId'], successStatus: 200, responseSchema: 'OrganizationToolBindingListResponse' },
  { id: 'toolBindings.create', method: 'POST', path: `${ORG}/tool-bindings`, summary: 'Cria um vínculo de ferramenta', tag: TAG, permission: 'tool.bind', idempotent: true, optimisticConcurrency: false, requestSchema: 'CreateOrganizationToolBindingRequest', pathParams: ['organizationId'], successStatus: 201, responseSchema: 'OrganizationToolBindingResponse' },
  { id: 'toolBindings.get', method: 'GET', path: `${ORG}/tool-bindings/{bindingId}`, summary: 'Consulta um vínculo de ferramenta', tag: TAG, permission: 'tool.view', idempotent: false, optimisticConcurrency: false, pathParams: ['organizationId', 'bindingId'], successStatus: 200, responseSchema: 'OrganizationToolBindingResponse' },
  { id: 'toolBindings.update', method: 'PATCH', path: `${ORG}/tool-bindings/{bindingId}`, summary: 'Edita um vínculo de ferramenta', tag: TAG, permission: 'tool.bind', idempotent: false, optimisticConcurrency: true, requestSchema: 'UpdateOrganizationToolBindingRequest', pathParams: ['organizationId', 'bindingId'], successStatus: 200, responseSchema: 'OrganizationToolBindingResponse' },
  command('toolBindings.disable', `${ORG}/tool-bindings/{bindingId}/disable`, 'tool.bind', 'Desabilita um vínculo de ferramenta', 'ToolBindingCommandRequest', 'OrganizationToolBindingResponse'),

  // Operation tool bindings
  { id: 'operationToolBindings.list', method: 'GET', path: `${ORG}/operations/{operationId}/tool-bindings`, summary: 'Lista ferramentas vinculadas à operação', tag: TAG, permission: 'tool.view', idempotent: false, optimisticConcurrency: false, pathParams: ['organizationId', 'operationId'], successStatus: 200, responseSchema: 'OperationToolBindingListResponse' },
  { id: 'operationToolBindings.create', method: 'POST', path: `${ORG}/operations/{operationId}/tool-bindings`, summary: 'Vincula uma ferramenta à operação', tag: TAG, permission: 'tool.bind', idempotent: true, optimisticConcurrency: false, requestSchema: 'CreateOperationToolBindingRequest', pathParams: ['organizationId', 'operationId'], successStatus: 201, responseSchema: 'OperationToolBindingResponse' },
  { id: 'operationToolBindings.update', method: 'PATCH', path: `${ORG}/operations/{operationId}/tool-bindings/{bindingId}`, summary: 'Edita o vínculo com a operação', tag: TAG, permission: 'tool.bind', idempotent: false, optimisticConcurrency: true, requestSchema: 'UpdateOperationToolBindingRequest', pathParams: ['organizationId', 'operationId', 'bindingId'], successStatus: 200, responseSchema: 'OperationToolBindingResponse' },
  { id: 'operationToolBindings.remove', method: 'DELETE', path: `${ORG}/operations/{operationId}/tool-bindings/{bindingId}`, summary: 'Remove o vínculo (preserva histórico)', tag: TAG, permission: 'tool.bind', idempotent: false, optimisticConcurrency: true, pathParams: ['organizationId', 'operationId', 'bindingId'], successStatus: 200, responseSchema: 'OperationToolBindingResponse' },

  // Webhooks
  { id: 'webhooks.listEndpoints', method: 'GET', path: `${ORG}/webhook-endpoints`, summary: 'Lista endpoints de webhook', tag: TAG, permission: 'webhook.view', idempotent: false, optimisticConcurrency: false, querySchema: 'ListWebhookEndpointsQuery', pathParams: ['organizationId'], successStatus: 200, responseSchema: 'WebhookEndpointListResponse' },
  { id: 'webhooks.createEndpoint', method: 'POST', path: `${ORG}/webhook-endpoints`, summary: 'Cria um endpoint de webhook (token uma única vez)', tag: TAG, permission: 'webhook.manage', idempotent: true, optimisticConcurrency: false, requestSchema: 'CreateWebhookEndpointRequest', pathParams: ['organizationId'], successStatus: 201, responseSchema: 'WebhookEndpointSecretResponse', description: 'O token do endpoint e o segredo de assinatura são retornados UMA única vez.' },
  { id: 'webhooks.getEndpoint', method: 'GET', path: `${ORG}/webhook-endpoints/{webhookEndpointId}`, summary: 'Consulta um endpoint de webhook', tag: TAG, permission: 'webhook.view', idempotent: false, optimisticConcurrency: false, pathParams: ['organizationId', 'webhookEndpointId'], successStatus: 200, responseSchema: 'WebhookEndpointResponse' },
  { id: 'webhooks.updateEndpoint', method: 'PATCH', path: `${ORG}/webhook-endpoints/{webhookEndpointId}`, summary: 'Edita um endpoint de webhook', tag: TAG, permission: 'webhook.manage', idempotent: false, optimisticConcurrency: true, requestSchema: 'UpdateWebhookEndpointRequest', pathParams: ['organizationId', 'webhookEndpointId'], successStatus: 200, responseSchema: 'WebhookEndpointResponse' },
  command('webhooks.suspendEndpoint', `${ORG}/webhook-endpoints/{webhookEndpointId}/suspend`, 'webhook.manage', 'Suspende um endpoint de webhook', 'WebhookCommandRequest', 'WebhookEndpointResponse'),
  command('webhooks.reactivateEndpoint', `${ORG}/webhook-endpoints/{webhookEndpointId}/reactivate`, 'webhook.manage', 'Reativa um endpoint de webhook', 'WebhookCommandRequest', 'WebhookEndpointResponse'),
  command('webhooks.revokeEndpoint', `${ORG}/webhook-endpoints/{webhookEndpointId}/revoke`, 'webhook.manage', 'Revoga um endpoint de webhook (terminal)', 'WebhookCommandRequest', 'WebhookEndpointResponse'),

  // Webhook de ENTRADA (público, autenticado por assinatura/token — sem permissão de usuário)
  { id: 'webhooks.receive', method: 'POST', path: `${API}/webhooks/{endpointToken}`, summary: 'Recebe um webhook (autenticado por assinatura)', tag: TAG, permission: null, public: true, idempotent: false, optimisticConcurrency: false, pathParams: ['endpointToken'], successStatus: 202, responseSchema: 'InboundWebhookAcceptedResponse', description: 'Endpoint público. Autenticação por assinatura + proteção de replay. Resposta pública mínima.' },
];

export type ConnectorsSchemas = typeof connectorsSchemas;
