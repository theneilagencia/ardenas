/**
 * ARDEN-PRD-001.1B — testes da fronteira de secrets de plataforma.
 * Catálogo fechado, adapter de ambiente, produção fail-closed.
 */
import { describe, expect, it } from 'vitest';
import {
  EnvironmentPlatformSecretSource,
  PlatformSecretError,
  createPlatformSecretSource,
  PLATFORM_SECRET_NAMES,
  type PlatformSecretName,
} from './platform-secret-source';

const MAPPING: Record<PlatformSecretName, string> = {
  DATABASE_URL: 'DATABASE_URL',
  CONNECTOR_MASTER_KEY_PRIMARY: 'CONNECTOR_MASTER_KEY',
  CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY: 'CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY',
  SESSION_JWT_MATERIAL: 'SESSION_JWT_MATERIAL',
  OBSERVABILITY_TOKEN: 'OBSERVABILITY_TOKEN',
};

describe('PlatformSecretSource', () => {
  it('catálogo é fechado e estável', () => {
    expect(PLATFORM_SECRET_NAMES).toContain('CONNECTOR_MASTER_KEY_PRIMARY');
    expect(PLATFORM_SECRET_NAMES).toContain('CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY');
  });

  it('adapter de ambiente resolve secret obrigatório', async () => {
    const src = new EnvironmentPlatformSecretSource({ DATABASE_URL: 'postgres://x' }, MAPPING);
    const r = await src.getRequiredSecret('DATABASE_URL');
    expect(r.value).toBe('postgres://x');
    expect(r.source).toBe('ENVIRONMENT');
  });

  it('secret obrigatório ausente falha (fail-closed)', async () => {
    const src = new EnvironmentPlatformSecretSource({}, MAPPING);
    await expect(src.getRequiredSecret('DATABASE_URL')).rejects.toMatchObject({ code: 'PLATFORM_SECRET_UNAVAILABLE' });
  });

  it('secret vazio é tratado como ausente (não silencioso)', async () => {
    const src = new EnvironmentPlatformSecretSource({ DATABASE_URL: '' }, MAPPING);
    expect(await src.getOptionalSecret('DATABASE_URL')).toBeNull();
  });

  it('dev/test com environment → usa adapter de ambiente', () => {
    const envSrc = new EnvironmentPlatformSecretSource({ DATABASE_URL: 'x' }, MAPPING);
    const s = createPlatformSecretSource(
      { nodeEnv: 'test', sourceKind: 'environment', environmentApprovedForProduction: false },
      envSrc,
    );
    expect(s).toBe(envSrc);
  });

  it('produção + environment SEM aprovação → FALHA (fail-closed)', () => {
    const envSrc = new EnvironmentPlatformSecretSource({}, MAPPING);
    expect(() =>
      createPlatformSecretSource(
        { nodeEnv: 'production', sourceKind: 'environment', environmentApprovedForProduction: false },
        envSrc,
      ),
    ).toThrow(PlatformSecretError);
  });

  it('produção + environment COM aprovação explícita → aceito', () => {
    const envSrc = new EnvironmentPlatformSecretSource({}, MAPPING);
    const s = createPlatformSecretSource(
      { nodeEnv: 'production', sourceKind: 'environment', environmentApprovedForProduction: true },
      envSrc,
    );
    expect(s).toBe(envSrc);
  });

  it('external SEM adapter configurado → FALHA (fail-closed)', () => {
    const envSrc = new EnvironmentPlatformSecretSource({}, MAPPING);
    expect(() =>
      createPlatformSecretSource(
        { nodeEnv: 'production', sourceKind: 'external', environmentApprovedForProduction: false },
        envSrc,
      ),
    ).toThrow(/NOT_CONFIGURED/);
  });

  it('external COM adapter → usa o adapter externo', () => {
    const envSrc = new EnvironmentPlatformSecretSource({}, MAPPING);
    const external = new EnvironmentPlatformSecretSource({ DATABASE_URL: 'ext' }, MAPPING);
    const s = createPlatformSecretSource(
      { nodeEnv: 'production', sourceKind: 'external', environmentApprovedForProduction: false, externalAdapter: external },
      envSrc,
    );
    expect(s).toBe(external);
  });

  it('erro sanitizado nunca inclui valor do secret', async () => {
    const src = new EnvironmentPlatformSecretSource({}, MAPPING);
    try {
      await src.getRequiredSecret('CONNECTOR_MASTER_KEY_PRIMARY');
    } catch (e) {
      expect(String((e as Error).message)).not.toMatch(/[A-Za-z0-9+/]{40,}/);
    }
  });
});
