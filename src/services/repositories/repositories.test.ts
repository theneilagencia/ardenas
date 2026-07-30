import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api-client';
import { ApiOperationsRepository } from './operations-api';
import { ApiApprovalsRepository } from './approvals-api';
import { ApiFilesRepository } from './files-api';
import { StoreOperationsRepository } from './operations-store';
import { useAppStore } from '@/store/app-store';
import { setDataProvider } from '../service-container';
import { MockDataProvider } from '../providers';
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

describe('ApiOperationsRepository', () => {
  it('list mapeia o envelope + meta para PaginatedResult', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res({ data: [{ id: 'op1' }, { id: 'op2' }], meta: { page: 2, pageSize: 2, total: 7 } })),
    );
    const repo = new ApiOperationsRepository(client());
    const page = await repo.list({ status: 'running', page: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(7);
    expect(page.page).toBe(2);
  });

  it('publish chama POST /operations/:id/publish', async () => {
    const fetchMock = vi.fn(async () => res({ data: { id: 'op1', version: '1.0' } }));
    vi.stubGlobal('fetch', fetchMock);
    const op = await new ApiOperationsRepository(client()).publish('op1');
    expect(op.version).toBe('1.0');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/operations/op1/publish`);
    expect((init as RequestInit).method).toBe('POST');
  });

  it('createExecution envia { test } no corpo', async () => {
    const fetchMock = vi.fn(async () => res({ data: { id: 'exec1' } }));
    vi.stubGlobal('fetch', fetchMock);
    await new ApiOperationsRepository(client()).createExecution('op1', { test: true });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ test: true });
  });

  it('archive faz PATCH de estado', async () => {
    const fetchMock = vi.fn(async () => res({ data: { id: 'op1', status: 'archived' } }));
    vi.stubGlobal('fetch', fetchMock);
    await new ApiOperationsRepository(client()).archive('op1');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'archived' });
  });

  it('propaga erro HTTP como ArdenApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res({ code: 'x', message: 'no' }, 409)));
    await expect(new ApiOperationsRepository(client()).getById('op1')).rejects.toMatchObject({
      status: 409,
      treatment: 'conflict',
    });
  });
});

describe('ApiApprovalsRepository / ApiFilesRepository', () => {
  it('approve e quarantine chamam os endpoints corretos', async () => {
    const fetchMock = vi.fn(async () => res({ data: { id: 'x' } }));
    vi.stubGlobal('fetch', fetchMock);
    await new ApiApprovalsRepository(client()).approve('apr1', 'ok');
    await new ApiFilesRepository(client()).quarantine('file1');
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/approvals/apr1/approve`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/files/file1/quarantine`);
  });
});

describe('StoreOperationsRepository (mesmo contrato, ligado à store)', () => {
  beforeEach(async () => {
    setDataProvider(new MockDataProvider(buildSeed()));
    await useAppStore.getState().bootstrap();
  });

  it('publish delega para a store e retorna versão 1.0', async () => {
    const repo = new StoreOperationsRepository();
    const op = await repo.publish('op_conciliacao');
    expect(op.version).toBe('1.0');
  });

  it('archive marca a operação como arquivada', async () => {
    const repo = new StoreOperationsRepository();
    await repo.archive('op_fechamento');
    const op = await repo.getById('op_fechamento');
    expect(op.status).toBe('archived');
  });

  it('list filtra por estado', async () => {
    const repo = new StoreOperationsRepository();
    const running = await repo.list({ status: 'running' });
    expect(running.items.every((o) => o.status === 'running')).toBe(true);
  });
});
