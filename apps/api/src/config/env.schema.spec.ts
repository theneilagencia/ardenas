import { describe, expect, it } from 'vitest';
import { loadConfig } from './env.schema';

const base = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  LOG_LEVEL: 'info',
  APP_VERSION: '0.1.0',
  CORS_ORIGINS: 'http://a.test,http://b.test',
  API_PREFIX: '/api/v1',
  ENABLE_SWAGGER: 'true',
  AUTH_PROVIDER: 'fake',
};

const supabaseBase = {
  ...base,
  AUTH_PROVIDER: 'supabase',
  SUPABASE_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_JWT_ISSUER: 'https://project.supabase.co/auth/v1',
};

describe('loadConfig', () => {
  it('valida e normaliza uma configuração válida', () => {
    const cfg = loadConfig(base);
    expect(cfg.PORT).toBe(3000);
    expect(cfg.corsOrigins).toEqual(['http://a.test', 'http://b.test']);
    expect(cfg.ENABLE_SWAGGER).toBe(true);
  });

  it('falha (não sobe) quando DATABASE_URL está ausente', () => {
    const { DATABASE_URL: _omit, ...withoutDb } = base;
    void _omit;
    expect(() => loadConfig(withoutDb)).toThrow(/DATABASE_URL/);
  });

  it('falha quando DATABASE_URL não é PostgreSQL', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/PostgreSQL/);
  });

  it('em production, rejeita CORS permissivo (*)', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', CORS_ORIGINS: '*' })).toThrow(
      /allowlist/,
    );
  });

  it('em production, rejeita CORS vazio', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', CORS_ORIGINS: '' })).toThrow(
      /allowlist/,
    );
  });

  it('proíbe AUTH_PROVIDER=fake em production', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', AUTH_PROVIDER: 'fake' }),
    ).toThrow(/fake.*production/);
  });

  it('exige SUPABASE_JWKS_URL e issuer quando AUTH_PROVIDER=supabase', () => {
    const { SUPABASE_JWKS_URL: _j, SUPABASE_JWT_ISSUER: _i, ...withoutJwks } = supabaseBase;
    void _j;
    void _i;
    expect(() => loadConfig(withoutJwks)).toThrow(/SUPABASE_JWKS_URL/);
  });

  it('aceita configuração supabase completa', () => {
    const cfg = loadConfig(supabaseBase);
    expect(cfg.AUTH_PROVIDER).toBe('supabase');
    expect(cfg.SUPABASE_JWKS_URL).toContain('jwks.json');
  });
});
