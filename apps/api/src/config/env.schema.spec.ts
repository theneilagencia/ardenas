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
});
