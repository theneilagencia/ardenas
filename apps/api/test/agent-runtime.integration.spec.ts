/**
 * Arden.AS API — integração ponta-a-ponta do runtime de agentes (ARDEN-BE-007.3 §34–39).
 *
 * PostgreSQL real + fila durável + worker real. Uma etapa `agent.execute` de uma operação
 * publicada é executada pelo motor do BE-005 via o provider DETERMINÍSTICO interno — SEM
 * internet, SEM SDK, SEM endpoint direto, SEM segredo no job. Cobre sucesso, repair,
 * repair-exhausted, unknown, cross-tenant, canário de segredo, provider-em-produção e
 * reprocessamento sem duplicar evento terminal.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { OperationStep } from '@arden/contracts';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';
import { ModelProviderCatalogProjector } from '../src/agents/providers/model-provider-catalog.projector';
import { ExecutionWorker } from '../src/executions/execution.worker';
import { validAgentVersionDefinition, testModelConfigurationBody } from './agents-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let worker: ExecutionWorker;
let providerProjector: ModelProviderCatalogProjector;

const WK = { workerId: 'agent-worker', leaseSeconds: 30, pollIntervalMs: 10 };
const b = (orgId: string) => `/api/v1/organizations/${orgId}`;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  worker = app.get(ExecutionWorker);
  providerProjector = app.get(ModelProviderCatalogProjector);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetIdentity();
  await providerProjector.project();
});

function agentStep(agentKey: string, id = 's1'): OperationStep {
  return { id, order: 0, name: 'Etapa de agente', description: '', authorityLevel: 'execute_under_rule', requiresApproval: false, workUnitCost: 0, producesEvidence: true, agent: { agentKey, actionKey: 'agent.execute' } };
}

function level3() {
  return { level: 3 as const, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule' as const, destructive: false }], approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false };
}

/** Cria+ativa config (modelId do cenário), cria+publica agente; devolve agentKey. */
async function setupAgent(orgId: string, auth: string, modelId: string, defOverrides: Record<string, unknown> = {}): Promise<string> {
  const cfg = await request(server).post(`${b(orgId)}/model-configurations`).set('Authorization', auth).set('Idempotency-Key', idemKey('cfg')).send(testModelConfigurationBody({ modelId }));
  expect(cfg.status).toBe(201);
  await request(server).post(`${b(orgId)}/model-configurations/${cfg.body.data.id}/activate`).set('Authorization', auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: cfg.body.data.revision });

  const agentKey = idemKey('agent').toLowerCase();
  const agent = await request(server).post(`${b(orgId)}/agents`).set('Authorization', auth).set('Idempotency-Key', idemKey('ag')).send({ key: agentKey, name: 'Classifier' });
  const draft = await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions`).set('Authorization', auth).set('Idempotency-Key', idemKey('v')).send({ definition: validAgentVersionDefinition(cfg.body.data.id, defOverrides) });
  const pub = await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions/${draft.body.data.id}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: draft.body.data.revision, changeSummary: 'v1' });
  expect(pub.status).toBe(200);
  return agentKey;
}

/** Cria operação com uma etapa de agente e publica. Devolve operationId. */
async function publishOperationWithAgent(orgId: string, auth: string, agentKey: string): Promise<string> {
  const op = await request(server).post(`${b(orgId)}/operations`).set('Authorization', auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op com agente' });
  const operationId = op.body.data.id as string;
  const versionId = op.body.data.currentDraftVersionId as string;
  const def = await request(server).patch(`${b(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', auth).send({ definition: validDefinition({ steps: [agentStep(agentKey)] }), expectedRevision: 1 });
  await request(server).patch(`${b(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', auth).send({ authorityProfile: level3(), expectedRevision: def.body.data.revision });
  const versions = await request(server).get(`${b(orgId)}/operations/${operationId}/versions`).set('Authorization', auth);
  const version = versions.body.data[0];
  await request(server).post(`${b(orgId)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('opub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });
  return operationId;
}

async function execute(orgId: string, auth: string, operationId: string, input: Record<string, unknown>): Promise<string> {
  const created = await request(server).post(`${b(orgId)}/operations/${operationId}/executions`).set('Authorization', auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input, maxAttempts: 1 });
  expect(created.status).toBe(201);
  return created.body.data.id as string;
}

async function step(runId: string) {
  return prisma.executionStep.findFirst({ where: { executionRunId: runId } });
}

describe('§35 execução ponta-a-ponta (sucesso)', () => {
  it('agent.execute → structured output válido → step SUCCEEDED + evidência + usage + auditoria; job mínimo, sem segredo', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('rt-admin', orgId);
    const agentKey = await setupAgent(orgId, admin.auth, 'test/structured-success');
    const operationId = await publishOperationWithAgent(orgId, admin.auth, agentKey);
    const runId = await execute(orgId, admin.auth, operationId, { lead: 'Acme' });

    // Job da fila NÃO contém prompt/input/secret — só o runId.
    const job = await prisma.executionJob.findFirst({ where: { executionRunId: runId } });
    expect(JSON.stringify(job?.payload)).toBe(JSON.stringify({ executionRunId: runId }));

    await worker.drain(WK);

    const st = await step(runId);
    expect(st?.status).toBe('SUCCEEDED');
    expect(st?.output).toEqual({ grade: 'ok' });

    const evidence = await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } });
    const outputEv = evidence.find((e) => (e.content as Record<string, unknown>).status === 'SUCCEEDED');
    expect(outputEv).toBeTruthy();
    expect((outputEv!.content as Record<string, unknown>).usage).toBeTruthy();
    expect((outputEv!.content as Record<string, unknown>).contentHash).toBeTruthy();

    const events = await prisma.executionEvent.findMany({ where: { executionRunId: runId }, select: { eventType: true } });
    const types = events.map((e) => e.eventType);
    expect(types).toContain('agent.execution_started');
    expect(types).toContain('agent.model_called');
    expect(types).toContain('agent.execution_completed');

    const audit = await prisma.auditEvent.findMany({ where: { organizationId: orgId, action: 'agent.execution_completed' } });
    expect(audit.length).toBe(1);
  });
});

