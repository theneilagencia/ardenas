/**
 * Arden.AS — compatibilidade do cliente v1 com execução (ARDEN-BE-005).
 * Prova que os tipos do contrato bastam para tipar um cliente das rotas de
 * execuções, etapas, eventos e evidências. Sem servidor, sem fallback local.
 */

import { describe, expect, it } from 'vitest';
import type { ArdenApiV1Client } from './api-v1-client';
import type { ExecutionRun, ExecutionStep, ExecutionEvent, EvidenceRecord } from '@/contracts';

const run: ExecutionRun = {
  id: 'run_1', organizationId: 'org_1', operationId: 'op_1', operationVersionId: 'v_1', requestedByUserId: 'user_1',
  actionAuthorizationId: null, actionKey: 'communication.send', triggerType: 'MANUAL', triggerReference: null,
  status: 'QUEUED', input: {}, inputHash: 'h', output: null, errorCode: null, errorSummary: null, currentStepId: null,
  startedAt: null, completedAt: null, pausedAt: null, cancelledAt: null, timeoutAt: null, attemptCount: 0, maxAttempts: 1,
  correlationId: 'c', revision: 1, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};
const step: ExecutionStep = {
  id: 'step_1', organizationId: 'org_1', executionRunId: 'run_1', definitionStepKey: 's1', sequence: 1, name: 'E1',
  actionKey: 'system.noop', status: 'PENDING', input: {}, inputHash: 'h', output: null, errorCode: null, errorSummary: null,
  attemptCount: 0, maxAttempts: 1, nextAttemptAt: null, startedAt: null, completedAt: null, timeoutAt: null, revision: 1,
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
};
const event: ExecutionEvent = {
  id: 'ev_1', organizationId: 'org_1', executionRunId: 'run_1', executionStepId: null, sequence: 1, eventType: 'execution.created',
  actorType: 'USER', actorId: 'user_1', correlationId: 'c', causationId: null, payload: {}, occurredAt: '2026-08-01T00:00:00.000Z',
};
const evidence: EvidenceRecord = {
  id: 'evd_1', organizationId: 'org_1', executionRunId: 'run_1', executionStepId: null, evidenceType: 'INPUT', content: {},
  contentHash: 'h', storageReference: null, mimeType: null, createdByType: 'USER', createdById: 'user_1', correlationId: 'c', createdAt: '2026-08-01T00:00:00.000Z',
};

function fakeClient(): ArdenApiV1Client {
  const client = {
    listExecutions: async () => ({ data: [run], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } }),
    getExecution: async () => run,
    createExecution: async () => run,
    pauseExecution: async () => ({ ...run, status: 'PAUSE_REQUESTED' as const }),
    listExecutionSteps: async () => [step],
    listExecutionEvents: async () => ({ data: [event], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 100 } }),
    listExecutionEvidence: async () => [evidence],
  } as Partial<ArdenApiV1Client>;
  return client as ArdenApiV1Client;
}

describe('cliente v1 ↔ execução', () => {
  it('tipa listagem/consulta de execução e comandos', async () => {
    const c = fakeClient();
    expect((await c.listExecutions('org_1', { limit: 50 })).data[0].status).toBe('QUEUED');
    expect((await c.getExecution('org_1', 'run_1')).actionKey).toBe('communication.send');
    expect((await c.pauseExecution('org_1', 'run_1', { expectedRevision: 1 })).status).toBe('PAUSE_REQUESTED');
  });
  it('tipa etapas, eventos e evidências', async () => {
    const c = fakeClient();
    expect((await c.listExecutionSteps('org_1', 'run_1'))[0].actionKey).toBe('system.noop');
    expect((await c.listExecutionEvents('org_1', 'run_1', { limit: 100 })).data[0].eventType).toBe('execution.created');
    expect((await c.listExecutionEvidence('org_1', 'run_1'))[0].evidenceType).toBe('INPUT');
  });
});
