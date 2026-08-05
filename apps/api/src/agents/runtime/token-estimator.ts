/**
 * Arden.AS API — estimativa determinística de tokens (ARDEN-BE-007.3 §13).
 *
 * Sem SDK real: estimativa CONSERVADORA `ceil(bytesUTF8 / 4)`. Usada apenas para
 * enforcement de limites e usage do provider determinístico. NÃO equivale exatamente a
 * providers comerciais — é uma aproximação segura e reprodutível.
 */

const BYTES_PER_TOKEN = 4;

export function estimateTokensFromString(text: string): number {
  const bytes = Buffer.byteLength(text, 'utf8');
  return Math.ceil(bytes / BYTES_PER_TOKEN);
}

/** Estima tokens de um valor serializável (JSON estável). */
export function estimateTokens(value: unknown): number {
  if (typeof value === 'string') return estimateTokensFromString(value);
  return estimateTokensFromString(JSON.stringify(value ?? null));
}
