/**
 * Arden.AS — CATÁLOGO CANÔNICO de conectores (ARDEN-BE-006).
 *
 * Fonte única EM CÓDIGO (alternativa híbrida aprovada): conectores e ferramentas de
 * referência, validados pelos schemas canônicos no carregamento do módulo. A
 * projeção idempotente para o banco (seed) é preparada aqui como função PURA — sem
 * persistência nesta fase. Sem código dinâmico: tudo é dado tipado e validado.
 */

import type { ConnectorDefinitionCanonical } from './connector-definition.schema';
import { connectorDefinitionCanonical } from './connector-definition.schema';
import type { ConnectorToolDefinitionCanonical } from './connector-tool-definition.schema';
import { connectorToolDefinitionCanonical } from './connector-tool-definition.schema';
import { PRODUCTION_NETWORK_POLICY_DEFAULTS } from './network-policy.schema';
import type { JsonSchemaContract } from './connector-keys';

// ── Schemas JSON de referência (documentos serializáveis; sem código) ───────────
const emptyObjectSchema: JsonSchemaContract = { type: 'object', additionalProperties: false, properties: {} };

const httpConfigSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  required: ['baseUrl'],
  properties: {
    baseUrl: { type: 'string', description: 'Base URL fixa (https). Requests escolhem apenas path/método.' },
    defaultHeaders: { type: 'object', additionalProperties: { type: 'string' } },
  },
};

const httpCredentialSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  required: ['scheme'],
  properties: {
    scheme: { type: 'string', enum: ['NONE', 'BEARER_TOKEN', 'API_KEY_HEADER', 'BASIC_AUTH'] },
    token: { type: 'string', writeOnly: true, description: 'Sensível (BEARER_TOKEN/API_KEY_HEADER).' },
    headerName: { type: 'string' },
    username: { type: 'string' },
    password: { type: 'string', writeOnly: true, description: 'Sensível (BASIC_AUTH).' },
  },
};

const httpRequestInputSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  required: ['method'],
  properties: {
    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    path: { type: 'string' },
    headers: { type: 'object', additionalProperties: { type: 'string' } },
    query: { type: 'object', additionalProperties: { type: 'string' } },
    body: {},
    idempotencyKey: { type: 'string' },
  },
};

const httpRequestOutputSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'integer' },
    headers: { type: 'object', additionalProperties: { type: 'string' } },
    body: {},
  },
};

const webhookConfigSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  required: ['endpointUrl'],
  properties: {
    endpointUrl: { type: 'string', description: 'Endpoint fixo de saída (https).' },
    signPayload: { type: 'boolean' },
  },
};

const webhookCredentialSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  properties: {
    signingSecret: { type: 'string', writeOnly: true, description: 'Sensível (HMAC).' },
  },
};

const webhookSendInputSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  required: ['event'],
  properties: {
    event: { type: 'string' },
    payload: {},
    idempotencyKey: { type: 'string' },
  },
};

const webhookSendOutputSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  properties: { status: { type: 'integer' }, delivered: { type: 'boolean' } },
};

// ── Anthropic (ARDEN-BE-008.2): conector system-managed do provider de modelo ────
// Credencial write-only (apiKey); configuração NÃO sensível com base URL travada em
// OFFICIAL. Nenhuma ferramenta de geração é exposta. Espelha `anthropic-credential.
// schema.ts` e `anthropic-connection.schema.ts` (contratos 008.1) como documento JSON.
const anthropicCredentialJsonSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  required: ['apiKey'],
  properties: {
    apiKey: {
      type: 'string',
      writeOnly: true,
      minLength: 1,
      maxLength: 512,
      description: 'API key da Anthropic (sensível; armazenada apenas no SecretVault).',
    },
  },
};

const anthropicConfigurationJsonSchema: JsonSchemaContract = {
  type: 'object',
  additionalProperties: false,
  required: ['baseUrlMode', 'timeoutMs', 'maximumRetries'],
  properties: {
    baseUrlMode: {
      type: 'string',
      enum: ['OFFICIAL'],
      description: 'Somente a base URL oficial da Anthropic. Sem override arbitrário.',
    },
    timeoutMs: { type: 'integer', minimum: 1000, maximum: 120000 },
    maximumRetries: { type: 'integer', minimum: 0, maximum: 5 },
  },
};

