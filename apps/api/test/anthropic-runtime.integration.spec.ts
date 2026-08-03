/**
 * Arden.AS API — E2E OFFLINE do provider Anthropic gated (ARDEN-BE-008.3 §46–§53).
 *
 * PostgreSQL + fila + worker REAIS; transporte FAKE (offline, sem rede, sem SDK real).
 * Gate de runtime ON (fora de produção). Provider persistido continua DISABLED/productionAllowed
 * false; para o runtime, um OVERRIDE de teste ativa a linha do provider (§20/§21). Comprova:
 * structured output, retry, UNKNOWN, bloqueio em produção, cross-tenant e canário de segredo.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ANTHROPIC_MODEL_CATALOG } from '@arden/contracts';

// Gate de runtime ON antes do boot (composição de TESTE — nunca produção).
process.env.ANTHROPIC_PROVIDER_RUNTIME_ENABLED = 'true';

import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';
import { validAgentVersionDefinition } from './agents-helpers';
import { ExecutionWorker } from '../src/executions/execution.worker';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ModelProviderCatalogProjector } from '../src/agents/providers/model-provider-catalog.projector';
import { ModelCatalogProjector } from '../src/agents/providers/project-model-catalog';
import { FakeAnthropicTransport } from '../src/agents/providers/anthropic/anthropic-fake-transport';
import { InMemoryModelProviderRegistry } from '../src/agents/runtime/model-provider-registry';

const CANARY = 'ARDEN_BE008_ANTHROPIC_RUNTIME_SECRET_CANARY_e2e42';
const MODEL = ANTHROPIC_MODEL_CATALOG[0].modelId;
const WK = { workerId: 'anthropic-worker', leaseSeconds: 30, pollIntervalMs: 10 };

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let worker: ExecutionWorker;
let fake: FakeAnthropicTransport;
let registry: InMemoryModelProviderRegistry;
let connectorProjector: ConnectorCatalogProjector;
let providerProjector: ModelProviderCatalogProjector;
let modelProjector: ModelCatalogProjector;

const b = (orgId: string) => `/api/v1/organizations/${orgId}`;

async function activateAnthropicProviderForRuntime(): Promise<void> {
  // OVERRIDE de TESTE (§20/§21): ativa a LINHA do provider para o runtime — o catálogo
  // canônico/seed permanece DISABLED. productionAllowed continua false.
  await prisma.modelProviderDefinition.updateMany({ where: { key: 'anthropic.direct' }, data: { status: 'ACTIVE' } });
}

async function setupAnthropicConnection(orgId: string, auth: string): Promise<string> {
  const conn = await request(server).post(`${b(orgId)}/connections`).set('Authorization', auth).set('Idempotency-Key', idemKey('conn'))
    .send({ connectorKey: 'system.anthropic', connectorVersion: '1', name: 'Anthropic', configuration: { baseUrlMode: 'OFFICIAL', timeoutMs: 60000, maximumRetries: 2 } });
  expect(conn.status).toBe(201);
  const id = conn.body.data.id as string;
  await request(server).post(`${b(orgId)}/connections/${id}/credentials`).set('Authorization', auth).set('Idempotency-Key', idemKey('cred')).send({ secret: { apiKey: CANARY } });
  // Ativa a conexão (resolução de credencial exige conexão ACTIVE).
  const fresh = await request(server).get(`${b(orgId)}/connections/${id}`).set('Authorization', auth);
  const act = await request(server).post(`${b(orgId)}/connections/${id}/activate`).set('Authorization', auth).send({ expectedRevision: fresh.body.data.revision });
  expect(act.status).toBe(200);
  return id;
}

/** Cria+ativa config Anthropic e cria+publica um agente; devolve agentKey. */
async function setupAnthropicAgent(orgId: string, auth: string, connectionId: string): Promise<string> {
  const cfg = await request(server).post(`${b(orgId)}/model-configurations`).set('Authorization', auth).set('Idempotency-Key', idemKey('cfg'))
    .send({ providerKey: 'anthropic.direct', providerVersion: '1', name: 'Anthropic cfg', modelId: MODEL, credentialConnectionId: connectionId, parameters: { maximumOutputTokens: 512 } });
  expect(cfg.status).toBe(201);
  const act = await request(server).post(`${b(orgId)}/model-configurations/${cfg.body.data.id}/activate`).set('Authorization', auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: cfg.body.data.revision });
  expect(act.status).toBe(200);

  const agentKey = idemKey('agent').toLowerCase();
  const agent = await request(server).post(`${b(orgId)}/agents`).set('Authorization', auth).set('Idempotency-Key', idemKey('ag')).send({ key: agentKey, name: 'Classifier' });
  const draft = await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions`).set('Authorization', auth).set('Idempotency-Key', idemKey('v')).send({ definition: validAgentVersionDefinition(cfg.body.data.id) });
  const pub = await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions/${draft.body.data.id}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: draft.body.data.revision, changeSummary: 'v1' });
  expect(pub.status).toBe(200);
  return agentKey;
}

function agentStep(agentKey: string) {
  return { id: 's1', order: 0, name: 'Etapa de agente', description: '', authorityLevel: 'execute_under_rule' as const, requiresApproval: false, workUnitCost: 0, producesEvidence: true, agent: { agentKey, actionKey: 'agent.execute' } };
}
function level3() {
  return { level: 3 as const, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule' as const, destructive: false }], approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false };
}

async function publishOperation(orgId: string, auth: string, agentKey: string): Promise<string> {
  const op = await request(server).post(`${b(orgId)}/operations`).set('Authorization', auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op Anthropic' });
  const operationId = op.body.data.id as string;
  const versionId = op.body.data.currentDraftVersionId as string;
  const def = await request(server).patch(`${b(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', auth).send({ definition: validDefinition({ steps: [agentStep(agentKey)] }), expectedRevision: 1 });
  await request(server).patch(`${b(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', auth).send({ authorityProfile: level3(), expectedRevision: def.body.data.revision });
  const versions = await request(server).get(`${b(orgId)}/operations/${operationId}/versions`).set('Authorization', auth);
  const version = versions.body.data[0];
  await request(server).post(`${b(orgId)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('opub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });
  return operationId;
}

async function execute(orgId: string, auth: string, operationId: string): Promise<string> {
  const created = await request(server).post(`${b(orgId)}/operations/${operationId}/executions`).set('Authorization', auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input: { lead: 'Acme' }, maxAttempts: 1 });
  expect(created.status).toBe(201);
  return created.body.data.id as string;
}
const step = (runId: string) => prisma.executionStep.findFirst({ where: { executionRunId: runId } });

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  worker = app.get(ExecutionWorker);
  fake = app.get(FakeAnthropicTransport);
  registry = app.get(InMemoryModelProviderRegistry);
  connectorProjector = app.get(ConnectorCatalogProjector);
  providerProjector = app.get(ModelProviderCatalogProjector);
  modelProjector = app.get(ModelCatalogProjector);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
  delete process.env.ANTHROPIC_PROVIDER_RUNTIME_ENABLED;
});
beforeEach(async () => {
  await resetIdentity();
  await connectorProjector.project();
  await providerProjector.project();
  await modelProjector.project();
  await activateAnthropicProviderForRuntime();
  fake.reset();
});

describe('§46 registro condicional', () => {
  it('gate ON (teste): provider anthropic.direct registrado no registry', () => {
    expect(registry.has('anthropic.direct', '1')).toBe(true);
  });
});

describe('§47 E2E offline — structured output', () => {
  it('agent.execute → fake structured success → SUCCEEDED, usage, custo null, sem rede', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('an-admin', orgId);
    const connectionId = await setupAnthropicConnection(orgId, admin.auth);
    const agentKey = await setupAnthropicAgent(orgId, admin.auth, connectionId);
    const operationId = await publishOperation(orgId, admin.auth, agentKey);
    fake.setDefault('structured_success');
    const runId = await execute(orgId, admin.auth, operationId);
    await worker.drain(WK);

    const st = await step(runId);
    expect(st?.status).toBe('SUCCEEDED');
    expect(st?.output).toEqual({ grade: 'grade-ok' });
    expect(fake.calls.length).toBe(1);
    expect(fake.lastApiKeyLength).toBe(CANARY.length);

    // Usage persistida; custo NULL (sem rate card comercial) — nunca zero inventado.
    const usage = await prisma.agentModelCallUsage.findFirst({ where: { modelId: MODEL } });
    expect(usage?.providerKey).toBe('anthropic.direct');
    expect(usage?.estimatedCostMinor).toBeNull();
    expect(usage?.currency).toBeNull();
  });
});

