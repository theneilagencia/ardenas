/**
 * Arden.AS — compatibilidade do cliente v1 com conectores (ARDEN-BE-006.2).
 * Prova que os tipos do contrato bastam para tipar um cliente das rotas de
 * catálogo, conexões, credenciais, tool bindings e webhooks. Sem servidor.
 */

import { describe, expect, it } from 'vitest';
import type { ArdenApiV1Client } from './api-v1-client';
import type {
  ConnectorDefinition,
  Connection,
  CredentialMetadata,
  OrganizationToolBinding,
  OperationToolBinding,
  WebhookEndpoint,
  WebhookEndpointSecret,
} from '@/contracts';

const connector: ConnectorDefinition = {
  id: 'cd_1', key: 'system.http', version: '1', name: 'HTTP', description: null, category: 'HTTP',
  status: 'ACTIVE', systemManaged: true, productionAllowed: true, configurationSchema: {}, credentialSchema: {},
  networkPolicyTemplate: {
    allowedProtocols: ['https'], allowedHosts: [], allowedPorts: [443], allowRedirects: false, maximumRedirects: 0,
    allowPrivateNetworks: false, allowLoopback: false, allowLinkLocal: false, maximumRequestBytes: 1024,
    maximumResponseBytes: 1024, timeoutMs: 15000,
  },
  capabilityKeys: ['http.request'], createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};
const conn: Connection = {
  id: 'conn_1', organizationId: 'org_1', connectorDefinitionId: 'cd_1', connectorKey: 'system.http', connectorVersion: '1',
  name: 'X', description: null, status: 'ACTIVE', configuration: {}, networkPolicy: connector.networkPolicyTemplate,
  currentCredentialVersionId: null, lastTestedAt: null, lastTestStatus: 'NOT_TESTED', lastErrorCode: null,
  lastErrorSummary: null, createdByUserId: 'user_1', revision: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};
const cred: CredentialMetadata = {
  id: 'cred_1', organizationId: 'org_1', connectionId: 'conn_1', versionNumber: 1, status: 'ACTIVE',
  fingerprint: 'fp', keyVersion: 'v1', createdByUserId: 'user_1', createdAt: '2026-08-01T00:00:00.000Z',
  activatedAt: null, supersededAt: null, revokedAt: null,
};
const binding: OrganizationToolBinding = {
  id: 'b_1', organizationId: 'org_1', connectionId: 'conn_1', connectorToolDefinitionId: 'ctd_1',
  connectorToolKey: 'http.request', connectorToolVersion: '1', name: 'B', enabled: true,
  configurationOverrides: {}, policyOverrides: {}, createdByUserId: 'user_1', revision: 1,
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};
const opBinding: OperationToolBinding = {
  id: 'ob_1', organizationId: 'org_1', operationId: 'op_1', operationVersionId: null, organizationToolBindingId: 'b_1',
  alias: 'call', enabled: true, allowedActionKeys: ['external.http.request'], inputMapping: {}, outputMapping: {},
  createdByUserId: 'user_1', revision: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};
const endpoint: WebhookEndpoint = {
  id: 'we_1', organizationId: 'org_1', connectionId: 'conn_1', key: 'k', status: 'ACTIVE', signatureScheme: 'HMAC_SHA256',
  signatureRequired: true, replayWindowSeconds: 300, allowedEventTypes: [], operationId: null, operationVersionId: null,
  createdByUserId: 'user_1', revision: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};
const created: WebhookEndpointSecret = { endpoint, endpointToken: 'tok_once', signingSecret: 'sig_once' };

function fakeClient(): ArdenApiV1Client {
  const client = {
    listConnectors: async () => [connector],
    getConnector: async () => connector,
    listConnectorTools: async () => [],
    listConnections: async () => ({ data: [conn], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } }),
    createConnection: async () => conn,
    testConnection: async () => ({ status: 'SUCCESS' as const, checkedAt: '2026-08-01T00:00:00.000Z', latencyMs: 12, credentialFingerprint: 'fp', errorCode: null, errorSummary: null }),
    revokeConnection: async () => ({ ...conn, status: 'REVOKED' as const }),
    listCredentials: async () => ({ data: [cred], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } }),
    createCredential: async () => cred,
    rotateCredential: async () => ({ ...cred, versionNumber: 2 }),
    createToolBinding: async () => binding,
    listOperationToolBindings: async () => [opBinding],
    createWebhookEndpoint: async () => created,
  } as Partial<ArdenApiV1Client>;
  return client as ArdenApiV1Client;
}

describe('cliente v1 ↔ conectores', () => {
  it('tipa catálogo, conexões e credenciais', async () => {
    const c = fakeClient();
    expect((await c.listConnectors())[0].key).toBe('system.http');
    expect((await c.listConnections('org_1', { limit: 50 })).data[0].status).toBe('ACTIVE');
    expect((await c.testConnection('org_1', 'conn_1', {}, { idempotencyKey: 'k12345678' })).status).toBe('SUCCESS');
    expect((await c.rotateCredential('org_1', 'conn_1', { secret: { token: 'x' } }, { idempotencyKey: 'k12345678' })).versionNumber).toBe(2);
  });
  it('tipa tool bindings e webhooks (segredo só uma vez)', async () => {
    const c = fakeClient();
    expect((await c.createToolBinding('org_1', { connectionId: 'conn_1', connectorToolKey: 'http.request', connectorToolVersion: '1', name: 'B' }, { idempotencyKey: 'k12345678' })).enabled).toBe(true);
    expect((await c.listOperationToolBindings('org_1', 'op_1'))[0].alias).toBe('call');
    const w = await c.createWebhookEndpoint('org_1', { connectionId: 'conn_1', key: 'k' }, { idempotencyKey: 'k12345678' });
    expect(w.endpointToken).toBe('tok_once');
  });
});
