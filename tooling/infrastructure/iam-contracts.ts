/**
 * ARDEN-PRD-001.2A.2 — Contratos de IAM abstratos (OFFLINE, provider-neutro).
 *
 * Cada identidade lista apenas CAPACIDADES CONCEITUAIS (menor privilégio). Nenhuma política
 * AWS/GCP/Azure é criada. Invariantes de segurança são checáveis por teste.
 */

export type WorkloadIdentity =
  | 'api-runtime'
  | 'worker-runtime'
  | 'migration-job'
  | 'ci-deployer'
  | 'backup-operator'
  | 'restore-operator'
  | 'break-glass';

export interface IdentityContract {
  readonly identity: WorkloadIdentity;
  readonly capabilities: readonly string[];
  /** Segredos de plataforma que a identidade pode ler (catálogo fechado). */
  readonly readablePlatformSecrets: readonly string[];
  readonly usesDirectDatabaseUrl: boolean;
  readonly usesRuntimeDatabaseUrl: boolean;
}

export const IAM_CONTRACTS: readonly IdentityContract[] = [
  {
    identity: 'api-runtime',
    capabilities: ['read platform runtime secrets', 'connect to runtime database', 'write logs', 'write metrics'],
    readablePlatformSecrets: ['DATABASE_URL', 'CONNECTOR_MASTER_KEY_PRIMARY', 'SESSION_JWT_MATERIAL', 'OBSERVABILITY_TOKEN'],
    usesDirectDatabaseUrl: false,
    usesRuntimeDatabaseUrl: true,
  },
  {
    identity: 'worker-runtime',
    capabilities: ['read platform runtime secrets', 'connect to runtime database', 'consume queue', 'write logs', 'write metrics'],
    readablePlatformSecrets: ['DATABASE_URL', 'CONNECTOR_MASTER_KEY_PRIMARY', 'OBSERVABILITY_TOKEN'],
    usesDirectDatabaseUrl: false,
    usesRuntimeDatabaseUrl: true,
  },
  {
    identity: 'migration-job',
    capabilities: ['read migration database secret', 'connect via direct URL', 'execute migrations'],
    readablePlatformSecrets: ['DATABASE_URL'],
    usesDirectDatabaseUrl: true,
    usesRuntimeDatabaseUrl: false,
  },
  {
    identity: 'ci-deployer',
    capabilities: ['push image to registry (OIDC short-lived)', 'trigger deploy'],
    readablePlatformSecrets: [],
    usesDirectDatabaseUrl: false,
    usesRuntimeDatabaseUrl: false,
  },
  {
    identity: 'backup-operator',
    capabilities: ['manage automated backups', 'configure retention/PITR'],
    readablePlatformSecrets: [],
    usesDirectDatabaseUrl: false,
    usesRuntimeDatabaseUrl: false,
  },
  {
    identity: 'restore-operator',
    capabilities: ['restore to isolated recovery cluster', 'read backup wrapping key (drill only)'],
    readablePlatformSecrets: ['CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY'],
    usesDirectDatabaseUrl: true,
    usesRuntimeDatabaseUrl: false,
  },
  {
    identity: 'break-glass',
    capabilities: ['temporary elevated access (MFA + two approvals + time-limited + audited)'],
    readablePlatformSecrets: [],
    usesDirectDatabaseUrl: false,
    usesRuntimeDatabaseUrl: false,
  },
];

export interface IamLeastPrivilegeResult {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

/**
 * Invariantes de menor privilégio:
 * - runtime (api/worker) NUNCA lê a wrapping key de backup;
 * - só o restore-operator lê a wrapping key;
 * - migration-job usa conexão DIRETA e não runtime;
 * - ci-deployer não lê segredos de runtime.
 */
export function checkLeastPrivilege(contracts: readonly IdentityContract[] = IAM_CONTRACTS): IamLeastPrivilegeResult {
  const v: string[] = [];
  const WRAP = 'CONNECTOR_MASTER_KEY_BACKUP_WRAPPING_KEY';
  for (const c of contracts) {
    if ((c.identity === 'api-runtime' || c.identity === 'worker-runtime') && c.readablePlatformSecrets.includes(WRAP)) {
      v.push(`${c.identity} não pode ler a wrapping key de backup`);
    }
    if (c.identity === 'migration-job' && (!c.usesDirectDatabaseUrl || c.usesRuntimeDatabaseUrl)) {
      v.push('migration-job deve usar conexão direta, não runtime');
    }
    if (c.identity === 'ci-deployer' && c.readablePlatformSecrets.length > 0) {
      v.push('ci-deployer não deve ler segredos de runtime');
    }
  }
  const wrapReaders = contracts.filter((c) => c.readablePlatformSecrets.includes(WRAP)).map((c) => c.identity);
  if (wrapReaders.some((id) => id !== 'restore-operator')) {
    v.push('apenas restore-operator pode ler a wrapping key de backup');
  }
  return { ok: v.length === 0, violations: v };
}
