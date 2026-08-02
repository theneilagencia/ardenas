/**
 * Arden.AS — testes do repositório de conectores v1 (ARDEN-BE-006.8).
 * Cliente v1 falso: prova que list/create/test/activate repassam para o cliente,
 * que a chave de idempotência é enviada em toda escrita e que erros são
 * normalizados para `ArdenRepositoryError`.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { ArdenApiV1Client } from './generated/api-v1-client';
import { createApiV1ConnectorsRepository } from './v1-connectors-repository';
import { setActiveOrganizationId } from '@/services/session/active-context';
import { ArdenApiError } from '@/services/api-client';
import type { Connection, ConnectorDefinition, WebhookEndpointSecret } from '@/contracts';

const ORG = 'org-1';

function connector(): ConnectorDefinition {
  return {
    id: 'cd_1',
    key: 'system.http',
    version: '1',
    name: 'HTTP',
    description: null,
    category: 'HTTP',
    status: 'ACTIVE',
    systemManaged: true,
    productionAllowed: true,
    configurationSchema: {},
    credentialSchema: {},
    networkPolicyTemplate: {
      allowedProtocols: ['https'],
      allowedHosts: [],
      allowedPorts: [443],
      allowRedirects: false,
      maximumRedirects: 0,
      allowPrivateNetworks: false,
      allowLoopback: false,
      allowLinkLocal: false,
      maximumRequestBytes: 1024,
      maximumResponseBytes: 1024,
      timeoutMs: 15000,
    },
    capabilityKeys: ['http.request'],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function connection(over: Partial<Connection> = {}): Connection {
  return {
    id: 'conn_1',
    organizationId: ORG,
    connectorDefinitionId: 'cd_1',
    connectorKey: 'system.http',
    connectorVersion: '1',
    name: 'X',
    description: null,
    status: 'ACTIVE',
    configuration: {},
    networkPolicy: connector().networkPolicyTemplate,
    currentCredentialVersionId: null,
    lastTestedAt: null,
    lastTestStatus: 'NOT_TESTED',
    lastErrorCode: null,
    lastErrorSummary: null,
    createdByUserId: 'user_1',
    revision: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

interface Calls {
  createConnection: unknown[];
  testConnection: unknown[];
  activateConnection: unknown[];
}

function fakeClient(calls: Calls): ArdenApiV1Client {
  const stub = {} as ArdenApiV1Client;
  return Object.assign(stub, {
    listConnectors: async () => [connector()],
    listConnections: async () => ({
      data: [connection()],
      pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 },
    }),
    createConnection: async (_o: string, body: unknown, opts: { idempotencyKey: string }) => {
      calls.createConnection.push({ body, idempotencyKey: opts.idempotencyKey });
      return connection();
    },
    testConnection: async (_o: string, _c: string, body: unknown, opts: { idempotencyKey: string }) => {
      calls.testConnection.push({ body, idempotencyKey: opts.idempotencyKey });
      return {
        status: 'SUCCESS' as const,
        checkedAt: '2026-08-01T00:00:00.000Z',
        latencyMs: 12,
        credentialFingerprint: 'fp',
        errorCode: null,
        errorSummary: null,
      };
    },
    activateConnection: async (_o: string, _c: string, body: unknown, opts: { idempotencyKey: string }) => {
      calls.activateConnection.push({ body, idempotencyKey: opts.idempotencyKey });
      return connection({ status: 'ACTIVE', revision: 2 });
    },
    createWebhookEndpoint: async (): Promise<WebhookEndpointSecret> => {
      throw new ArdenApiError(404, { code: 'NOT_FOUND', message: 'x' });
    },
  } as Partial<ArdenApiV1Client>);
}

beforeEach(() => setActiveOrganizationId(ORG));

describe('createApiV1ConnectorsRepository', () => {
  it('listConnectors repassa o catálogo do cliente', async () => {
    const repo = createApiV1ConnectorsRepository(fakeClient({ createConnection: [], testConnection: [], activateConnection: [] }));
    const list = await repo.listConnectors();
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe('system.http');
  });

  it('listConnections mapeia a página por cursor', async () => {
    const repo = createApiV1ConnectorsRepository(fakeClient({ createConnection: [], testConnection: [], activateConnection: [] }));
    const page = await repo.listConnections();
    expect(page.items).toHaveLength(1);
    expect(page.hasNextPage).toBe(false);
    expect(page.cursor).toBeNull();
  });

  it('createConnection envia uma chave de idempotência opaca', async () => {
    const calls: Calls = { createConnection: [], testConnection: [], activateConnection: [] };
    const repo = createApiV1ConnectorsRepository(fakeClient(calls));
    await repo.createConnection({ connectorKey: 'system.http', connectorVersion: '1', name: 'X' });
    expect(calls.createConnection).toHaveLength(1);
    const key = (calls.createConnection[0] as { idempotencyKey: string }).idempotencyKey;
    expect(key.length).toBeGreaterThanOrEqual(8);
  });

  it('testConnection e activateConnection enviam chave de idempotência própria a cada chamada', async () => {
    const calls: Calls = { createConnection: [], testConnection: [], activateConnection: [] };
    const repo = createApiV1ConnectorsRepository(fakeClient(calls));
    await repo.testConnection('conn_1');
    await repo.activateConnection('conn_1', { expectedRevision: 1 });
    const testKey = (calls.testConnection[0] as { idempotencyKey: string }).idempotencyKey;
    const activateKey = (calls.activateConnection[0] as { idempotencyKey: string }).idempotencyKey;
    expect(testKey).not.toBe(activateKey);
  });

  it('normaliza erros HTTP em ArdenRepositoryError', async () => {
    const repo = createApiV1ConnectorsRepository(fakeClient({ createConnection: [], testConnection: [], activateConnection: [] }));
    await expect(repo.createWebhookEndpoint({ connectionId: 'conn_1', key: 'k' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('sem organização ativa lança erro tipado (sem fallback)', async () => {
    setActiveOrganizationId(null);
    const repo = createApiV1ConnectorsRepository(fakeClient({ createConnection: [], testConnection: [], activateConnection: [] }));
    await expect(repo.listConnections()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});
