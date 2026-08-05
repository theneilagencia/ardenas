import { describe, expect, it } from 'vitest';
import { loadConfig, WELL_KNOWN_TEST_MASTER_KEYS } from './env.schema';

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

  // ── Separação DATABASE_URL / DIRECT_URL (ARDEN-PRD-001.2A.2) ────────────────
  it('directUrl cai para DATABASE_URL quando DIRECT_URL ausente (sem pooler)', () => {
    const cfg = loadConfig(base);
    expect(cfg.directUrl).toBe(base.DATABASE_URL);
  });

  it('directUrl usa DIRECT_URL quando definida (conexão direta separada)', () => {
    const direct = 'postgresql://u:p@direct-host:5432/db';
    const cfg = loadConfig({ ...base, DIRECT_URL: direct });
    expect(cfg.directUrl).toBe(direct);
    expect(cfg.directUrl).not.toBe(cfg.DATABASE_URL);
  });

  it('falha quando DIRECT_URL definida não é PostgreSQL', () => {
    expect(() => loadConfig({ ...base, DIRECT_URL: 'mysql://x' })).toThrow(/DIRECT_URL/);
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

  // ── Guard da fixture CONNECTOR_MASTER_KEY (ARDEN-BE-008.7 §6.3) ─────────────────
  describe('guard da chave-mestra de fixture de teste', () => {
    const prodBase = {
      ...supabaseBase,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.test',
      CONNECTOR_VAULT_PROVIDER: 'app-aes-gcm',
    };

    it('a aplicação em production RECUSA iniciar com a fixture de teste conhecida', () => {
      for (const fixture of WELL_KNOWN_TEST_MASTER_KEYS) {
        expect(() => loadConfig({ ...prodBase, CONNECTOR_MASTER_KEY: fixture })).toThrow(
          /fixture de teste conhecida|não pode ser usada em production/i,
        );
      }
    });

    it('fora de production (test) a fixture é aceita — é só para os testes', () => {
      const fixture = WELL_KNOWN_TEST_MASTER_KEYS[0];
      const cfg = loadConfig({ ...base, NODE_ENV: 'test', CONNECTOR_VAULT_PROVIDER: 'app-aes-gcm', CONNECTOR_MASTER_KEY: fixture });
      expect(cfg.CONNECTOR_MASTER_KEY).toBe(fixture);
    });

    it('em production, uma chave real (não fixture) de 32 bytes é aceita', () => {
      const realKey = Buffer.from('an-operationally-provisioned-32b', 'utf8').toString('base64');
      expect(Buffer.from(realKey, 'base64').length).toBe(32);
      const cfg = loadConfig({ ...prodBase, CONNECTOR_MASTER_KEY: realKey });
      expect(cfg.NODE_ENV).toBe('production');
    });
  });
});
