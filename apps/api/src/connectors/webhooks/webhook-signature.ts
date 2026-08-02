/**
 * Arden.AS API — verificação de assinatura/timestamp de webhook (ARDEN-BE-006.7).
 *
 * PURA e determinística (`now` injetado). HMAC-SHA256 sobre o RAW BODY canônico
 * `timestamp + "." + rawBody` (nunca JSON reserializado), comparação constant-time.
 * Bearer estático constant-time. Timestamp valida formato, janela de replay e
 * tolerância futura. NÃO lança segredo; retorna resultados tipados.
 */

import { createHmac } from 'node:crypto';
import { constantTimeEqual } from './webhook-token';

/** Tolerância para relógios adiantados do provedor (segundos). */
export const FUTURE_TOLERANCE_SECONDS = 60;

export type TimestampResult = { ok: true; seconds: number } | { ok: false; reason: string };

/** Valida o header de timestamp (Unix seconds) contra a janela de replay e o futuro. */
export function validateTimestamp(raw: string | undefined, now: Date, replayWindowSeconds: number): TimestampResult {
  if (!raw || !/^\d{1,15}$/.test(raw.trim())) return { ok: false, reason: 'malformed' };
  const seconds = Number(raw.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) return { ok: false, reason: 'malformed' };
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (seconds > nowSeconds + FUTURE_TOLERANCE_SECONDS) return { ok: false, reason: 'future' };
  if (seconds < nowSeconds - replayWindowSeconds) return { ok: false, reason: 'expired' };
  return { ok: true, seconds };
}

/** `sha256=<hex>` bem-formado? */
function parseSignatureHeader(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  return m ? m[1].toLowerCase() : null;
}

/**
 * Verifica HMAC-SHA256 sobre `${timestamp}.${rawBody}`. `rawBody` são os BYTES
 * originais. Comparação constant-time. Assinatura malformada ⇒ false.
 */
export function verifyHmacSignature(rawBody: Buffer, timestamp: string, signatureHeader: string | undefined, signingSecret: string): boolean {
  const provided = parseSignatureHeader(signatureHeader);
  if (!provided) return false;
  const mac = createHmac('sha256', signingSecret);
  mac.update(`${timestamp}.`);
  mac.update(rawBody);
  const expected = mac.digest('hex');
  return constantTimeEqual(expected, provided);
}

/** Verifica `Authorization: Bearer <token>` estático em constant-time. */
export function verifyStaticBearer(authorizationHeader: string | undefined, expectedToken: string): boolean {
  if (!authorizationHeader) return false;
  const m = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!m) return false;
  return constantTimeEqual(m[1], expectedToken);
}
