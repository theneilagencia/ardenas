/**
 * Arden.AS API — testes do SupabaseIdentityProvider (ARDEN-BE-002).
 *
 * Verificação CRIPTOGRÁFICA real (assinatura JWKS) sem rede: o par de chaves é
 * gerado localmente e injetado no lugar do JWKS remoto. Cobre assinatura válida,
 * expiração, issuer/audience incorretos e algoritmo NÃO permitido — provando que
 * o token é verificado, nunca apenas decodificado.
 */

import { SignJWT, generateKeyPair, exportJWK, type KeyLike } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { SupabaseIdentityProvider } from './supabase-identity.provider';
import type { AppConfig } from '../config/env.schema';

const ISSUER = 'https://project.supabase.co/auth/v1';
const AUDIENCE = 'authenticated';

const config = {
  SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_JWT_ISSUER: ISSUER,
  SUPABASE_JWT_AUDIENCE: AUDIENCE,
  AUTH_CLOCK_TOLERANCE_SECONDS: 5,
} as unknown as AppConfig;

let rsaPrivate: KeyLike;
let hmac: Uint8Array;
let provider: SupabaseIdentityProvider;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  rsaPrivate = pair.privateKey;
  hmac = new TextEncoder().encode('symmetric-secret-should-be-rejected');
  provider = new SupabaseIdentityProvider(config);
  // Injeta a chave pública local no lugar do JWKS remoto (sem rede).
  await exportJWK(pair.publicKey);
  (provider as unknown as { jwks: () => Promise<KeyLike> }).jwks = async () => pair.publicKey;
});

async function signRs256(overrides: {
  sub?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
  expInPast?: boolean;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({ email: 'user@arden.test', email_verified: true })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(overrides.sub ?? 'user-subject-1')
    .setIssuedAt(now)
    .setIssuer(overrides.issuer ?? ISSUER)
    .setAudience(overrides.audience ?? AUDIENCE);
  jwt.setExpirationTime(overrides.expInPast ? now - 60 : now + 3600);
  return jwt.sign(rsaPrivate);
}

describe('SupabaseIdentityProvider', () => {
  it('aceita um token com assinatura, issuer e audience válidos', async () => {
    const token = await signRs256({ sub: 'user-abc' });
    const identity = await provider.verifyAccessToken(token);
    expect(identity.provider).toBe('supabase');
    expect(identity.subject).toBe('user-abc');
    expect(identity.email).toBe('user@arden.test');
  });

  it('rejeita token expirado com SESSION_EXPIRED', async () => {
    const token = await signRs256({ expInPast: true });
    await expect(provider.verifyAccessToken(token)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
  });

  it('rejeita issuer incorreto com UNAUTHENTICATED', async () => {
    const token = await signRs256({ issuer: 'https://evil.example/auth' });
    await expect(provider.verifyAccessToken(token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejeita audience incorreta com UNAUTHENTICATED', async () => {
    const token = await signRs256({ audience: 'outra-audiencia' });
    await expect(provider.verifyAccessToken(token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejeita algoritmo simétrico (HS256) não permitido', async () => {
    const now = Math.floor(Date.now() / 1000);
    const hsToken = await new SignJWT({ email: 'x@arden.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-hs')
      .setIssuedAt(now)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(now + 3600)
      .sign(hmac);
    await expect(provider.verifyAccessToken(hsToken)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejeita token malformado com UNAUTHENTICATED', async () => {
    await expect(provider.verifyAccessToken('nao.e.um.jwt')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});
