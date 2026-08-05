/**
 * Arden.AS API — testes da redaction centralizada (ARDEN-BE-006.4).
 */

import { describe, expect, it } from 'vitest';
import { SensitiveDataRedactor } from './sensitive-data-redactor';

const r = new SensitiveDataRedactor();

describe('redactObject', () => {
  it('redige recursivamente, arrays e case-insensitive, sem mutar o original', () => {
    const original = { Token: 'x', nested: { password: 'p', ok: 1 }, list: [{ secret: 's' }, { keep: 2 }] };
    const out = r.redactObject(original) as Record<string, unknown>;
    expect(out.Token).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).password).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).ok).toBe(1);
    expect(((out.list as unknown[])[0] as Record<string, unknown>).secret).toBe('[REDACTED]');
    // original intacto.
    expect(original.Token).toBe('x');
    expect(original.nested.password).toBe('p');
  });
  it('resiste a referência circular', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(() => r.redactObject(a)).not.toThrow();
  });
});

describe('redactHeaders / redactError / redactUrl', () => {
  it('redige headers sensíveis (case-insensitive)', () => {
    const out = r.redactHeaders({ Authorization: 'Bearer x', 'X-Api-Key': 'k', accept: 'json' });
    expect(out.Authorization).toBe('[REDACTED]');
    expect(out['X-Api-Key']).toBe('[REDACTED]');
    expect(out.accept).toBe('json');
  });
  it('sanitiza erro (sem stack, sem segredo)', () => {
    const e = r.redactError(new Error('failed with token=abc'));
    expect(e.message).toBe('Erro interno.');
    expect('stack' in e).toBe(false);
  });
  it('remove userinfo e redige query sensível da URL', () => {
    const url = new URL('https://user:pass@host.example/x?token=abc&q=1');
    const out = r.redactUrl(url);
    expect(out).not.toContain('user:pass');
    expect(out).not.toContain('abc');
    expect(out).toContain('q=1');
  });
});
