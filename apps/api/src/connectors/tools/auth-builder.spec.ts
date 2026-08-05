/**
 * Arden.AS API — testes da montagem de autenticação (ARDEN-BE-006.6).
 */

import { describe, expect, it } from 'vitest';
import { buildAuthHeaders, deriveAuthMode } from './auth-builder';

const now = new Date('2026-01-01T00:00:00Z');
const base = { fixedHeaders: {}, now, correlationId: 'c1' };

describe('buildAuthHeaders', () => {
  it('NONE não injeta authorization', () => {
    const h = buildAuthHeaders({ mode: 'NONE', secret: {}, ...base });
    expect(h.authorization).toBeUndefined();
  });

  it('BEARER_TOKEN injeta Bearer', () => {
    const h = buildAuthHeaders({ mode: 'BEARER_TOKEN', secret: { token: 'abc' }, ...base });
    expect(h.authorization).toBe('Bearer abc');
  });

  it('API_KEY_HEADER usa headerName custom', () => {
    const h = buildAuthHeaders({ mode: 'API_KEY_HEADER', secret: { token: 'k' }, headerName: 'x-api-key', ...base });
    expect(h['x-api-key']).toBe('k');
  });

  it('BASIC_AUTH codifica base64', () => {
    const h = buildAuthHeaders({ mode: 'BASIC_AUTH', secret: { username: 'u', password: 'p' }, ...base });
    expect(h.authorization).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`);
  });

  it('HMAC assina timestamp.body', () => {
    const h = buildAuthHeaders({ mode: 'HMAC', secret: { signingSecret: 's' }, bodyString: '{"a":1}', ...base });
    expect(h['x-arden-signature']).toMatch(/^sha256=/);
    expect(h['x-arden-timestamp']).toBe(String(Math.floor(now.getTime() / 1000)));
  });

  it('CUSTOM_FIXED_HEADERS aplica headers fixos não sensíveis', () => {
    const h = buildAuthHeaders({ mode: 'CUSTOM_FIXED_HEADERS', secret: {}, fixedHeaders: { 'x-team': 'ops' }, now, correlationId: 'c1' });
    expect(h['x-team']).toBe('ops');
  });

  it('rejeita header fixo sensível (authorization) vindo da config', () => {
    expect(() => buildAuthHeaders({ mode: 'CUSTOM_FIXED_HEADERS', secret: {}, fixedHeaders: { authorization: 'Bearer x' }, now, correlationId: 'c1' })).toThrow();
  });

  it('BEARER sem token falha', () => {
    expect(() => buildAuthHeaders({ mode: 'BEARER_TOKEN', secret: {}, ...base })).toThrow();
  });
});

describe('deriveAuthMode', () => {
  it('http deriva do scheme da credencial', () => {
    expect(deriveAuthMode('system.http', { scheme: 'BEARER_TOKEN' }, false)).toBe('BEARER_TOKEN');
    expect(deriveAuthMode('system.http', { scheme: 'NONE' }, false)).toBe('NONE');
  });
  it('webhook usa HMAC quando signPayload', () => {
    expect(deriveAuthMode('system.webhook', {}, true)).toBe('HMAC');
    expect(deriveAuthMode('system.webhook', {}, false)).toBe('NONE');
  });
});