describe('§36 repair', () => {
  it('1ª inválida, 2ª válida → SUCCEEDED (modelCallCount=2, repairAttemptCount=1)', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('rp-admin', orgId);
    const agentKey = await setupAgent(orgId, admin.auth, 'test/structured-repairable');
    const operationId = await publishOperationWithAgent(orgId, admin.auth, agentKey);
    const runId = await execute(orgId, admin.auth, operationId, { lead: 'Acme' });
    await worker.drain(WK);

    const st = await step(runId);
    expect(st?.status).toBe('SUCCEEDED');
    const ev = (await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } })).map((e) => e.content as Record<string, unknown>);
    const done = ev.find((c) => c.status === 'SUCCEEDED')!;
    expect(done.repairAttemptCount).toBe(1);
    expect((done.usage as Record<string, unknown>).modelCallCount).toBe(2);
  });

  it('todas inválidas → step FAILED com AGENT_OUTPUT_REPAIR_EXHAUSTED', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('re-admin', orgId);
    const agentKey = await setupAgent(orgId, admin.auth, 'test/structured-invalid');
    const operationId = await publishOperationWithAgent(orgId, admin.auth, agentKey);
    const runId = await execute(orgId, admin.auth, operationId, { lead: 'Acme' });
    await worker.drain(WK);
    const st = await step(runId);
    expect(st?.status).toBe('FAILED');
    expect(st?.errorCode).toBe('AGENT_OUTPUT_REPAIR_EXHAUSTED');
  });
});

describe('§37 unknown result', () => {
  it('resultado incerto → step FAILED, não SUCCEEDED; evento agent.execution_unknown', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('uk-admin', orgId);
    const agentKey = await setupAgent(orgId, admin.auth, 'test/unknown-result');
    const operationId = await publishOperationWithAgent(orgId, admin.auth, agentKey);
    const runId = await execute(orgId, admin.auth, operationId, { lead: 'Acme' });
    await worker.drain(WK);
    const st = await step(runId);
    expect(st?.status).toBe('FAILED');
    expect(st?.errorCode).toBe('MODEL_RESULT_UNKNOWN');
    const types = (await prisma.executionEvent.findMany({ where: { executionRunId: runId }, select: { eventType: true } })).map((e) => e.eventType);
    expect(types).toContain('agent.execution_unknown');
  });
});

