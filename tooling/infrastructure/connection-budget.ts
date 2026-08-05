/**
 * ARDEN-PRD-001.2A.2 — Orçamento de conexões do PostgreSQL (OFFLINE, provider-neutro).
 *
 * Calcula as conexões reservadas e verifica contra o limite do banco × fator de segurança.
 * Enquanto o banco não for selecionado, `databaseConnectionLimit` é `null` (TBD) e o
 * resultado é BLOCKED. Nenhum limite é inventado.
 */

export interface ConnectionBudgetInput {
  readonly apiReplicas: number;
  readonly poolPerApiReplica: number;
  readonly workerReplicas: number;
  readonly poolPerWorkerReplica: number;
  readonly migrationConnections: number;
  readonly adminConnections: number;
  readonly restoreDrillConnections: number;
  /** Fator de segurança aprovado (0 < f <= 1), ex.: 0.8 = usar no máx. 80% do limite. */
  readonly approvedSafetyFactor: number;
  /** Limite de conexões do banco. `null` enquanto o produto não for selecionado. */
  readonly databaseConnectionLimit: number | null;
}

export interface ConnectionBudgetResult {
  readonly totalReservedConnections: number;
  readonly effectiveLimit: number | null;
  readonly result: 'OK' | 'EXCEEDED' | 'BLOCKED';
  readonly reasons: readonly string[];
}

export function computeConnectionBudget(input: ConnectionBudgetInput): ConnectionBudgetResult {
  const totalReserved =
    input.apiReplicas * input.poolPerApiReplica +
    input.workerReplicas * input.poolPerWorkerReplica +
    input.migrationConnections +
    input.adminConnections +
    input.restoreDrillConnections;

  if (input.databaseConnectionLimit === null) {
    return {
      totalReservedConnections: totalReserved,
      effectiveLimit: null,
      result: 'BLOCKED',
      reasons: ['databaseConnectionLimit = TBD (produto de banco não selecionado)'],
    };
  }
  if (!(input.approvedSafetyFactor > 0 && input.approvedSafetyFactor <= 1)) {
    return {
      totalReservedConnections: totalReserved,
      effectiveLimit: null,
      result: 'BLOCKED',
      reasons: ['approvedSafetyFactor deve estar em (0, 1]'],
    };
  }
  const effectiveLimit = input.databaseConnectionLimit * input.approvedSafetyFactor;
  const ok = totalReserved < effectiveLimit;
  return {
    totalReservedConnections: totalReserved,
    effectiveLimit,
    result: ok ? 'OK' : 'EXCEEDED',
    reasons: ok
      ? []
      : [
          `reservado ${totalReserved} >= limite efetivo ${effectiveLimit} ` +
            `(${input.databaseConnectionLimit} × ${input.approvedSafetyFactor})`,
        ],
  };
}
