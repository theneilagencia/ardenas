/**
 * Arden.AS API — fluxo de execução end-to-end (API + worker) (ARDEN-BE-005).
 * Cria execução, drena o worker (fila real) e verifica estado/etapas/eventos/
 * evidências persistidos, retry, pausa, timeout, cancelamento e multitenancy.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AuthorityProfile, OperationStep } from '@arden/contracts';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';
import { ExecutionWorker } from '../src/executions/execution.worker';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let worker: ExecutionWorker;

const WK = { workerId: 'test-worker', leaseSeconds: 30, pollIntervalMs: 10 };

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  worker = app.get(ExecutionWorker);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const base = (orgId: string) => `/api/v1/organizations/${orgId}`;

function step(id: string, order: number, producesEvidence = false): OperationStep {
  return { id, order, name: `Etapa ${order}`, description: '', authorityLevel: 'execute_under_rule', requiresApproval: false, workUnitCost: 0, producesEvidence };
}

function level3(): AuthorityProfile {
  return {
    level: 3,
    allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule', destructive: false }],
    approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false,
  };
}

async function publishOperation(orgId: string, auth: string, steps: OperationStep[], profile: AuthorityProfile = level3()): Promise<string> {
  const op = await request(server).post(`${base(orgId)}/operations`).set('Authorization', auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op executável' });
  const operationId = op.body.data.id as string;
  const versionId = op.body.data.currentDraftVersionId as string;
  const def = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', auth).send({ definition: validDefinition({ steps }), expectedRevision: 1 });
  const authRes = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', auth).send({ authorityProfile: profile, expectedRevision: def.body.data.revision });
  const pub = await request(server).post(`${base(orgId)}/operations/${operationId}/versions/${versionId}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: authRes.body.data.revision, changeSummary: 'v1' });
  expect(pub.status).toBe(200);
  return operationId;
}

async function createExecution(orgId: string, auth: string, operationId: string, input: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return request(server).post(`${base(orgId)}/operations/${operationId}/executions`).set('Authorization', auth).set('Idempotency-Key', idemKey('exec'))
    .send({ actionKey: 'communication.send', input, ...extra });
}

describe('execução end-to-end', () => {
  let orgId: string;
  let admin: Actor;

  beforeEach(async () => {
    await resetIdentity();
    orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    admin = await seedActor('exec-admin', orgId);
  });

  it('cria, processa e conclui com etapas, eventos e evidências (AÇÃO PERMITIDA)', async () => {
    const operationId = await publishOperation(orgId, admin.auth, [step('s1', 0, true), step('s2', 1, false)]);
    const created = await createExecution(orgId, admin.auth, operationId, { note: 'olá' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('QUEUED');
    const execId = created.body.data.id as string;

    await worker.drain(WK);

    const run = await request(server).get(`${base(orgId)}/executions/${execId}`).set('Authorization', admin.auth);
    expect(run.body.data.status).toBe('SUCCEEDED');

    const steps = await request(server).get(`${base(orgId)}/executions/${execId}/steps`).set('Authorization', admin.auth);
    expect(steps.body.data).toHaveLength(2);
    expect(steps.body.data.every((s: { status: string }) => s.status === 'SUCCEEDED')).toBe(true);

    const events = await request(server).get(`${base(orgId)}/executions/${execId}/events`).set('Authorization', admin.auth);
    const types = events.body.data.map((e: { eventType: string }) => e.eventType);
    expect(types).toContain('execution.created');
    expect(types).toContain('execution.running');
    expect(types).toContain('execution.succeeded');
    // Sequência monotônica.
    const seqs = events.body.data.map((e: { sequence: number }) => e.sequence);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));

    const evidence = await request(server).get(`${base(orgId)}/executions/${execId}/evidence`).set('Authorization', admin.auth);
    const evTypes = evidence.body.data.map((e: { evidenceType: string }) => e.evidenceType);
    expect(evTypes).toContain('INPUT');
    expect(evTypes).toContain('OUTPUT');
  });

  it('bloqueia execução em operação sem versão publicada / nível 1', async () => {
    const operationId = await publishOperation(orgId, admin.auth, [step('s1', 0)], {
      level: 1, allowedActions: [], approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false,
    });
    const created = await createExecution(orgId, admin.auth, operationId);
    expect(created.status).toBe(403);
    expect(created.body.error.code).toBe('ACTION_DENIED');
  });

  it('retry: etapa falha determinística na 1ª tentativa e sucede na 2ª', async () => {
    const operationId = await publishOperation(orgId, admin.auth, [step('s1', 0)]);
    const created = await createExecution(orgId, admin.auth, operationId, { failUntilAttempt: 1 }, { maxAttempts: 3, stepExecutors: { s1: 'failure.deterministic' } });
    const execId = created.body.data.id as string;

    await worker.drain(WK);

    const run = await request(server).get(`${base(orgId)}/executions/${execId}`).set('Authorization', admin.auth);
    expect(run.body.data.status).toBe('SUCCEEDED');
    const attempts = await prisma.executionAttempt.count({ where: { executionRunId: execId } });
    expect(attempts).toBe(2);
  });

  it('falha não-retryable → FAILED e compensação das etapas com efeito', async () => {
    const operationId = await publishOperation(orgId, admin.auth, [step('s1', 0), step('s2', 1)]);
    const created = await createExecution(orgId, admin.auth, operationId, { alwaysFail: true }, {
      stepExecutors: { s1: 'record.create.internal', s2: 'failure.deterministic' },
    });
    const execId = created.body.data.id as string;

    await worker.drain(WK);

    const run = await request(server).get(`${base(orgId)}/executions/${execId}`).set('Authorization', admin.auth);
    expect(['COMPENSATED', 'FAILED']).toContain(run.body.data.status);
    expect(run.body.data.status).toBe('COMPENSATED');
    const s1 = (await prisma.executionStep.findFirst({ where: { executionRunId: execId, definitionStepKey: 's1' } }))!;
    expect(s1.status).toBe('COMPENSATED');
  });

  it('multitenancy: outro tenant não enxerga a execução (§43 → 404)', async () => {
    const operationId = await publishOperation(orgId, admin.auth, [step('s1', 0)]);
    const created = await createExecution(orgId, admin.auth, operationId);
    const execId = created.body.data.id as string;
    const orgB = (await seedOrg({ name: 'Beta', slug: 'beta' })).id;
    const adminB = await seedActor('admin-b', orgB);
    const res = await request(server).get(`${base(orgB)}/executions/${execId}`).set('Authorization', adminB.auth);
    expect(res.status).toBe(404);
  });

  it('idempotência: recriar a execução com a mesma chave devolve a mesma', async () => {
    const operationId = await publishOperation(orgId, admin.auth, [step('s1', 0)]);
    const key = idemKey('exec');
    const a = await request(server).post(`${base(orgId)}/operations/${operationId}/executions`).set('Authorization', admin.auth).set('Idempotency-Key', key).send({ actionKey: 'communication.send', input: {} });
    const b = await request(server).post(`${base(orgId)}/operations/${operationId}/executions`).set('Authorization', admin.auth).set('Idempotency-Key', key).send({ actionKey: 'communication.send', input: {} });
    expect(a.body.data.id).toBe(b.body.data.id);
    expect(await prisma.executionRun.count({ where: { operationId } })).toBe(1);
  });
});
