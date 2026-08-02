/**
 * Arden.AS API — testes de startup validation e key provider do cofre (006.4).
 */

import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../config/env.schema';
import { ConnectorKeyProvider } from './connector-key-provider';
import type { AppConfig } from '../../config/env.schema';

const KEY32 = Buffer.alloc(32, 1).toString('base64');

const prodBase: Record<string, string> = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/x',
  CORS_ORIGINS: 'https://app.example',
  AUTH_PROVIDER: 'supabase',
  SUPABASE_JWKS_URL: 'https://x/jwks',
  SUPABASE_JWT_ISSUER: 'https://issuer',
  CONNECTOR_VAULT_PROVIDER: 'app-aes-gcm',
  CONNECTOR_MASTER_KEY: KEY32,
  CONNECTOR_KEY_VERSION: 'v1',
};

describe('startup validation do cofre', () => {
  it('production + app-aes-gcm sem master key → falha', () => {
    expect(() => loadConfig({ ...prodBase, CONNECTOR_MASTER_KEY: '' })).toThrow(/CONNECTOR_MASTER_KEY/);
  });
  it('production + provider fake → falha', () => {
    expect(() => loadConfig({ ...prodBase, CONNECTOR_VAULT_PROVIDER: 'fake' })).toThrow(/fake/i);
  });
  it('master key malformada/curta → falha', () => {
    expect(() => loadConfig({ ...prodBase, CONNECTOR_MASTER_KEY: 'short' })).toThrow(/32 bytes/);
  });
  it('provider desconhecido → falha (enum)', () => {
    expect(() => loadConfig({ ...prodBase, CONNECTOR_VAULT_PROVIDER: 'aws-kms' })).toThrow();
  });
  it('production válido → ok', () => {
    expect(() => loadConfig(prodBase)).not.toThrow();
  });
  it('fake permitido fora de produção', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://x', CORS_ORIGINS: 'http://x', AUTH_PROVIDER: 'fake', CONNECTOR_VAULT_PROVIDER: 'fake' }),
    ).not.toThrow();
  });
  it('keyring JSON inválido → falha', () => {
    expect(() => loadConfig({ ...prodBase, CONNECTOR_KEYRING_JSON: 'not-json' })).toThrow(/keyring|JSON/i);
  });
});

describe('ConnectorKeyProvider', () => {
  function provider(over: Partial<AppConfig> = {}): ConnectorKeyProvider {
    const cfg = { CONNECTOR_KEY_VERSION: 'v1', CONNECTOR_MASTER_KEY: KEY32, CONNECTOR_KEYRING_JSON: '', ...over } as AppConfig;
    return new ConnectorKeyProvider(cfg);
  }
  it('getCurrentKey retorna a chave corrente (32 bytes)', () => {
    const k = provider().getCurrentKey();
    expect(k.version).toBe('v1');
    expect(k.key.length).toBe(32);
  });
  it('getKey de versão desconhecida → erro', () => {
    expect(() => provider().getKey('v9')).toThrow(/unavailable/);
  });
  it('keyring fornece versões antigas', () => {
    const old = Buffer.alloc(32, 2).toString('base64');
    const p = provider({ CONNECTOR_KEYRING_JSON: JSON.stringify({ v0: old }) });
    expect(p.getKey('v0').key.length).toBe(32);
  });
  it('sem master key: getCurrentKey falha', () => {
    expect(() => provider({ CONNECTOR_MASTER_KEY: '' }).getCurrentKey()).toThrow(/unavailable/);
  });
});
