/**
 * Arden.AS API — testes de serialização/validação/fingerprint de segredo (006.4).
 */

import { describe, expect, it } from 'vitest';
import { canonicalSecretString, fingerprintSecret, validateSecret } from './secret-serialization';

describe('validateSecret', () => {
  it('aceita objeto JSON simples', () => {
    expect(validateSecret({ token: 'abc' })).toEqual([]);
  });
  it('rejeita não-objeto', () => {
    expect(validateSecret('x').length).toBeGreaterThan(0);
    expect(validateSecret(['a']).length).toBeGreaterThan(0);
    expect(validateSecret(null).length).toBeGreaterThan(0);
  });
  it('rejeita função', () => {
    expect(validateSecret({ fn: () => 1 }).length).toBeGreaterThan(0);
  });
  it('rejeita tamanho excessivo', () => {
    expect(validateSecret({ big: 'x'.repeat(20000) }).some((e) => e.code === 'too_large')).toBe(true);
  });
  it('valida contra credentialSchema: required e additionalProperties=false', () => {
    const schema = { required: ['token'], properties: { token: {} }, additionalProperties: false };
    expect(validateSecret({ token: 'a' }, schema)).toEqual([]);
    expect(validateSecret({}, schema).some((e) => e.code === 'required')).toBe(true);
    expect(validateSecret({ token: 'a', extra: 1 }, schema).some((e) => e.code === 'unknown')).toBe(true);
  });
});

describe('fingerprint', () => {
  it('é determinístico e no formato sha256:<8hex>', () => {
    const fp = fingerprintSecret({ b: 2, a: 1 });
    expect(fp).toMatch(/^sha256:[0-9a-f]{8}$/);
    expect(fingerprintSecret({ a: 1, b: 2 })).toBe(fp); // ordem irrelevante
  });
  it('não contém o plaintext', () => {
    expect(fingerprintSecret({ token: 'SUPERSECRET' })).not.toContain('SUPERSECRET');
  });
  it('canonicalização ordena chaves', () => {
    expect(canonicalSecretString({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});
