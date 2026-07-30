import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api-client';
import { ApiOperationsRepository } from './operations-api';
import { SnapshotOperationsRepository } from './operations-snapshot';
import { MemorySnapshotStore } from '../data/snapshot-store';
import { buildSeed } from '@/domain/seed';

function res(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    json: async () => body,
  } as unknown as Response;
}

const BASE = 'https://api.exemplo.com/v1';
const client = () => new ApiClient({ baseUrl: BASE });

afterEach(() => vi.restoreAllMocks());

describe('ApiOperationsRepository (contrato HTTP)', () => {
  it('list mapeia envelope + meta para PaginatedResult', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res({ data: [{ id: 'op1' }, { id: 'op2' }], meta: { page: 2, pageSize: 2, total: 7 } })),
    );
    const page = await new ApiOperationsRepository(client()).list({ organizationId: 'o', page: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(7);
  });

  it('publishVersion chama POST /operations/:id/publish', async () => {
    const fetchMock = vi.fn(async () => res({ data: { id: 'op1', version: '1.0', status: 'scheduled' } }));
    vi.stubGlobal('fetch', fetchMock);
    const op = await new ApiOperationsRepository(client()).publishVersion('op1');
    expect(op.version).toBe('1.0');
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/operations/op1/publish`);
  });

  it('propaga erro HTTP como ArdenRepositoryError (409 → CONFLICT)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ code: 'x', message: 'no' }, 409)));
    await expect(new ApiOperationsRepository(client()).getById('op1')).rejects.toMatchObject({
      name: 'ArdenRepositoryError',
      code: 'CONFLICT',
    });
  });
});

describe('SnapshotOperationsRepository (contrato local, fluxo de prova)', () => {
  let store: MemorySnapshotStore;
  let repo: SnapshotOperationsRepository;

  beforeEach(() => {
    store = new MemorySnapshotStore(buildSeed());
    repo = new SnapshotOperationsRepository(store);
  });

  it('list filtra por organização e estado', async () => {
    const page = await repo.list({ organizationId: 'org_arden', status: 'running' });
    expect(page.items.every((o) => o.status === 'running')).toBe(true);
  });

  it('fluxo: criar rascunho → editar → criar versão → publicar → recuperar', async () => {
    const draft = await repo.create({
      ...(await repo.getById('op_fechamento')),
      id: 'op_proof',
      name: 'Prova',
      status: 'draft',
      version: '0.1',
      publishedAt: null,
    });
    expect(draft.status).toBe('draft');

    await repo.updateDraft('op_proof', { objective: 'Objetivo revisado' });
    await repo.createVersion('op_proof');
    const published = await repo.publishVersion('op_proof');
    expect(published.status).toBe('scheduled');
    expect(published.version).toBe('1.0');

    // Recupera pelo mesmo provider (nova instância de repositório sobre a store).
    const reloaded = await new SnapshotOperationsRepository(store).getById('op_proof');
    expect(reloaded.objective).toBe('Objetivo revisado');
    expect(reloaded.status).toBe('scheduled');
  });

  it('getById inexistente lança NOT_FOUND', async () => {
    await expect(repo.getById('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('archive e duplicate', async () => {
    await repo.archive('op_fechamento');
    expect((await repo.getById('op_fechamento')).status).toBe('archived');
    const copy = await repo.duplicate('op_fechamento');
    expect(copy.status).toBe('draft');
    expect(copy.id).not.toBe('op_fechamento');
  });
});