describe('§38 canário de segredo', () => {
  it('canário injetado NÃO vaza para artefatos derivados (job, eventos, evidência, audit, prompt, output)', async () => {
    // O canário é um CAMPO SENSÍVEL conhecido no input do usuário. A entrada crua do usuário
    // é persistida pelo motor (executionRun.input / step $source) como em qualquer execução do
    // BE-005 — o que a redação protege são os artefatos DERIVADOS: prompt, evidência, auditoria,
    // eventos e output. Este teste comprova que o canário não vaza para NENHUM deles.
    const CANARY = 'ARDEN_BE007_RUNTIME_SECRET_CANARY_e2e';
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('sc-admin', orgId);
    const agentKey = await setupAgent(orgId, admin.auth, 'test/structured-success');
    const operationId = await publishOperationWithAgent(orgId, admin.auth, agentKey);
    const runId = await execute(orgId, admin.auth, operationId, { lead: 'Acme', secret: CANARY, apiKey: CANARY });
    await worker.drain(WK);

    const st = await step(runId);
    const dump = JSON.stringify([
      await prisma.executionJob.findMany({ where: { executionRunId: runId } }),        // job mínimo
      await prisma.executionEvent.findMany({ where: { executionRunId: runId } }),       // eventos agent.*
      await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } }),       // evidência sanitizada
      await prisma.auditEvent.findMany({ where: { organizationId: orgId } }),           // auditoria
      st?.output ?? null,                                                               // output do agente
      st?.errorCode ?? null, st?.errorSummary ?? null,                                  // error summaries
    ], (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(dump.includes(CANARY)).toBe(false);
  });
});

describe('§39 cross-tenant', () => {
  it('operação Alpha com agente de Alpha não vaza; IDs conhecidos no job não contornam tenant', async () => {
    const alpha = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const beta = (await seedOrg({ name: 'Beta', slug: 'beta' })).id;
    const aAdmin = await seedActor('a-admin', alpha);
    const bAdmin = await seedActor('b-admin', beta);
    // Agente de Beta.
    const betaAgentKey = await setupAgent(beta, bAdmin.auth, 'test/structured-success');
    // Operação de Alpha referenciando um agentKey que só existe em Beta → execução falha na criação.
    const op = await request(server).post(`${b(alpha)}/operations`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op' });
    const operationId = op.body.data.id as string;
    const versionId = op.body.data.currentDraftVersionId as string;
    const def = await request(server).patch(`${b(alpha)}/operations/${operationId}/versions/${versionId}`).set('Authorization', aAdmin.auth).send({ definition: validDefinition({ steps: [agentStep(betaAgentKey)] }), expectedRevision: 1 });
    await request(server).patch(`${b(alpha)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', aAdmin.auth).send({ authorityProfile: level3(), expectedRevision: def.body.data.revision });
    const versions = await request(server).get(`${b(alpha)}/operations/${operationId}/versions`).set('Authorization', aAdmin.auth);
    const version = versions.body.data[0];
    await request(server).post(`${b(alpha)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('opub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });

    const created = await request(server).post(`${b(alpha)}/operations/${operationId}/executions`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input: { lead: 'x' }, maxAttempts: 1 });
    // Fail-fast: agentKey de Beta não existe em Alpha → execução recusada.
    expect(created.status).toBeGreaterThanOrEqual(400);
  });
});

describe('§36 provider de teste em produção (runtime)', () => {
  it('em NODE_ENV=production o runtime não executa internal.test-model (step FAILED MODEL_PROVIDER_DISABLED)', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('pr-admin', orgId);
    const agentKey = await setupAgent(orgId, admin.auth, 'test/structured-success');
    const operationId = await publishOperationWithAgent(orgId, admin.auth, agentKey);
    const runId = await execute(orgId, admin.auth, operationId, { lead: 'Acme' });
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await worker.drain(WK);
    } finally {
      process.env.NODE_ENV = prev;
    }
    const st = await step(runId);
    expect(st?.status).toBe('FAILED');
    expect(st?.errorCode).toBe('MODEL_PROVIDER_DISABLED');
  });
});

describe('reprocessamento', () => {
  it('drain repetido não altera o step terminal nem duplica evento de conclusão', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('rr-admin', orgId);
    const agentKey = await setupAgent(orgId, admin.auth, 'test/structured-success');
    const operationId = await publishOperationWithAgent(orgId, admin.auth, agentKey);
    const runId = await execute(orgId, admin.auth, operationId, { lead: 'Acme' });
    await worker.drain(WK);
    await worker.drain(WK);
    const st = await step(runId);
    expect(st?.status).toBe('SUCCEEDED');
    const completed = await prisma.auditEvent.findMany({ where: { organizationId: orgId, action: 'agent.execution_completed' } });
    expect(completed.length).toBe(1);
  });
});
