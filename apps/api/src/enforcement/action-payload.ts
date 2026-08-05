/**
 * Arden.AS API — normalização e hash do payload de ação (ARDEN-BE-004).
 *
 * O hash identifica de forma estável o par (ação, payload) para idempotência e
 * para casar uma autorização com a ação que a validação apresenta. Chaves são
 * ordenadas para que a mesma intenção produza sempre o mesmo hash.
 */

import { createHash } from 'node:crypto';

/** Serialização canônica (chaves ordenadas em profundidade). */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function hashActionPayload(actionKey: string, payload: unknown): string {
  const canonical = JSON.stringify({ actionKey, payload: canonicalize(payload ?? null) });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Achata o payload em um contexto avaliável pelas condições. Objetos aninhados
 * viram caminhos pontuados; o `actionKey` é sempre exposto como campo.
 */
export function buildActionContext(actionKey: string, payload: unknown): Record<string, unknown> {
  const context: Record<string, unknown> = { actionKey };
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      context[k] = v;
    }
  } else if (payload !== undefined && payload !== null) {
    context.value = payload;
  }
  return context;
}
