/**
 * Arden.AS API — máquina de estados de execução (ARDEN-BE-005 §10).
 *
 * Função PURA: define TODAS as transições permitidas de `ExecutionRunStatus`.
 * Nenhuma transição é aceita só porque um status novo foi enviado — a alteração
 * direta de status por PATCH genérico não existe; toda mudança passa por aqui.
 */

import type { ExecutionRunStatus } from '@arden/contracts';

/** Estados terminais (sem saída). */
export const TERMINAL_STATUSES: ReadonlySet<ExecutionRunStatus> = new Set<ExecutionRunStatus>([
  'CANCELLED',
  'SUCCEEDED',
  'COMPENSATED',
  'COMPENSATION_FAILED',
]);

/** Transições permitidas (origem → destinos). */
export const ALLOWED_TRANSITIONS: Readonly<Record<ExecutionRunStatus, readonly ExecutionRunStatus[]>> = {
  PENDING: ['QUEUED', 'CANCEL_REQUESTED', 'FAILED'],
  QUEUED: ['RUNNING', 'PAUSE_REQUESTED', 'CANCEL_REQUESTED'],
  RUNNING: ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'PAUSE_REQUESTED', 'CANCEL_REQUESTED'],
  PAUSE_REQUESTED: ['PAUSED', 'CANCEL_REQUESTED'],
  PAUSED: ['RESUME_REQUESTED', 'CANCEL_REQUESTED'],
  RESUME_REQUESTED: ['QUEUED', 'CANCEL_REQUESTED'],
  CANCEL_REQUESTED: ['CANCELLED'],
  FAILED: ['QUEUED', 'COMPENSATING'],
  TIMED_OUT: ['QUEUED', 'COMPENSATING'],
  COMPENSATING: ['COMPENSATED', 'COMPENSATION_FAILED'],
  CANCELLED: [],
  SUCCEEDED: [],
  COMPENSATED: [],
  COMPENSATION_FAILED: [],
};

export function isTerminal(status: ExecutionRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canTransition(current: ExecutionRunStatus, target: ExecutionRunStatus): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(target) ?? false;
}
