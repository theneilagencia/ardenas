/**
 * Arden.AS API — token opaco de endpoint de webhook (ARDEN-BE-006.7).
 *
 * O token público (`whk_<random>`, ≥256 bits de entropia) é exibido UMA única vez na
 * criação. Persistimos SOMENTE o hash SHA-256 (verificador, não segredo recuperável).
 * O lookup de entrada ocorre por hash; a comparação é constant-time. NUNCA logamos,
 * auditamos ou retornamos o token depois da criação.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_PREFIX = 'whk_';

/** Gera um token opaco com 256 bits de entropia. */
export function generateEndpointToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

/** Hash SHA-256 (hex) do token — o único valor persistido. */
export function hashEndpointToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparação constant-time de dois hashes hex de mesmo comprimento. */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/** Comparação constant-time de duas strings (utf8). Falha se comprimentos diferem. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
