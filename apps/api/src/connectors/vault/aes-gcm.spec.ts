/**
 * Arden.AS API — testes das primitivas AES-256-GCM (ARDEN-BE-006.4).
 */

import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { buildAad, decrypt, encrypt } from './aes-gcm';

const key = randomBytes(32);
const aadParts = { organizationId: 'org_1', connectionId: 'conn_1', credentialVersionId: 'cred_1', keyVersion: 'v1' };
const aad = buildAad(aadParts);
const plaintext = JSON.stringify({ token: 'ARDEN_CANARY_UNIT' });

describe('AES-256-GCM', () => {
  it('roundtrip encrypt/decrypt', () => {
    const env = encrypt(plaintext, key, aad);
    expect(decrypt(env, key, aad)).toBe(plaintext);
    // ciphertext não contém o plaintext.
    expect(Buffer.from(env.ciphertext, 'base64').toString('utf8')).not.toContain('ARDEN_CANARY_UNIT');
  });

  it('nonce único: mesmo plaintext → ciphertext e nonce diferentes', () => {
    const a = encrypt(plaintext, key, aad);
    const b = encrypt(plaintext, key, aad);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('auth tag inválida → falha fechada', () => {
    const env = encrypt(plaintext, key, aad);
    const badTag = { ...env, authTag: randomBytes(16).toString('base64') };
    expect(() => decrypt(badTag, key, aad)).toThrow();
  });

  it('ciphertext alterado → falha', () => {
    const env = encrypt(plaintext, key, aad);
    const corrupted = Buffer.from(env.ciphertext, 'base64');
    corrupted[0] ^= 0xff;
    expect(() => decrypt({ ...env, ciphertext: corrupted.toString('base64') }, key, aad)).toThrow();
  });

  it('chave diferente → falha', () => {
    const env = encrypt(plaintext, key, aad);
    expect(() => decrypt(env, randomBytes(32), aad)).toThrow();
  });

  it.each([
    ['organizationId', { ...aadParts, organizationId: 'org_2' }],
    ['connectionId', { ...aadParts, connectionId: 'conn_2' }],
    ['credentialVersionId', { ...aadParts, credentialVersionId: 'cred_2' }],
    ['keyVersion', { ...aadParts, keyVersion: 'v2' }],
  ])('AAD alterada (%s) → falha de integridade', (_label, altered) => {
    const env = encrypt(plaintext, key, aad);
    expect(() => decrypt(env, key, buildAad(altered))).toThrow();
  });

  it('chave de tamanho inválido → erro', () => {
    expect(() => encrypt(plaintext, randomBytes(16), aad)).toThrow(/32 bytes/);
  });
});
