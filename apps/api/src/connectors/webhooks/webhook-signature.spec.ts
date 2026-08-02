/**
 * Arden.AS API — testes de assinatura/timestamp de webhook (ARDEN-BE-006.7).
 */

import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { validateTimestamp, verifyHmacSignature, verifyStaticBearer, FUTURE_TOLERANCE_SECONDS } from './webhook-signature';

const secret = 'ARDEN_BE006_WEBHOOK_SECRET_CANARY_unit';
const now = new Date('2026-08-02T00:00:00Z');
const nowSeconds = Math.floor(now.getTime() / 1000);

function sign(rawBody: Buffer, timestamp: number): string {
  const mac = createHmac('sha256', secret);
  mac.update(`${timestamp}.`);
  mac.update(rawBody);
  return `sha256=${mac.digest('hex')}`;
}

describe('validateTimestamp', () => {
  it('dentro da janela', () => {
    expect(validateTimestamp(String(nowSeconds), now, 300)).toEqual({ ok: true, seconds: nowSeconds });
  });
  it('exatamente no limite da janela', () => {
    expect(validateTimestamp(String(nowSeconds - 300), now, 300).ok).toBe(true);
  });
  it('1 segundo fora da janela → expired', () => {
    expect(validateTimestamp(String(nowSeconds - 301), now, 300)).toMatchObject({ ok: false, reason: 'expired' });
  });
  it('futuro além da tolerância → future', () => {
    expect(validateTimestamp(String(nowSeconds + FUTURE_TOLERANCE_SECONDS + 1), now, 300)).toMatchObject({ ok: false, reason: 'future' });
  });
  it.each(['', 'abc', '-5', '  ', '1.5', '99999999999999999999'])('formato inválido %s → malformed', (raw) => {
    expect(validateTimestamp(raw, now, 300).ok).toBe(false);
  });
});

describe('verifyHmacSignature — raw body', () => {
  it('assinatura válida sobre os bytes exatos', () => {
    const body = Buffer.from('{"a":1,"b":2}');
    expect(verifyHmacSignature(body, String(nowSeconds), sign(body, nowSeconds), secret)).toBe(true);
  });

  it('corpo semanticamente igual mas re-serializado NÃO valida (raw body)', () => {
    const signed = Buffer.from('{"a":1,"b":2}');
    const reserialized = Buffer.from('{ "b": 2, "a": 1 }');
    const sig = sign(signed, nowSeconds);
    expect(verifyHmacSignature(reserialized, String(nowSeconds), sig, secret)).toBe(false);
  });

  it('assinatura inválida (segredo errado)', () => {
    const body = Buffer.from('{"x":1}');
    const badMac = createHmac('sha256', 'outro').update(`${nowSeconds}.`).update(body).digest('hex');
    expect(verifyHmacSignature(body, String(nowSeconds), `sha256=${badMac}`, secret)).toBe(false);
  });

  it.each(['', 'sha1=abc', 'sha256=xyz', 'sha256=', 'deadbeef'])('assinatura malformada %s → false', (header) => {
    expect(verifyHmacSignature(Buffer.from('{}'), String(nowSeconds), header, secret)).toBe(false);
  });

  it('timestamp diferente muda a assinatura', () => {
    const body = Buffer.from('{"a":1}');
    const sig = sign(body, nowSeconds);
    expect(verifyHmacSignature(body, String(nowSeconds + 1), sig, secret)).toBe(false);
  });
});

describe('verifyStaticBearer', () => {
  it('bearer válido', () => {
    expect(verifyStaticBearer(`Bearer ${secret}`, secret)).toBe(true);
  });
  it('bearer inválido', () => {
    expect(verifyStaticBearer('Bearer errado', secret)).toBe(false);
  });
  it('sem header', () => {
    expect(verifyStaticBearer(undefined, secret)).toBe(false);
  });
  it('formato inválido', () => {
    expect(verifyStaticBearer(secret, secret)).toBe(false);
  });
});