// ── Conectores canônicos ────────────────────────────────────────────────────────
const RAW_CONNECTORS: ConnectorDefinitionCanonical[] = [
  {
    key: 'system.http',
    version: '1',
    name: 'HTTP REST (controlado)',
    description: 'Cliente HTTP REST genérico com allowlist, método validado e política de rede.',
    category: 'HTTP',
    status: 'ACTIVE',
    systemManaged: true,
    productionAllowed: true,
    configurationSchema: httpConfigSchema,
    credentialSchema: httpCredentialSchema,
    networkPolicyTemplate: PRODUCTION_NETWORK_POLICY_DEFAULTS,
    capabilityKeys: ['http.request', 'http.get', 'http.post', 'http.put', 'http.patch', 'http.delete'],
  },
  {
    key: 'system.webhook',
    version: '1',
    name: 'Webhook de saída',
    description: 'Envio assinado para um endpoint fixo, com idempotency-key e timeout.',
    category: 'WEBHOOK',
    status: 'ACTIVE',
    systemManaged: true,
    productionAllowed: true,
    configurationSchema: webhookConfigSchema,
    credentialSchema: webhookCredentialSchema,
    networkPolicyTemplate: PRODUCTION_NETWORK_POLICY_DEFAULTS,
    capabilityKeys: ['webhook.send'],
  },
  {
    key: 'internal.test',
    version: '1',
    name: 'Conector determinístico de teste',
    description: 'Echo/falha/timeout determinísticos para testes. Proibido em produção.',
    category: 'INTERNAL_TEST',
    status: 'ACTIVE',
    systemManaged: true,
    productionAllowed: false,
    configurationSchema: emptyObjectSchema,
    credentialSchema: emptyObjectSchema,
    networkPolicyTemplate: PRODUCTION_NETWORK_POLICY_DEFAULTS,
    capabilityKeys: ['connector.test.echo', 'connector.test.failure', 'connector.test.timeout'],
  },
  {
    key: 'system.anthropic',
    version: '1',
    name: 'Anthropic',
    description:
      'Conector system-managed do provider Anthropic (API direta). Guarda a credencial ' +
      'tenant-managed (API key) no SecretVault. Sem ferramenta de geração — o modelo é ' +
      'executado pelo ModelProvider em fase futura. Provider ainda DISABLED (CONTRACT_ONLY).',
    category: 'MODEL_PROVIDER',
    status: 'ACTIVE',
    systemManaged: true,
    productionAllowed: true,
    configurationSchema: anthropicConfigurationJsonSchema,
    credentialSchema: anthropicCredentialJsonSchema,
    networkPolicyTemplate: PRODUCTION_NETWORK_POLICY_DEFAULTS,
    capabilityKeys: [],
  },
];

