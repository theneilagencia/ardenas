/**
 * Arden.AS — dublê de teste de `ConnectorsRepository` (ARDEN-BE-006.8).
 * Implementação em memória, com verificação de `expectedRevision` (concorrência
 * otimista) idêntica à semântica documentada em CONNECTOR_STATE_MACHINES.md —
 * usada SOMENTE em testes (injeção via `setServices`).
 */

import type {
  ConnectionCommandRequest,
  ConnectorDefinition,
  ConnectorToolDefinition,
  Connection,
  CreateConnectionCredentialRequest,
  CreateConnectionRequest,
  CreateOperationToolBindingRequest,
  CreateOrganizationToolBindingRequest,
  CreateWebhookEndpointRequest,
  CredentialMetadata,
  OperationToolBinding,
  OrganizationToolBinding,
  RotateConnectionCredentialRequest,
  TestConnectionRequest,
  TestConnectionResult,
  UpdateConnectionRequest,
  UpdateOperationToolBindingRequest,
  UpdateOrganizationToolBindingRequest,
  UpdateWebhookEndpointRequest,
  WebhookCommandRequest,
  WebhookEndpoint,
  WebhookEndpointSecret,
} from '@/contracts';
import { PRODUCTION_NETWORK_POLICY_DEFAULTS } from '@/contracts';
import type {
  ConnectorsRepository,
  CursorPage,
  ListConnectionsInput,
  ListToolBindingsInput,
  ListWebhookEndpointsInput,
} from '@/services/contracts';
import { ArdenRepositoryError } from '@/services/errors';

const NOW = '2026-08-01T00:00:00.000Z';

