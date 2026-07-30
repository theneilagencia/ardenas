import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiDataProvider } from './providers';
import { ApiClient, ArdenApiError } from './api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiDataProvider.load', () => {
  it('monta o snapshot a partir dos endpoints, desembrulhando o envelope', async () => {
    const byPath: Record<string, unknown> = {
      '/organizations': { data: [{ id: 'org_1', name: 'Org', companyIds: [] }] },
      '/people': { data: [{ id: 'p1', organizationId: 'org_1', name: 'A', email: 'a@x', roleKeys: ['analyst'], status: 'active' }] },
      '/operations': { data: { items: [{ id: 'op1' }] } }, // aceita PaginatedResult
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = url.replace('https://api.exemplo.com/v1', '');
        return jsonResponse(byPath[path] ?? { data: [] });
      }),
    );

    const provider = new ApiDataProvider('https://api.exemplo.com/v1', 'org_1');
    const snapshot = await provider.load();

    expect(snapshot.organizations).toHaveLength(1);
    expect(snapshot.people[0].name).toBe('A');
    expect(snapshot.operations).toHaveLength(1); // desembrulhou items[]
    expect(snapshot.risks).toEqual([]); // endpoint vazio
    expect(snapshot.deployments).toEqual([]); // sem endpoint no contrato
  });

  it('envia o header X-Arden-Organization', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await new ApiDataProvider('https://api.exemplo.com/v1', 'org_42').load();
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
    expect(headers.get('X-Arden-Organization')).toBe('org_42');
  });
});

describe('ApiClient — mapeamento de erro HTTP', () => {
  it('403 vira acesso negado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 'forbidden', message: 'no' }, 403)));
    const client = new ApiClient({ baseUrl: 'https://api.exemplo.com/v1' });
    await expect(client.get('/operations')).rejects.toMatchObject({
      name: 'ArdenApiError',
      status: 403,
      treatment: 'access_denied',
    });
  });

  it('422 vira regra de negócio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 'rule', message: 'blocked' }, 422)));
    const client = new ApiClient({ baseUrl: 'https://api.exemplo.com/v1' });
    try {
      await client.get('/operations/x/publish');
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect(e).toBeInstanceOf(ArdenApiError);
      expect((e as ArdenApiError).treatment).toBe('business_rule');
    }
  });
});
