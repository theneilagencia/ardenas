/**
 * Arden.AS API — testes do token opaco de webhook (ARDEN-BE-006.7).
 */

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { generateEndpointToken, hashEndpointToken, constantTimeEqual, constantTimeEqualHex } from './webhook-token';

describe('generateEndpointToken', () => {
  it('prefixo whk_ e entropia alta (>=256 bits)', () => {
    const t = generateEndpointToken();
    expect(t.startsWith('whk_')).toBe(true);
    // 32 bytes em base64url ≈ 43 chars.
    expect(t.length).toBeGreaterThanOrEqual(4 + 43);
  });
  it('tokens são únicos', () => {
    const set = new Set(Array.from({ length: 50 }, () => generateEndpointToken()));
    expect(set.size).toBe(50);
  });
});

describe('hashEndpointToken', () => {
  it('SHA-256 hex do token (verificador, não reversível)', () => {
    const t = generateEndpointToken();
    expect(hashEndpointToken(t)).toBe(createHash('sha256').update(t).digest('hex'));
    expect(hashEndpointToken(t)).not.toBe(t);
  });
});

describe('constant-time compare', () => {
  it('iguais → true; diferentes → false', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
  it('hex constant-time', () => {
    const h = hashEndpointToken('x');
    expect(constantTimeEqualHex(h, h)).toBe(true);
    expect(constantTimeEqualHex(h, hashEndpointToken('y'))).toBe(false);
  });
});
