/**
 * Arden.AS API — testes do FakeIdentityProvider (ARDEN-BE-002).
 * Cobre emissão/verificação de token opaco, expiração e formato inválido.
 */

import { describe, expect, it } from 'vitest';
import { FakeIdentityProvider } from './fake-identity.provider';
import { ApiException } from '../common/errors/api-error';

const provider = new FakeIdentityProvider();

describe('FakeIdentityProvider', () => {
  it('verifica um token válido e devolve a identidade', async () => {
    const token = FakeIdentityProvider.issueToken({ subject: 'sub-1', email: 'a@arden.test' });
    const identity = await provider.verifyAccessToken(token);
    expect(identity.provider).toBe('fake');
    expect(identity.subject).toBe('sub-1');
    expect(identity.email).toBe('a@arden.test');
    expect(new Date(identity.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejeita token expirado com SESSION_EXPIRED', async () => {
    const token = FakeIdentityProvider.issueToken({ subject: 'sub-2', ttlSeconds: -10 });
    await expect(provider.verifyAccessToken(token)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
  });

  it('rejeita token sem o prefixo esperado com UNAUTHENTICATED', async () => {
    await expect(provider.verifyAccessToken('not-a-fake-token')).rejects.toBeInstanceOf(ApiException);
    await expect(provider.verifyAccessToken('not-a-fake-token')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejeita payload corrompido com UNAUTHENTICATED', async () => {
    await expect(provider.verifyAccessToken('fake.@@@nao-base64@@@')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});