describe('§51 retry controlado', () => {
  it('rate limit → retry → SUCCEEDED (2 chamadas ao transporte)', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('an-admin', orgId);
    const connectionId = await setupAnthropicConnection(orgId, admin.auth);
    const agentKey = await setupAnthropicAgent(orgId, admin.auth, connectionId);
    const operationId = await publishOperation(orgId, admin.auth, agentKey);
    fake.enqueue('rate_limit', 'structured_success');
    const runId = await execute(orgId, admin.auth, operationId);
    await worker.drain(WK);
    expect((await step(runId))?.status).toBe('SUCCEEDED');
    expect(fake.calls.length).toBe(2);
  });
});

describe('§52 UNKNOWN', () => {
  it('timeout após envio → step FAILED MODEL_RESULT_UNKNOWN, sem sucesso', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('an-admin', orgId);
    const connectionId = await setupAnthropicConnection(orgId, admin.auth);
    const agentKey = await setupAnthropicAgent(orgId, admin.auth, connectionId);
    const operationId = await publishOperation(orgId, admin.auth, agentKey);
    fake.setDefault('timeout_after_send');
    const runId = await execute(orgId, admin.auth, operationId);
    await worker.drain(WK);
    const st = await step(runId);
    expect(st?.status).toBe('FAILED');
    expect(st?.errorCode).toBe('MODEL_RESULT_UNKNOWN');
    expect(st?.output).toBeNull();
    expect(fake.calls.length).toBe(1);
  });
});

