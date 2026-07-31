/**
 * Arden.AS API — abstração do provedor de identidade (ARDEN-BE-002).
 *
 * Fronteira interna: controllers/guards/domínio NÃO conhecem o SDK do provedor.
 * Claims externas NÃO determinam papéis/permissões internos — servem apenas para
 * identificar o `subject` estável e dados básicos de perfil.
 */

export interface VerifiedIdentity {
  provider: string;
  /** Identidade estável (imutável) — nunca o e-mail. */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  issuedAt: string;
  expiresAt: string;
  /** Claims completas do token (uso interno; NUNCA logadas na íntegra). */
  claims: Record<string, unknown>;
}

export interface ExternalIdentity {
  provider: string;
  subject: string;
  email: string | null;
  displayName: string | null;
}

export interface IdentityProvider {
  readonly name: string;
  /** Verifica CRIPTOGRAFICAMENTE o access token e retorna a identidade. */
  verifyAccessToken(token: string): Promise<VerifiedIdentity>;
  /** Consulta a identidade externa por subject (opcional; pode retornar null). */
  getIdentity(subject: string): Promise<ExternalIdentity | null>;
}

/** Token de injeção do provedor de identidade. */
export const IDENTITY_PROVIDER = 'IDENTITY_PROVIDER';
