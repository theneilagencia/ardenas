/**
 * Arden.AS — testes do repositório de agentes v1 (ARDEN-BE-007.7).
 * Cliente v1 falso: prova que leituras/escritas repassam ao cliente, que a chave de
 * idempotência é enviada e FRESCA por ação em toda escrita, que `requireOrg` exige
 * organização ativa e que erros são normalizados para `ArdenRepositoryError`.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { ArdenApiV1Client, ClientPage } from './generated/api-v1-client';
import { createApiV1AgentsRepository } from './v1-agents-repository';
import { setActiveOrganizationId } from '@/services/session/active-context';
import { ArdenApiError } from '@/services/api-client';
import { ArdenRepositoryError } from '@/services/errors';
import { makeAgent, makeConfig, makeResult, makeVersion } from '@/features/agents/fake-agents-repository';

const ORG = 'org-1';
const emptyPage = <T>(items: T[]): ClientPage<T> => ({ data: items, pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } });

interface Recorded { method: string; opts?: { idempotencyKey?: string } }

class FakeClient {
  calls: Recorded[] = [];
  private rec(method: string, opts?: { idempotencyKey?: string }) { this.calls.push({ method, opts }); }
  idemKeys() { return this.calls.filter((c) => c.opts?.idempotencyKey).map((c) => c.opts!.idempotencyKey!); }

  async listAgents() { this.rec('listAgents'); return emptyPage([makeAgent()]); }
  async getAgent() { this.rec('getAgent'); return makeAgent(); }
  async createAgent(_o: string, _b: unknown, opts: { idempotencyKey: string }) { this.rec('createAgent', opts); return makeAgent(); }
  async suspendAgent(_o: string, _a: string, _b: unknown, opts: { idempotencyKey: string }) { this.rec('suspendAgent', opts); return makeAgent({ status: 'SUSPENDED' }); }
  async reactivateAgent(_o: string, _a: string, _b: unknown, opts: { idempotencyKey: string }) { this.rec('reactivateAgent', opts); return makeAgent(); }
  async revokeAgent(_o: string, _a: string, _b: unknown, opts: { idempotencyKey: string }) { this.rec('revokeAgent', opts); return makeAgent({ status: 'REVOKED' }); }
  async updateAgent() { this.rec('updateAgent'); return makeAgent(); }

  async listAgentVersions() { this.rec('listAgentVersions'); return emptyPage([makeVersion()]); }
  async createAgentVersion(_o: string, _a: string, _b: unknown, opts: { idempotencyKey: string }) { this.rec('createAgentVersion', opts); return makeVersion({ status: 'DRAFT' }); }
  async publishAgentVersion(_o: string, _a: string, _v: string, _b: unknown, opts: { idempotencyKey: string }) { this.rec('publishAgentVersion', opts); return makeVersion(); }
  async retireAgentVersion(_o: string, _a: string, _v: string, _b: unknown, opts: { idempotencyKey: string }) { this.rec('retireAgentVersion', opts); return makeVersion({ status: 'RETIRED' }); }

  async listModelConfigurations() { this.rec('listModelConfigurations'); return emptyPage([makeConfig()]); }
  async createModelConfiguration(_o: string, _b: unknown, opts: { idempotencyKey: string }) { this.rec('createModelConfiguration', opts); return makeConfig(); }
  async activateModelConfiguration(_o: string, _c: string, _b: unknown, opts: { idempotencyKey: string }) { this.rec('activateModelConfiguration', opts); return makeConfig(); }

  async listAgentResults() { this.rec('listAgentResults'); return emptyPage([makeResult()]); }
  async getAgentUsage() { this.rec('getAgentUsage'); return []; }
  async getExecutionAgentUsage() { this.rec('getExecutionAgentUsage'); return { executionRunId: 'run1', results: [makeResult()] }; }
}

function repo(client: FakeClient) {
  return createApiV1AgentsRepository(client as unknown as ArdenApiV1Client);
}

beforeEach(() => setActiveOrganizationId(ORG));

describe('v1-agents-repository — idempotência e tenant', () => {
  it('leituras repassam ao cliente e devolvem CursorPage', async () => {
    const client = new FakeClient();
    const page = await repo(client).listAgents();
    expect(page.items.length).toBe(1);
    expect(page.hasNextPage).toBe(false);
  });

  it('toda escrita envia Idempotency-Key', async () => {
    const client = new FakeClient();
    const r = repo(client);
    await r.createAgent({ key: 'k', name: 'n' });
    await r.suspendAgent('ag1', { expectedRevision: 1 });
    await r.createAgentVersion('ag1', {});
    await r.publishAgentVersion('ag1', 'v1', { expectedRevision: 1, changeSummary: 's' });
    await r.createModelConfiguration({ providerKey: 'internal.test-model', providerVersion: '1', name: 'c', modelId: 'test/structured-success', parameters: { maximumOutputTokens: 512 } });
    const keys = client.idemKeys();
    expect(keys.length).toBe(5);
    // Chaves opacas, com prefixo, e FRESCAS (todas distintas).
    expect(keys.every((k) => k.startsWith('agent-'))).toBe(true);
    expect(new Set(keys).size).toBe(5);
  });

  it('sem organização ativa → ArdenRepositoryError(UNAVAILABLE)', async () => {
    setActiveOrganizationId(null);
    await expect(repo(new FakeClient()).listAgents()).rejects.toBeInstanceOf(ArdenRepositoryError);
  });

  it('erro do cliente é normalizado para ArdenRepositoryError', async () => {
    const client = new FakeClient();
    client.listAgents = async () => { throw new ArdenApiError(500, { code: 'X', message: 'boom' }); };
    await expect(repo(client).listAgents()).rejects.toBeInstanceOf(ArdenRepositoryError);
  });

  it('getExecutionAgentUsage devolve apenas os resultados', async () => {
    const client = new FakeClient();
    const results = await repo(client).getExecutionAgentUsage('run1');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);
  });
});
