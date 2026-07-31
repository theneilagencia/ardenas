/**
 * Arden.AS — compatibilidade do cliente v1 com os repositórios (ARDEN-FE-003).
 * Prova, em runtime, que os tipos do contrato bastam para implementar
 * SessionRepository / AuditRepository / OperationsRepository (leitura).
 */

import { describe, expect, it } from 'vitest';
import type { ArdenApiV1Client } from './api-v1-client';
import {
  createApiV1SessionRepository,
  createApiV1AuditRepository,
  createApiV1OperationsRepository,
  mapSessionToDomain,
} from './repository-compat';
import type { SessionContext as ApiSessionContext, Operation as ApiOperation, AuditEvent as ApiAuditEvent } from '@/contracts';

const apiSession: ApiSessionContext = {
  user: { id: 'user_1', email: 'a@b.com', displayName: 'A', status: 'active' },
  organizations: [{ id: 'org_1', name: 'Org', slug: 'org', status: 'active' }],
  memberships: [{ id: 'm1', userId: 'user_1', organizationId: 'org_1', roleIds: ['operation_owner'], status: 'active' }],
  activeOrganizationId: 'org_1',
  permissions: ['operation.view', 'operation.create'],
  expiresAt: '2026-07-31T12:00:00.000Z',
  status: 'authenticated',
};

const apiOperation: ApiOperation = {
  id: 'op_1',
  organizationId: 'org_1',
  name: 'Fechamento',
  description: null,
  status: 'active',
  currentDraftVersionId: null,
  publishedVersionId: 'ver_1',
  ownerId: 'user_1',
  createdBy: 'user_1',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  revision: 3,
};

const apiAuditEvent: ApiAuditEvent = {
  id: 'aud_1',
  organizationId: 'org_1',
  actor: { id: 'user_1', type: 'user', role: 'operation_owner', displayName: 'A' },
  action: 'operation.publish',
  resourceType: 'Operation',
  resourceId: 'op_1',
  occurredAt: '2026-07-02T00:00:00.000Z',
  correlationId: 'req_1',
  source: 'user',
  before: { status: 'draft' },
  after: { status: 'active' },
  metadata: {},
};

function fakeClient(): ArdenApiV1Client {
  const client = {
    getSession: async () => apiSession,
    refreshSession: async () => apiSession,
    switchOrganization: async () => apiSession,
    logout: async () => {},
    listOperations: async () => ({ data: [apiOperation], pagination: { nextCursor: null, hasNextPage: false, limit: 50 } }),
    listAuditEvents: async () => ({ data: [apiAuditEvent], pagination: { nextCursor: null, hasNextPage: false, limit: 50 } }),
  } as Partial<ArdenApiV1Client>;
  return client as ArdenApiV1Client;
}

describe('cliente v1 ↔ repositórios do frontend', () => {
  it('implementa SessionRepository (mapeando SessionContext do contrato)', async () => {
    const repo = createApiV1SessionRepository(fakeClient());
    const session = await repo.getCurrentSession();
    expect(session?.activeOrganizationId).toBe('org_1');
    expect(session?.permissions).toContain('operation.create');
    expect(session?.user.email).toBe('a@b.com');
  });

  it('mapSessionToDomain descarta o status do contrato e preserva os campos do domínio', () => {
    const domain = mapSessionToDomain(apiSession);
    expect('status' in domain).toBe(false);
    expect(domain.memberships[0].organizationId).toBe('org_1');
  });

  it('implementa AuditRepository (leitura) mapeando AuditEvent do contrato', async () => {
    const repo = createApiV1AuditRepository(fakeClient());
    const events = await repo.list({ organizationId: 'org_1' });
    expect(events[0].objectType).toBe('Operation');
    expect(events[0].timestamp).toBe('2026-07-02T00:00:00.000Z');
    expect(events[0].actorId).toBe('user_1');
  });

  it('implementa OperationsRepository (listagem) mapeando Operation lean → rica', async () => {
    const repo = createApiV1OperationsRepository(fakeClient());
    const page = await repo.list({ organizationId: 'org_1' });
    expect(page.items[0].id).toBe('op_1');
    expect(page.items[0].status).toBe('running'); // active → running
  });
});