describe('§49 bloqueio em produção', () => {
  it('NODE_ENV=production + provider productionAllowed=false → MODEL_PROVIDER_DISABLED, transporte NÃO chamado', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('an-admin', orgId);
    const connectionId = await setupAnthropicConnection(orgId, admin.auth);
    const agentKey = await setupAnthropicAgent(orgId, admin.auth, connectionId);
    const operationId = await publishOperation(orgId, admin.auth, agentKey);
    fake.setDefault('structured_success');
    const runId = await execute(orgId, admin.auth, operationId);
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
    expect(fake.calls.length).toBe(0);
  });
});

describe('§53 cross-tenant', () => {
  it('config de Alpha aponta para conexão de Beta → falha, transporte NÃO chamado', async () => {
    const alpha = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const alphaAdmin = await seedActor('alpha-admin', alpha);
    const beta = (await seedOrg({ name: 'Beta', slug: 'beta' })).id;
    const betaAdmin = await seedActor('beta-admin', beta);
    const betaConn = await setupAnthropicConnection(beta, betaAdmin.auth);
    // Alpha cria conexão própria mas aponta a config para a conexão de Beta via DB (força cross-tenant).
    const alphaConn = await setupAnthropicConnection(alpha, alphaAdmin.auth);
    const agentKey = await setupAnthropicAgent(alpha, alphaAdmin.auth, alphaConn);
    // Reaponta a config de Alpha para a conexão de Beta (fura o tenant no dado).
    await prisma.modelConfiguration.updateMany({ where: { organizationId: alpha, credentialConnectionId: alphaConn }, data: { credentialConnectionId: betaConn } });
    const operationId = await publishOperation(alpha, alphaAdmin.auth, agentKey);
    fake.setDefault('structured_success');
    const runId = await execute(alpha, alphaAdmin.auth, operationId);
    await worker.drain(WK);
    const st = await step(runId);
    expect(st?.status).toBe('FAILED');
    expect(fake.calls.length).toBe(0);
  });
});

describe('§50 canário de segredo', () => {
  it('apiKey ausente de job, evidência, auditoria, usage e step', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('an-admin', orgId);
    const connectionId = await setupAnthropicConnection(orgId, admin.auth);
    const agentKey = await setupAnthropicAgent(orgId, admin.auth, connectionId);
    const operationId = await publishOperation(orgId, admin.auth, agentKey);
    fake.setDefault('structured_success');
    const runId = await execute(orgId, admin.auth, operationId);
    await worker.drain(WK);

    const job = await prisma.executionJob.findFirst({ where: { executionRunId: runId } });
    const evidence = await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } });
    const audit = await prisma.auditEvent.findMany({ where: { organizationId: orgId } });
    const usage = await prisma.agentModelCallUsage.findMany({ where: { modelId: MODEL } });
    const st = await step(runId);
    const blob = JSON.stringify({ job, evidence, audit, usage, st });
    expect(blob).not.toContain(CANARY);
    // Plaintext do canário não existe no banco (só ciphertext no cofre).
    const versions = await prisma.connectionCredentialVersion.findMany({ where: { connectionId } });
    expect(JSON.stringify(versions)).not.toContain(CANARY);
  });
});
