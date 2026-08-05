/**
 * Arden.AS API — fronteira de secrets de PLATAFORMA (ARDEN-PRD-001.1B).
 *
 * Separa rigorosamente os secrets da PLATAFORMA (banco, master-key keyring, wrapping
 * key de backup, tokens de observabilidade) dos secrets TENANT-managed (credenciais de
 * conector), que continuam cifrados pelo SecretVault (BE-006.4) — não passam por aqui.
 *
 * Contrato NEUTRO: o adapter de ambiente serve APENAS local/test/CI. Em production, a
 * origem `environment` só é aceita se explicitamente aprovada; caso contrário, ou com a
 * origem `external` sem adapter configurado, o startup FALHA (fail-closed). Nenhum
 * fornecedor de nuvem é escolhido aqui. `value` nunca é serializado, logado ou persistido.
 */

/** Catálogo FECHADO de secrets de plataforma (sem string arbitrária). */
export const PLATFORM_SECRET_NAMES = [
  'DATABASE_URL',
  'CONNECTOR_MASTER_KEY_PRIMARY',
  'CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY',
  'SESSION_JWT_MATERIAL',
  'OBSERVABILITY_TOKEN',
] as const;
export type PlatformSecretName = (typeof PLATFORM_SECRET_NAMES)[number];

export type PlatformSecretSourceKind = 'ENVIRONMENT' | 'EXTERNAL_SECRET_MANAGER';

/** Só metadata segura. `value` NUNCA deve ser serializado/logado/persistido. */
export interface ResolvedPlatformSecret {
  readonly value: string;
  readonly version?: string;
  readonly source: PlatformSecretSourceKind;
}

export interface PlatformSecretSource {
  getRequiredSecret(name: PlatformSecretName): Promise<ResolvedPlatformSecret>;
  getOptionalSecret(name: PlatformSecretName): Promise<ResolvedPlatformSecret | null>;
}

/** Erro público sanitizado — nunca inclui valor de secret. */
export class PlatformSecretError extends Error {
  constructor(
    readonly code:
      | 'PLATFORM_SECRET_UNAVAILABLE'
      | 'PLATFORM_SECRET_SOURCE_NOT_CONFIGURED'
      | 'PLATFORM_SECRET_SOURCE_NOT_ALLOWED',
    readonly secretName?: PlatformSecretName,
  ) {
    super(secretName ? `${code}: ${secretName}` : code);
    this.name = 'PlatformSecretError';
  }
}

/**
 * Adapter de AMBIENTE — apenas local/test/CI. Lê de um mapa (ex.: `process.env`) passado
 * explicitamente. Recusa valor vazio (não trata como ausente-silencioso). Não faz
 * fallback para arquivo.
 */
export class EnvironmentPlatformSecretSource implements PlatformSecretSource {
  constructor(
    private readonly env: Readonly<Record<string, string | undefined>>,
    /** Mapa nome-de-catálogo → nome-de-variável de ambiente. */
    private readonly mapping: Readonly<Record<PlatformSecretName, string>>,
  ) {}

  async getRequiredSecret(name: PlatformSecretName): Promise<ResolvedPlatformSecret> {
    const resolved = await this.getOptionalSecret(name);
    if (!resolved) throw new PlatformSecretError('PLATFORM_SECRET_UNAVAILABLE', name);
    return resolved;
  }

  async getOptionalSecret(name: PlatformSecretName): Promise<ResolvedPlatformSecret | null> {
    const envVar = this.mapping[name];
    const raw = envVar ? this.env[envVar] : undefined;
    if (raw === undefined || raw === '') return null;
    return { value: raw, source: 'ENVIRONMENT' };
  }
}

export interface PlatformSecretSourcePolicy {
  nodeEnv: 'development' | 'test' | 'production';
  /** Origem escolhida operacionalmente. */
  sourceKind: 'environment' | 'external';
  /** Em production, `environment` só é aceito se explicitamente aprovado. */
  environmentApprovedForProduction: boolean;
  /** Adapter externo já configurado/injetado (produção real). */
  externalAdapter?: PlatformSecretSource;
}

/**
 * Fábrica FAIL-CLOSED. Regras:
 * - dev/test/CI + `environment` → adapter de ambiente.
 * - production + `environment` sem aprovação explícita → FALHA.
 * - `external` sem adapter → FALHA.
 * - `external` com adapter → usa o adapter.
 * Nenhum fallback automático para `.env` em produção.
 */
export function createPlatformSecretSource(
  policy: PlatformSecretSourcePolicy,
  environmentSource: PlatformSecretSource,
): PlatformSecretSource {
  if (policy.sourceKind === 'external') {
    if (!policy.externalAdapter) {
      throw new PlatformSecretError('PLATFORM_SECRET_SOURCE_NOT_CONFIGURED');
    }
    return policy.externalAdapter;
  }
  // sourceKind === 'environment'
  if (policy.nodeEnv === 'production' && !policy.environmentApprovedForProduction) {
    throw new PlatformSecretError('PLATFORM_SECRET_SOURCE_NOT_ALLOWED');
  }
  return environmentSource;
}
