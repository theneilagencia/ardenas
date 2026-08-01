/**
 * Arden.AS API — testes críticos de execução (ARDEN-BE-005 §40–§42).
 * Consumo duplo de autorização, recuperação após worker interrompido e pausa real.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AuthorityProfile, OperationStep } from '@arden/contracts';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';
import { ExecutionWorker } from '../src/executions/execution.worker';
import { ExecutionQueue } from '../src/executions/execution.queue';
import { hashActionPayload } from '../src/enforcement/action-payload';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let worker: ExecutionWorker;
let queue: ExecutionQueue;

const WK = { workerId: 'wk', leaseSeconds: 30, pollIntervalMs: 10 };

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  worker = app.get(ExecutionWorker);
  queue = app.get(ExecutionQueue);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const base = (orgId: string) => `/api/v1/organizations/${orgId}`;

function step(id: string, order: number): OperationStep {
  return { id, order, name: `Etapa ${order}`, description: '', authorityLevel: 'execute_under_rule', requiresApproval: false, workUnitCost: 0, producesEvidence: false };
}
function level3(): AuthorityProfile {
  return { level: 3, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule', destructive: false }], approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false };
}
function level4(): AuthorityProfile {
  return { level: 4, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_with_approval', destructive: false }], approvalRequired: true, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false };
}

async function publish(orgId: string, auth: string, steps: OperationStep[], profile: AuthorityProfile): Promise<{ operationId: string; versionId: string }> {
  const op = await request(server).post(`${base(orgId)}/operations`).set('Authorization', auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op' });
  const operationId = op.body.data.id as string;
  const versionId = op.body.data.currentDraftVersionId as string;
  const def = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', auth).send({ definition: validDefinition({ steps }), expectedRevision: 1 });
  const a = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', auth).send({ authorityProfile: profile, expectedRevision: def.body.data.revision });
  await request(server).post(`${base(orgId)}/operations/${operationId}/versions/${versionId}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: a.body.data.revision, changeSummary: 'v1' });
  return { operationId, versionId };
}

describe('execução — testes críticos', () => {
  let orgId: string;
  let admin: Actor;

  beforeEach(async () => {
    await resetIdentity();
    orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    admin = await seedActor('exec-admin', orgId);
  });

  it('§40 consumo duplo: dois requests com a mesma autorização → UMA execução', async () => {
    const { operationId, versionId } = await publish(orgId, admin.auth, [step('s1', 0)], level4());
    const input = { channel: 'external' };
    const inputHash = hashActionPayload('communication.send', input);
    const authz = await prisma.actionAuthorization.create({
      data: { organizationId: orgId, operationId, operationVersionId: versionId, actionKey: 'communication.send', actionPayloadHash: inputHash, grantedToUserId: admin.userId, status: 'ACTIVE', correlationId: 'seed', authoritySnapshot: {}, policySnapshot: {} },
    });

    const fire = () => request(server).post(`${base(orgId)}/operations/${operationId}/executions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('exec'))
      .send({ actionKey: 'communication.send', input, actionAuthorizationId: authz.id });
    const [a, b] = await Promise.all([fire(), fire()]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await prisma.executionRun.count({ where: { operationId } })).toBe(1);
    const fresh = await prisma.actionAuthorization.findUniqueOrThrow({ where: { id: authz.id } });
    expect(fresh.status).toBe('USED');
    expect(await prisma.executionJob.count({ where: { organizationId: orgId } })).toBe(1);
    const failed = [a, b].find((r) => r.status === 409)!;
    expect(failed.body.error.code).toBe('AUTHORIZATION_ALREADY_USED');
  });

  it('§40b autorização exigida ausente → 403 AUTHORIZATION_REQUIRED', async () => {
    const { operationId } = await publish(orgId, admin.auth, [step('s1', 0)], level4());
    const res = await request(server).post(`${base(orgId)}/operations/${operationId}/executions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('exec'))
      .send({ actionKey: 'communication.send', input: { channel: 'external' } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTHORIZATION_REQUIRED');
  });

  it('§41 recuperação: worker morto (lease expirado) → job recuperado, sem repetir etapa concluída', async () => {
    const { operationId } = await publish(orgId, admin.auth, [step('s1', 0), step('s2', 1)], level3());
    const created = await request(server).post(`${base(orgId)}/operations/${operationId}/executions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('exec'))
      .send({ actionKey: 'communication.send', input: {}, stepExecutors: { s1: 'record.create.internal', s2: 'record.create.internal' } });
    const execId = created.body.data.id as string;

    // Worker A adquire o job e conclui a etapa 1; então "morre" (lease expira).
    const job = await queue.acquire('worker-A', 30);
    expect(job).toBeTruthy();
    const s1 = (await prisma.executionStep.findFirstOrThrow({ where: { executionRunId: execId, definitionStepKey: 's1' } }));
    await prisma.executionRun.update({ where: { id: execId }, data: { status: 'RUNNING', startedAt: new Date() } });
    await prisma.executionStep.update({ where: { id: s1.id }, data: { status: 'SUCCEEDED', attemptCount: 1, completedAt: new Date(), output: { recordId: 'rec_x' } } });
    await prisma.executionAttempt.create({ data: { organizationId: orgId, executionRunId: execId, executionStepId: s1.id, attemptNumber: 1, workerId: 'worker-A', status: 'SUCCEEDED', completedAt: new Date() } });
    // Lease expirado.
    await prisma.executionJob.update({ where: { id: job!.id }, data: { leaseExpiresAt: new Date(Date.now() - 60_000) } });

    // Worker B recupera e drena.
    await worker.drain(WK);

    const run = await request(server).get(`${base(orgId)}/executions/${execId}`).set('Authorization', admin.auth);
    expect(run.body.data.status).toBe('SUCCEEDED');
    // Etapa 1 não repetida: continua com uma única tentativa.
    expect(await prisma.executionAttempt.count({ where: { executionStepId: s1.id } })).toBe(1);
    const s2 = await prisma.executionStep.findFirstOrThrow({ where: { executionRunId: execId, definitionStepKey: 's2' } });
    expect(s2.status).toBe('SUCCEEDED');
    const events = await request(server).get(`${base(orgId)}/executions/${execId}/events`).set('Authorization', admin.auth);
    expect(events.body.data.map((e: { eventType: string }) => e.eventType)).toContain('execution_job.recovered');
  });

  it('§42 pausa real: worker não inicia etapas enquanto pausado; retoma e conclui', async () => {
    const { operationId } = await publish(orgId, admin.auth, [step('s1', 0), step('s2', 1)], level3());
    const created = await request(server).post(`${base(orgId)}/operations/${operationId}/executions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('exec'))
      .send({ actionKey: 'communication.send', input: {} });
    const execId = created.body.data.id as string;
    const rev = created.body.data.revision as number;

    // Pausa antes de processar.
    const paused = await request(server).post(`${base(orgId)}/executions/${execId}/pause`).set('Authorization', admin.auth).send({ expectedRevision: rev });
    expect(paused.status).toBe(200);
    expect(paused.body.data.status).toBe('PAUSE_REQUESTED');

    await worker.drain(WK);
    const afterPause = await request(server).get(`${base(orgId)}/executions/${execId}`).set('Authorization', admin.auth);
    expect(afterPause.body.data.status).toBe('PAUSED');
    // Nenhuma etapa iniciou enquanto pausado.
    expect(await prisma.executionStep.count({ where: { executionRunId: execId, status: { not: 'PENDING' } } })).toBe(0);

    // Retoma e conclui.
    const resumed = await request(server).post(`${base(orgId)}/executions/${execId}/resume`).set('Authorization', admin.auth).send({ expectedRevision: afterPause.body.data.revision });
    expect(resumed.status).toBe(200);
    await worker.drain(WK);
    const done = await request(server).get(`${base(orgId)}/executions/${execId}`).set('Authorization', admin.auth);
    expect(done.body.data.status).toBe('SUCCEEDED');
    const types = (await request(server).get(`${base(orgId)}/executions/${execId}/events`).set('Authorization', admin.auth)).body.data.map((e: { eventType: string }) => e.eventType);
    expect(types).toContain('execution.paused');
    expect(types).toContain('execution.succeeded');
  });
});
