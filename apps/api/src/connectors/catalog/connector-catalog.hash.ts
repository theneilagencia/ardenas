/**
 * Arden.AS API — hash determinístico do catálogo (ARDEN-BE-006.3).
 * Identifica a projeção de uma definição/ferramenta canônica (código → banco).
 * Chaves ordenadas → hash estável entre execuções.
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

/** sha256 estável do objeto canônico (independe da ordem das chaves). */
export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