// ── Ferramentas canônicas ───────────────────────────────────────────────────────
const RAW_TOOLS: ConnectorToolDefinitionCanonical[] = [
  {
    connectorKey: 'system.http',
    connectorVersion: '1',
    key: 'http.request',
    version: '1',
    name: 'HTTP request',
    description: 'Requisição HTTP com método validado e política de rede aplicada.',
    actionKey: 'external.http.request',
    inputSchema: httpRequestInputSchema,
    outputSchema: httpRequestOutputSchema,
    riskLevel: 'WRITE',
    idempotencyMode: 'OPTIONAL',
    retryMode: 'CONDITIONAL',
    defaultTimeoutMs: 15_000,
    maximumTimeoutMs: 60_000,
    active: true,
  },
  {
    connectorKey: 'system.webhook',
    connectorVersion: '1',
    key: 'webhook.send',
    version: '1',
    name: 'Webhook send',
    description: 'Envio assinado de webhook para endpoint fixo (idempotente).',
    actionKey: 'external.webhook.send',
    inputSchema: webhookSendInputSchema,
    outputSchema: webhookSendOutputSchema,
    riskLevel: 'WRITE',
    idempotencyMode: 'REQUIRED',
    retryMode: 'SAFE',
    defaultTimeoutMs: 15_000,
    maximumTimeoutMs: 60_000,
    active: true,
  },
  {
    connectorKey: 'internal.test',
    connectorVersion: '1',
    key: 'test.echo',
    version: '1',
    name: 'Test echo',
    description: 'Ecoa a entrada (determinístico).',
    actionKey: 'connector.test.echo',
    inputSchema: { type: 'object', additionalProperties: true },
    outputSchema: { type: 'object', additionalProperties: true },
    riskLevel: 'READ',
    idempotencyMode: 'NONE',
    retryMode: 'SAFE',
    defaultTimeoutMs: 5_000,
    maximumTimeoutMs: 10_000,
    active: true,
  },
  {
    connectorKey: 'internal.test',
    connectorVersion: '1',
    key: 'test.failure',
    version: '1',
    name: 'Test failure',
    description: 'Falha determinística (para testes de retry/erro).',
    actionKey: 'connector.test.failure',
    inputSchema: { type: 'object', additionalProperties: true },
    outputSchema: { type: 'object', additionalProperties: false, properties: {} },
    riskLevel: 'READ',
    idempotencyMode: 'NONE',
    retryMode: 'NEVER',
    defaultTimeoutMs: 5_000,
    maximumTimeoutMs: 10_000,
    active: true,
  },
  {
    connectorKey: 'internal.test',
    connectorVersion: '1',
    key: 'test.timeout',
    version: '1',
    name: 'Test timeout',
    description: 'Timeout determinístico (para testes de timeout).',
    actionKey: 'connector.test.timeout',
    inputSchema: { type: 'object', additionalProperties: true },
    outputSchema: { type: 'object', additionalProperties: false, properties: {} },
    riskLevel: 'READ',
    idempotencyMode: 'NONE',
    retryMode: 'NEVER',
    defaultTimeoutMs: 1_000,
    maximumTimeoutMs: 2_000,
    active: true,
  },
  {
    connectorKey: 'internal.test',
    connectorVersion: '1',
    key: 'test.write',
    version: '1',
    name: 'Test write',
    description: 'Escrita determinística (ecoa a entrada; classificada como WRITE para autoridade de agente).',
    actionKey: 'connector.test.write',
    inputSchema: { type: 'object', additionalProperties: true },
    outputSchema: { type: 'object', additionalProperties: true },
    riskLevel: 'WRITE',
    idempotencyMode: 'NONE',
    retryMode: 'CONDITIONAL',
    defaultTimeoutMs: 5_000,
    maximumTimeoutMs: 10_000,
    active: true,
  },
  {
    connectorKey: 'internal.test',
    connectorVersion: '1',
    key: 'test.unknown',
    version: '1',
    name: 'Test unknown',
    description: 'Resultado incerto determinístico (não idempotente; para testes de UNKNOWN).',
    actionKey: 'connector.test.unknown',
    inputSchema: { type: 'object', additionalProperties: true },
    outputSchema: { type: 'object', additionalProperties: true },
    riskLevel: 'WRITE',
    idempotencyMode: 'NONE',
    retryMode: 'NEVER',
    defaultTimeoutMs: 2_000,
    maximumTimeoutMs: 4_000,
    active: true,
  },
  {
    connectorKey: 'internal.test',
    connectorVersion: '1',
    key: 'test.inject',
    version: '1',
    name: 'Test inject',
    description: 'Retorna conteúdo com injeção + cabeçalho sensível (para testes de isolamento).',
    actionKey: 'connector.test.inject',
    inputSchema: { type: 'object', additionalProperties: true },
    outputSchema: { type: 'object', additionalProperties: true },
    riskLevel: 'READ',
    idempotencyMode: 'NONE',
    retryMode: 'SAFE',
    defaultTimeoutMs: 5_000,
    maximumTimeoutMs: 10_000,
    active: true,
  },
];

/**
 * Catálogo validado (parse no carregamento — falha rápido se algo violar as
 * invariantes: timeout, retry inseguro, actionKey/enum, etc.).
 */
export const CONNECTOR_DEFINITIONS: readonly ConnectorDefinitionCanonical[] = Object.freeze(
  RAW_CONNECTORS.map((c) => connectorDefinitionCanonical.parse(c)),
);
export const CONNECTOR_TOOLS: readonly ConnectorToolDefinitionCanonical[] = Object.freeze(
  RAW_TOOLS.map((t) => connectorToolDefinitionCanonical.parse(t)),
);

export function getConnectorDefinition(key: string, version: string): ConnectorDefinitionCanonical | undefined {
  return CONNECTOR_DEFINITIONS.find((c) => c.key === key && c.version === version);
}

export function getToolsForConnector(key: string, version: string): ConnectorToolDefinitionCanonical[] {
  return CONNECTOR_TOOLS.filter((t) => t.connectorKey === key && t.connectorVersion === version);
}

export interface CatalogProjection {
  definitions: readonly ConnectorDefinitionCanonical[];
  tools: readonly ConnectorToolDefinitionCanonical[];
}

/**
 * Projeção PURA do catálogo (para o seed idempotente da fase de persistência). NÃO
 * toca no banco — apenas retorna as linhas a serem projetadas, já validadas.
 */
export function projectConnectorCatalog(): CatalogProjection {
  return { definitions: CONNECTOR_DEFINITIONS, tools: CONNECTOR_TOOLS };
}
