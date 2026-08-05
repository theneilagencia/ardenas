/**
 * ARDEN-PRD-001.2A.2 — Contrato de recuperação de banco gerenciado (OFFLINE).
 *
 * Interface provider-neutra para inspeção de backups, restauração e destruição do ambiente
 * de recovery. NENHUM provider real é implementado nesta fase. O adapter padrão é
 * FAIL-CLOSED: falha antes de qualquer ação externa e nunca afirma restore executado.
 */

export interface BackupInventory {
  readonly available: boolean;
  readonly items: readonly { readonly id: string; readonly createdAtUtc: string }[];
}

export interface RestoreRequest {
  readonly targetPointInTimeUtc: string;
  readonly environment: 'recovery-drill';
}

export interface RestoreOperation {
  readonly operationId: string;
  readonly status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

export interface RestoreStatus {
  readonly operationId: string;
  readonly status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  readonly restoredConnectionReference?: string;
}

export interface DestroyRecoveryInput {
  readonly operationId: string;
}

export interface ManagedDatabaseRecoveryAdapter {
  inspectBackups(): Promise<BackupInventory>;
  requestRestore(input: RestoreRequest): Promise<RestoreOperation>;
  inspectRestore(operationId: string): Promise<RestoreStatus>;
  destroyRecoveryEnvironment(input: DestroyRecoveryInput): Promise<void>;
}

export class RecoveryAdapterNotSelectedError extends Error {
  constructor(readonly operation: string) {
    super(`RECOVERY_ADAPTER_NOT_SELECTED: ${operation} indisponível — nenhum provider selecionado`);
    this.name = 'RecoveryAdapterNotSelectedError';
  }
}

/**
 * Adapter padrão FAIL-CLOSED. Toda operação lança antes de qualquer efeito. Garante que
 * nenhum restore/backup real seja alegado enquanto o produto não for selecionado (001.2B).
 */
export class UnselectedRecoveryAdapter implements ManagedDatabaseRecoveryAdapter {
  async inspectBackups(): Promise<BackupInventory> {
    throw new RecoveryAdapterNotSelectedError('inspectBackups');
  }
  async requestRestore(): Promise<RestoreOperation> {
    throw new RecoveryAdapterNotSelectedError('requestRestore');
  }
  async inspectRestore(): Promise<RestoreStatus> {
    throw new RecoveryAdapterNotSelectedError('inspectRestore');
  }
  async destroyRecoveryEnvironment(): Promise<void> {
    throw new RecoveryAdapterNotSelectedError('destroyRecoveryEnvironment');
  }
}

/** Pré-condições de um restore drill; produz um PLANO sem executar nada externo. */
export interface RestoreDrillPlan {
  readonly canProceed: false;
  readonly environment: 'recovery-drill';
  readonly requiredEvidenceFields: readonly string[];
  readonly blockingReasons: readonly string[];
}

export function planRestoreDrill(providerSelected: boolean): RestoreDrillPlan {
  const blocking: string[] = [];
  if (!providerSelected) blocking.push('produto de banco não selecionado (ADR PROPOSED)');
  blocking.push('ambiente recovery-drill não provisionado (001.2B)');
  return {
    canProceed: false,
    environment: 'recovery-drill',
    requiredEvidenceFields: [
      'drill_id',
      'executed_at_utc',
      'environment',
      'pitr_target_utc',
      'measured_rto',
      'measured_rpo',
      'master_key_restore_verify',
      'preflight_status',
      'canary_decrypt',
      'tenant_ownership_intact',
      'no_plaintext_leak',
      'operator',
      'result',
    ],
    blockingReasons: blocking,
  };
}
