/**
 * Arden.AS API — hash determinístico canônico (ARDEN-BE-007.2).
 *
 * Chaves ordenadas recursivamente → SHA-256 estável, independente da ordem das
 * chaves de entrada. Usado tanto pelo `catalogHash` de providers quanto pelo
 * `contentHash` da versão de agente. Mesma semântica → mesmo hash.
 */

import { createHash } from 'node:crypto';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** SHA-256 estável do objeto canônico (independe da ordem das chaves). */
export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
