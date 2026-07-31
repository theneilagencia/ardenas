/**
 * Arden.AS — testes do repositório de operações v1 (ARDEN-BE-003).
 * Cliente v1 falso: prova o mapeamento rico↔lean, que a definição é escrita no
 * rascunho e que campos ricos sem correspondência recebem DEFAULT NEUTRO (o
 * adapter NÃO inventa conteúdo).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { ArdenApiV1Client } from './generated/api-v1-client';
import { createApiV1OperationsRepository } from './v1-operations-repository';
import { setActiveOrganizationId } from '@/services/session/active-context';
import type { Operation as ApiOperation, OperationVersion as ApiOperationVersion } from '@/contracts';

const ORG = 'org-1';

function apiOperation(over: Partial<ApiOperation> = {}): ApiOperation {
  return {
    id: 'op-1',
    organizationId: ORG,
    name: 'Op',
    description: null,
    status: 'draft',
    currentDraftVersionId: 'v-1',
    publishedVersionId: null,
    ownerId: null,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
    ...over,
  };
}

function apiVersion(over: Partial<ApiOperationVersion> = {}): ApiOperationVersion {
  return {
    id: 'v-1',
    operationId: 'op-1',
    organizationId: ORG,
    versionNumber: 1,
    status: 'draft',
    definition: {
      objective: 'obj', expectedResult: 'res', triggers: ['t'], steps: [], actions: [],
      approverIds: [], contextSourceIds: [], integrationIds: [], completionCriteria: [],
      environment: 'production', evidencePolicy: null,
    },
    authorityProfile: { level: 1, allowedActions: [], approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false },
    changeSummary: null,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedBy: null,
    publishedAt: null,
    revision: 1,
    ...over,
  };
}

interface Calls { updateVersion: unknown[]; updateAuthority: unknown[] }

function fakeClient(calls: Calls): ArdenApiV1Client {
  const stub = {} as ArdenApiV1Client;
  return Object.assign(stub, {
    createOperation: async () => apiOperation(),
    getOperation: async () => apiOperation(),
    getOperationVersion: async () => apiVersion(),
    updateOperationVersion: async (_o: string, _op: string, _v: string, body: unknown) => {
      calls.updateVersion.push(body);
      return apiVersion({ revision: 2 });
    },
    updateAuthorityProfile: async (_o: string, _op: string, _v: string, body: unknown) => {
      calls.updateAuthority.push(body);
      return apiVersion({ revision: 3 });
    },
  } as Partial<ArdenApiV1Client>);
}

beforeEach(() => setActiveOrganizationId(ORG));

describe('createApiV1OperationsRepository', () => {
  it('getById mescla a definição da versão na operação rica', async () => {
    const repo = createApiV1OperationsRepository(fakeClient({ updateVersion: [], updateAuthority: [] }));
    const op = await repo.getById('op-1');
    expect(op.objective).toBe('obj');
    expect(op.expectedResult).toBe('res');
    expect(op.triggers).toEqual(['t']);
    expect(op.environment).toBe('production');
  });

  it('campos ricos sem correspondência no v1 recebem default neutro (não inventa)', async () => {
    const repo = createApiV1OperationsRepository(fakeClient({ updateVersion: [], updateAuthority: [] }));
    const op = await repo.getById('op-1');
    expect(op.criticality).toBe('moderate');
    expect(op.budget).toBe(0);
    expect(op.problem).toBe('');
    expect(op.indicators).toEqual([]);
  });

  it('create escreve a definição e o Gradiente no primeiro rascunho', async () => {
    const calls: Calls = { updateVersion: [], updateAuthority: [] };
    const repo = createApiV1OperationsRepository(fakeClient(calls));
    await repo.create({
      objective: 'novo objetivo', expectedResult: 'novo resultado',
      name: 'Nova', triggers: [], steps: [], actions: [],
    } as unknown as Parameters<typeof repo.create>[0]);
    expect(calls.updateVersion).toHaveLength(1);
    expect((calls.updateVersion[0] as { definition: { objective: string } }).definition.objective).toBe('novo objetivo');
    expect(calls.updateAuthority).toHaveLength(1);
  });

  it('sem organização ativa lança erro tipado (sem fallback)', async () => {
    setActiveOrganizationId(null);
    const repo = createApiV1OperationsRepository(fakeClient({ updateVersion: [], updateAuthority: [] }));
    await expect(repo.getById('op-1')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});
