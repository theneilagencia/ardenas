/**
 * Arden.AS API — FakeIdentityProvider (ARDEN-BE-002).
 *
 * SOMENTE para desenvolvimento e testes automatizados. Proibido em production
 * (bloqueado na validação de config). Emite/verifica tokens opacos controlados —
 * NÃO é criptografia real. Sem fallback silencioso a partir do Supabase.
 */

import { Logger } from '@nestjs/common';
import { ApiException } from '../common/errors/api-error';
import type { ExternalIdentity, IdentityProvider, VerifiedIdentity } from './identity.types';

const PREFIX = 'fake.';

interface FakeClaims {
  sub: string;
  email: string | null;
  email_verified: boolean;
  display_name: string | null;
  iat: number;
  exp: number;
}

function encode(claims: FakeClaims): string {
  return PREFIX + Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
}

function decode(token: string): FakeClaims {
  if (!token.startsWith(PREFIX)) throw new ApiException('UNAUTHENTICATED', { message: 'Token inválido.' });
  try {
    const json = Buffer.from(token.slice(PREFIX.length), 'base64url').toString('utf8');
    return JSON.parse(json) as FakeClaims;
  } catch {
    throw new ApiException('UNAUTHENTICATED', { message: 'Token inválido.' });
  }
}

export class FakeIdentityProvider implements IdentityProvider {
  readonly name = 'fake';
  private readonly logger = new Logger('FakeIdentityProvider');

  constructor() {
    this.logger.warn('WARNING: FAKE IDENTITY PROVIDER ACTIVE');
  }

  /** Utilitário de TESTE: emite um token fake para um subject. */
  static issueToken(input: {
    subject: string;
    email?: string | null;
    emailVerified?: boolean;
    displayName?: string | null;
    ttlSeconds?: number;
  }): string {
    const now = Math.floor(Date.now() / 1000);
    return encode({
      sub: input.subject,
      email: input.email ?? null,
      email_verified: input.emailVerified ?? true,
      display_name: input.displayName ?? null,
      iat: now,
      exp: now + (input.ttlSeconds ?? 3600),
    });
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    const claims = decode(token);
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp <= now) throw new ApiException('SESSION_EXPIRED', { message: 'Token expirado.' });
    return {
      provider: this.name,
      subject: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified,
      issuedAt: new Date(claims.iat * 1000).toISOString(),
      expiresAt: new Date(claims.exp * 1000).toISOString(),
      claims: { sub: claims.sub, email: claims.email, display_name: claims.display_name },
    };
  }

  async getIdentity(subject: string): Promise<ExternalIdentity | null> {
    return { provider: this.name, subject, email: null, displayName: null };
  }
}
