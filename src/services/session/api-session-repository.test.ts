/**
 * Arden.AS — testes do ApiSessionRepository (ARDEN-BE-002.1).
 *
 * Trava o endpoint CANÔNICO de logout (`POST /session/logout`, operationId
 * session.logout) e confirma que o modo api sem base URL lança erro tipado — sem
 * fallback silencioso para mock.
 */

import { describe, expect, it, vi } from 'vitest';
import { ApiSessionRepository } from './api-session-repository';
import type { ApiClient } from '../api-client';

function fakeClient() {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const client = {
    get: vi.fn(async (path: string) => {
      calls.push({ method: 'GET', path });
      return { data: null };
    }),
    post: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ method: 'POST', path, body });
      return { data: undefined };
    }),
  } as unknown as ApiClient;
  return { client, calls };
}

describe('ApiSessionRepository (modo api)', () => {
  it('signOut usa o endpoint canônico POST /session/logout', async () => {
    const { client, calls } = fakeClient();
    const repo = new ApiSessionRepository(client, 'http://api.test');
    await repo.signOut();
    expect(calls).toEqual([{ method: 'POST', path: '/session/logout', body: undefined }]);
  });

  it('switchOrganization usa POST /session/switch-organization com o corpo do contrato', async () => {
    const { client, calls } = fakeClient();
    const repo = new ApiSessionRepository(client, 'http://api.test');
    await repo.switchOrganization('org_1');
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/session/switch-organization',
      body: { organizationId: 'org_1' },
    });
  });

  it('sem base URL, lança erro tipado (sem fallback para mock)', async () => {
    const { client } = fakeClient();
    const repo = new ApiSessionRepository(client, '');
    await expect(repo.signOut()).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});
