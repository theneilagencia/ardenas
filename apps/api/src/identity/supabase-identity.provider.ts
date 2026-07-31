/**
 * Arden.AS API — SupabaseIdentityProvider (ARDEN-BE-002).
 *
 * Verifica o access token do Supabase por ASSINATURA (JWKS), com issuer,
 * audience (quando configurada), expiração/not-before e ALGORITMOS RESTRITOS.
 * Não usa `service_role`. Não decodifica JWT sem verificar. Não importa o SDK do
 * Supabase — usa apenas JWKS/JWT padrão (jose).
 */

import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';
import type { AppConfig } from '../config/env.schema';
import { ApiException } from '../common/errors/api-error';
import type { ExternalIdentity, IdentityProvider, VerifiedIdentity } from './identity.types';

const ALLOWED_ALGS = ['RS256', 'ES256'];

export class SupabaseIdentityProvider implements IdentityProvider {
  readonly name = 'supabase';
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience?: string;
  private readonly clockTolerance: number;

  constructor(config: AppConfig) {
    this.jwks = createRemoteJWKSet(new URL(config.SUPABASE_JWKS_URL));
    this.issuer = config.SUPABASE_JWT_ISSUER;
    this.audience = config.SUPABASE_JWT_AUDIENCE || undefined;
    this.clockTolerance = config.AUTH_CLOCK_TOLERANCE_SECONDS;
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ALLOWED_ALGS,
        clockTolerance: this.clockTolerance,
      });
      if (!payload.sub) throw new ApiException('UNAUTHENTICATED', { message: 'Token sem subject.' });
      const meta = (payload.user_metadata as Record<string, unknown> | undefined) ?? {};
      return {
        provider: this.name,
        subject: String(payload.sub),
        email: typeof payload.email === 'string' ? payload.email : null,
        emailVerified: Boolean(payload.email_verified ?? meta.email_verified ?? false),
        issuedAt: new Date((Number(payload.iat) || 0) * 1000).toISOString(),
        expiresAt: new Date((Number(payload.exp) || 0) * 1000).toISOString(),
        claims: payload as Record<string, unknown>,
      };
    } catch (err) {
      if (err instanceof ApiException) throw err;
      if (err instanceof joseErrors.JWTExpired) {
        throw new ApiException('SESSION_EXPIRED', { message: 'Token expirado.' });
      }
      throw new ApiException('UNAUTHENTICATED', { message: 'Token inválido.' });
    }
  }

  /** Consulta por subject exigiria a Admin API (service_role) — fora do escopo. */
  getIdentity(): Promise<ExternalIdentity | null> {
    return Promise.resolve(null);
  }
}