export function httpConnectorDefinition(): ConnectorDefinition {
  return {
    id: 'cd_http',
    key: 'system.http',
    version: '1',
    name: 'HTTP REST',
    description: 'Cliente HTTP REST genérico.',
    category: 'HTTP',
    status: 'ACTIVE',
    systemManaged: true,
    productionAllowed: true,
    configurationSchema: {},
    credentialSchema: {},
    networkPolicyTemplate: PRODUCTION_NETWORK_POLICY_DEFAULTS,
    capabilityKeys: ['http.request'],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export function webhookConnectorDefinition(): ConnectorDefinition {
  return {
    id: 'cd_webhook',
    key: 'system.webhook',
    version: '1',
    name: 'Webhook de saída',
    description: 'Envio assinado para um endpoint fixo.',
    category: 'WEBHOOK',
    status: 'ACTIVE',
    systemManaged: true,
    productionAllowed: true,
    configurationSchema: {},
    credentialSchema: {},
    networkPolicyTemplate: PRODUCTION_NETWORK_POLICY_DEFAULTS,
    capabilityKeys: ['webhook.send'],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function httpTool(): ConnectorToolDefinition {
  return {
    id: 'ctd_http_request',
    connectorKey: 'system.http',
    connectorVersion: '1',
    key: 'http.request',
    version: '1',
    name: 'HTTP request',
    description: 'Requisição HTTP.',
    actionKey: 'external.http.request',
    inputSchema: {},
    outputSchema: {},
    riskLevel: 'WRITE',
    idempotencyMode: 'OPTIONAL',
    retryMode: 'CONDITIONAL',
    defaultTimeoutMs: 15000,
    maximumTimeoutMs: 60000,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq}`;
}

export function makeActiveConnection(over: Partial<Connection> = {}): Connection {
  return {
    id: nextId('conn'),
    organizationId: 'org_a',
    connectorDefinitionId: 'cd_http',
    connectorKey: 'system.http',
    connectorVersion: '1',
    name: 'Seeded connection',
    description: null,
    status: 'ACTIVE',
    configuration: { baseUrl: 'https://api.example.com' },
    networkPolicy: PRODUCTION_NETWORK_POLICY_DEFAULTS,
    currentCredentialVersionId: null,
    lastTestedAt: null,
    lastTestStatus: 'NOT_TESTED',
    lastErrorCode: null,
    lastErrorSummary: null,
    createdByUserId: 'user_demo',
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function conflict(): never {
  throw new ArdenRepositoryError('CONFLICT', 'A revisão informada não corresponde ao estado atual.');
}

function notFound(what: string): never {
  throw new ArdenRepositoryError('NOT_FOUND', `${what} não encontrado(a).`);
}

function page<T>(items: T[]): CursorPage<T> {
  return { items: items.map(clone), cursor: null, hasNextPage: false };
}

/**
 * Simula a fronteira de rede: cada leitura devolve uma cópia independente do
 * estado interno, para que mutar o "servidor" simulado (em testes de conflito
 * de revisão) não altere silenciosamente objetos já lidos pelo cliente.
 */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Dublê em memória — cobre exatamente os fluxos exercitados pelos testes de UI. */
export class FakeConnectorsRepository implements ConnectorsRepository {
  connections: Connection[];
  bindings: OrganizationToolBinding[] = [];
  webhooks: WebhookEndpoint[] = [];
  lastCredentialSecret: unknown = null;
  failListConnections = false;

  constructor(initialConnections: Connection[] = []) {
    this.connections = initialConnections;
  }

  async listConnectors(): Promise<ConnectorDefinition[]> {
    return [httpConnectorDefinition(), webhookConnectorDefinition()];
  }

  async getConnector(connectorKey: string): Promise<ConnectorDefinition> {
    return connectorKey === 'system.webhook' ? webhookConnectorDefinition() : httpConnectorDefinition();
  }

  async listConnectorTools(): Promise<ConnectorToolDefinition[]> {
    return [httpTool()];
  }

  async listConnections(_input: ListConnectionsInput = {}): Promise<CursorPage<Connection>> {
    if (this.failListConnections) throw new ArdenRepositoryError('UNKNOWN', 'Falha simulada.');
    return page(this.connections);
  }

  async createConnection(body: CreateConnectionRequest): Promise<Connection> {
    const conn = makeActiveConnection({
      id: nextId('conn'),
      connectorKey: body.connectorKey,
      connectorVersion: body.connectorVersion,
      name: body.name,
      configuration: body.configuration ?? {},
      status: 'DRAFT',
      revision: 1,
    });
    this.connections.push(conn);
    return clone(conn);
  }

  async getConnection(connectionId: string): Promise<Connection> {
    return clone(this.connections.find((c) => c.id === connectionId) ?? notFound('Conexão'));
  }

  async updateConnection(connectionId: string, body: UpdateConnectionRequest): Promise<Connection> {
    const conn = this.connections.find((c) => c.id === connectionId) ?? notFound('Conexão');
    if (body.expectedRevision !== conn.revision) conflict();
    Object.assign(conn, { name: body.name ?? conn.name, revision: conn.revision + 1 });
    return clone(conn);
  }

  async testConnection(connectionId: string, _body: TestConnectionRequest = {}): Promise<TestConnectionResult> {
    const conn = this.connections.find((c) => c.id === connectionId) ?? notFound('Conexão');
    conn.lastTestedAt = NOW;
    conn.lastTestStatus = 'SUCCESS';
    return {
      status: 'SUCCESS',
      checkedAt: NOW,
      latencyMs: 42,
      credentialFingerprint: 'fp_test_conn',
      errorCode: null,
      errorSummary: null,
    };
  }

  async activateConnection(connectionId: string, body: ConnectionCommandRequest): Promise<Connection> {
    const conn = this.connections.find((c) => c.id === connectionId) ?? notFound('Conexão');
    if (body.expectedRevision !== conn.revision) conflict();
    conn.status = 'ACTIVE';
    conn.revision += 1;
    return clone(conn);
  }

  async suspendConnection(connectionId: string, body: ConnectionCommandRequest): Promise<Connection> {
    const conn = this.connections.find((c) => c.id === connectionId) ?? notFound('Conexão');
    if (body.expectedRevision !== conn.revision) conflict();
    conn.status = 'SUSPENDED';
    conn.revision += 1;
    return clone(conn);
  }

  async reactivateConnection(connectionId: string, body: ConnectionCommandRequest): Promise<Connection> {
    const conn = this.connections.find((c) => c.id === connectionId) ?? notFound('Conexão');
    if (body.expectedRevision !== conn.revision) conflict();
    conn.status = 'ACTIVE';
    conn.revision += 1;
    return clone(conn);
  }

  async revokeConnection(connectionId: string, body: ConnectionCommandRequest): Promise<Connection> {
    const conn = this.connections.find((c) => c.id === connectionId) ?? notFound('Conexão');
    if (body.expectedRevision !== conn.revision) conflict();
    conn.status = 'REVOKED';
    conn.revision += 1;
    return clone(conn);
  }

  async listCredentials(): Promise<CredentialMetadata[]> {
    return [];
  }

  async createCredential(
    connectionId: string,
    body: CreateConnectionCredentialRequest,
  ): Promise<CredentialMetadata> {
    this.lastCredentialSecret = body.secret;
    const conn = this.connections.find((c) => c.id === connectionId);
    if (conn) conn.currentCredentialVersionId = 'cred_1';
    return {
      id: 'cred_1',
      organizationId: 'org_a',
      connectionId,
      versionNumber: 1,
      status: 'ACTIVE',
      fingerprint: 'fp_cred_1',
      keyVersion: 'v1',
      createdByUserId: 'user_demo',
      createdAt: NOW,
      activatedAt: NOW,
      supersededAt: null,
      revokedAt: null,
    };
  }

  async rotateCredential(
    connectionId: string,
    body: RotateConnectionCredentialRequest,
  ): Promise<CredentialMetadata> {
    this.lastCredentialSecret = body.secret;
    return {
      id: 'cred_2',
      organizationId: 'org_a',
      connectionId,
      versionNumber: 2,
      status: 'ACTIVE',
      fingerprint: 'fp_cred_2',
      keyVersion: 'v1',
      createdByUserId: 'user_demo',
      createdAt: NOW,
      activatedAt: NOW,
      supersededAt: null,
      revokedAt: null,
    };
  }

  async revokeCredential(connectionId: string): Promise<CredentialMetadata> {
    return {
      id: 'cred_1',
      organizationId: 'org_a',
      connectionId,
      versionNumber: 1,
      status: 'REVOKED',
      fingerprint: 'fp_cred_1',
      keyVersion: 'v1',
      createdByUserId: 'user_demo',
      createdAt: NOW,
      activatedAt: NOW,
      supersededAt: null,
      revokedAt: NOW,
    };
  }

  async listToolBindings(_input: ListToolBindingsInput = {}): Promise<CursorPage<OrganizationToolBinding>> {
    return page(this.bindings);
  }

  async createToolBinding(body: CreateOrganizationToolBindingRequest): Promise<OrganizationToolBinding> {
    const binding: OrganizationToolBinding = {
      id: nextId('tb'),
      organizationId: 'org_a',
      connectionId: body.connectionId,
      connectorToolDefinitionId: 'ctd_http_request',
      connectorToolKey: body.connectorToolKey,
      connectorToolVersion: body.connectorToolVersion,
      name: body.name,
      enabled: true,
      configurationOverrides: {},
      policyOverrides: {},
      createdByUserId: 'user_demo',
      revision: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.bindings.push(binding);
    return clone(binding);
  }

  async getToolBinding(bindingId: string): Promise<OrganizationToolBinding> {
    return clone(this.bindings.find((b) => b.id === bindingId) ?? notFound('Vínculo'));
  }

  async updateToolBinding(
    bindingId: string,
    body: UpdateOrganizationToolBindingRequest,
  ): Promise<OrganizationToolBinding> {
    const binding = this.bindings.find((b) => b.id === bindingId) ?? notFound('Vínculo');
    if (body.expectedRevision !== binding.revision) conflict();
    Object.assign(binding, { name: body.name ?? binding.name, revision: binding.revision + 1 });
    return clone(binding);
  }

  async disableToolBinding(
    bindingId: string,
    body: ConnectionCommandRequest,
  ): Promise<OrganizationToolBinding> {
    const binding = this.bindings.find((b) => b.id === bindingId) ?? notFound('Vínculo');
    if (body.expectedRevision !== binding.revision) conflict();
    binding.enabled = false;
    binding.revision += 1;
    return clone(binding);
  }

  async listOperationToolBindings(): Promise<OperationToolBinding[]> {
    return [];
  }

  async createOperationToolBinding(
    _operationId: string,
    _body: CreateOperationToolBindingRequest,
  ): Promise<OperationToolBinding> {
    throw new ArdenRepositoryError('UNAVAILABLE', 'Não exercitado neste dublê.');
  }

  async updateOperationToolBinding(
    _operationId: string,
    _bindingId: string,
    _body: UpdateOperationToolBindingRequest,
  ): Promise<OperationToolBinding> {
    throw new ArdenRepositoryError('UNAVAILABLE', 'Não exercitado neste dublê.');
  }

  async removeOperationToolBinding(): Promise<OperationToolBinding> {
    throw new ArdenRepositoryError('UNAVAILABLE', 'Não exercitado neste dublê.');
  }

  async listWebhookEndpoints(_input: ListWebhookEndpointsInput = {}): Promise<CursorPage<WebhookEndpoint>> {
    return page(this.webhooks);
  }

  async createWebhookEndpoint(body: CreateWebhookEndpointRequest): Promise<WebhookEndpointSecret> {
    const endpoint: WebhookEndpoint = {
      id: nextId('wh'),
      organizationId: 'org_a',
      connectionId: body.connectionId,
      key: body.key,
      status: 'ACTIVE',
      signatureScheme: body.signatureScheme ?? 'HMAC_SHA256',
      signatureRequired: body.signatureScheme !== 'NONE',
      replayWindowSeconds: body.replayWindowSeconds ?? 300,
      allowedEventTypes: body.allowedEventTypes ?? [],
      operationId: null,
      operationVersionId: null,
      createdByUserId: 'user_demo',
      revision: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.webhooks.push(endpoint);
    return {
      endpoint: clone(endpoint),
      endpointUrl: `https://api.arden.example/api/v1/webhooks/tok_once_${endpoint.id}`,
      endpointToken: `tok_once_${endpoint.id}`,
      signingSecret: body.signingSecret ? `sig_once_${endpoint.id}` : null,
    };
  }

  async getWebhookEndpoint(webhookEndpointId: string): Promise<WebhookEndpoint> {
    return clone(this.webhooks.find((w) => w.id === webhookEndpointId) ?? notFound('Endpoint'));
  }

  async updateWebhookEndpoint(
    webhookEndpointId: string,
    body: UpdateWebhookEndpointRequest,
  ): Promise<WebhookEndpoint> {
    const ep = this.webhooks.find((w) => w.id === webhookEndpointId) ?? notFound('Endpoint');
    if (body.expectedRevision !== ep.revision) conflict();
    Object.assign(ep, { key: body.key ?? ep.key, revision: ep.revision + 1 });
    return clone(ep);
  }

  async suspendWebhookEndpoint(webhookEndpointId: string, body: WebhookCommandRequest): Promise<WebhookEndpoint> {
    const ep = this.webhooks.find((w) => w.id === webhookEndpointId) ?? notFound('Endpoint');
    if (body.expectedRevision !== ep.revision) conflict();
    ep.status = 'SUSPENDED';
    ep.revision += 1;
    return clone(ep);
  }

  async reactivateWebhookEndpoint(
    webhookEndpointId: string,
    body: WebhookCommandRequest,
  ): Promise<WebhookEndpoint> {
    const ep = this.webhooks.find((w) => w.id === webhookEndpointId) ?? notFound('Endpoint');
    if (body.expectedRevision !== ep.revision) conflict();
    ep.status = 'ACTIVE';
    ep.revision += 1;
    return clone(ep);
  }

  async revokeWebhookEndpoint(webhookEndpointId: string, body: WebhookCommandRequest): Promise<WebhookEndpoint> {
    const ep = this.webhooks.find((w) => w.id === webhookEndpointId) ?? notFound('Endpoint');
    if (body.expectedRevision !== ep.revision) conflict();
    ep.status = 'REVOKED';
    ep.revision += 1;
    return clone(ep);
  }
}
