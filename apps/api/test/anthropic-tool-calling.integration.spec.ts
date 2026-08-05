/**
 * Arden.AS API — E2E OFFLINE de tool calling Anthropic (ARDEN-BE-008.5 §42–§49).
 *
 * PostgreSQL + fila + worker REAIS; transporte Anthropic FAKE (offline, sem rede, sem SDK real).
 * O provider comercial PROPÕE a tool call (fake `tool_use`); o servidor resolve (BE-006), avalia
 * autoridade (BE-004), executa via `ExternalToolExecutor` (tool interna, sem internet), isola o
 * resultado, mapeia para `tool_result` e CONTINUA a chamada Anthropic até o structured output.
 * Provider persistido continua DISABLED; um OVERRIDE de teste ativa a linha para o runtime.
 * Comprova: E2E automático, tool desconhecida, produção bloqueada e canário de segredo.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ANTHROPIC_MODEL_CATALOG } from '@arden/contracts';
import type { OperationStep, AgentToolPolicy, AgentExecutionPolicy } from '@arden/contracts';
import { AGENT_EXECUTION_POLICY_SLICE_DEFAULT, AGENT_TOOL_POLICY_SAFE_DEFAULT } from '@arden/contracts';

// Gates de TESTE antes do boot (composição — nunca produção).
process.env.ANTHROPIC_PROVIDER_RUNTIME_ENABLED = 'true';
process.env.ANTHROPIC_TOOL_CALLING_ENABLED = 'true';

import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';
import { validAgentVersionDefinition } from './agents-helpers';
import type { AuthenticatedRequestContext } from '../src/identity/request-context';
import { ExecutionWorker } from '../src/executions/execution.worker';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ConnectionsService } from '../src/connectors/connections/connections.service';
import { ToolBindingsService } from '../src/connectors/tool-bindings/tool-bindings.service';
import { ModelProviderCatalogProjector } from '../src/agents/providers/model-provider-catalog.projector';
import { ModelCatalogProjector } from '../src/agents/providers/project-model-catalog';
import { FakeAnthropicTransport, type FakeAnthropicScenario } from '../src/agents/providers/anthropic/anthropic-fake-transport';
import { InMemoryModelProviderRegistry } from '../src/agents/runtime/model-provider-registry';

const CANARY = 'ARDEN_BE008_ANTHROPIC_TOOL_SECRET_CANARY_e2e5';
const MODEL = ANTHROPIC_MODEL_CATALOG[0].modelId;
const WK = { workerId: 'anthropic-tool-worker', leaseSeconds: 30, pollIntervalMs: 10 };
const b = (orgId: string) => `/api/v1/organizations/${orgId}`;

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let worker: ExecutionWorker;
let connections: ConnectionsService;
let bindings: ToolBindingsService;
let fake: FakeAnthropicTransport;
let registry: InMemoryModelProviderRegistry;
let connectorProjector: ConnectorCatalogProjector;
let providerProjector: ModelProviderCatalogProjector;
let modelProjector: ModelCatalogProjector;

function ctxFor(actor: Actor, orgId: string): AuthenticatedRequestContext {
  return { correlationId: idemKey('corr'), userId: actor.userId, externalSubject: actor.userId, organizationId: orgId, membershipId: null, permissions: new Set<string>(), ipAddress: null, userAgent: null, identityExpiresAt: null };
}
function agentStep(agentKey: string): OperationStep {
  return { id: 's1', order: 0, name: 'Etapa de agente', description: '', authorityLevel: 'execute_under_rule', requiresApproval: false, workUnitCost: 0, producesEvidence: true, agent: { agentKey, actionKey: 'agent.execute' } };
}
function level3() {
  return { level: 3 as const, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule' as const, destructive: false }, { key: 'integration.invoke', semanticLevel: 'execute_under_rule' as const, destructive: false }], approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false };
}
function toolExecPolicy(): AgentExecutionPolicy {
  return { ...AGENT_EXECUTION_POLICY_SLICE_DEFAULT, toolCallingAllowed: true, maximumToolCalls: 5, maximumTurns: 4 } as AgentExecutionPolicy;
}
function toolPolicy(over: Partial<AgentToolPolicy>): AgentToolPolicy {
  return { ...AGENT_TOOL_POLICY_SAFE_DEFAULT, ...over } as AgentToolPolicy;
}

async function activateProvider(): Promise<void> {
  await prisma.modelProviderDefinition.updateMany({ where: { key: 'anthropic.direct' }, data: { status: 'ACTIVE' } });
}

async function anthropicConnection(orgId: string, auth: string): Promise<string> {
  const conn = await request(server).post(`${b(orgId)}/connections`).set('Authorization', auth).set('Idempotency-Key', idemKey('conn'))
    .send({ connectorKey: 'system.anthropic', connectorVersion: '1', name: 'Anthropic', configuration: { baseUrlMode: 'OFFICIAL', timeoutMs: 60000, maximumRetries: 2 } });
  expect(conn.status).toBe(201);
  const id = conn.body.data.id as string;
  await request(server).post(`${b(orgId)}/connections/${id}/credentials`).set('Authorization', auth).set('Idempotency-Key', idemKey('cred')).send({ secret: { apiKey: CANARY } });
  const fresh = await request(server).get(`${b(orgId)}/connections/${id}`).set('Authorization', auth);
  await request(server).post(`${b(orgId)}/connections/${id}/activate`).set('Authorization', auth).send({ expectedRevision: fresh.body.data.revision });
  return id;
}

/** Agente Anthropic com uma tool READ (interna) bound a um alias; operação publicada. */
async function setupToolAgent(orgId: string, actor: Actor): Promise<{ operationId: string }> {
  const auth = actor.auth;
  const ctx = ctxFor(actor, orgId);
  const anthConn = await anthropicConnection(orgId, auth);

  // Tool interna (sem internet): conexão internal.test + org binding + alias.
  const toolConn = (await connections.create(ctx, { connectorKey: 'internal.test', connectorVersion: '1', name: 'it' }, idemKey('c'))).body.data;
  await connections.transitionStatus(ctx, toolConn.id, 'ACTIVE', toolConn.revision);
  const orgBinding = (await bindings.createOrgBinding(ctx, { connectionId: toolConn.id, connectorToolKey: 'test.echo', connectorToolVersion: '1', name: 'reader' }, idemKey('ob'))).body.data;

  // Config Anthropic + agente com tool policy READ.
  const cfg = await request(server).post(`${b(orgId)}/model-configurations`).set('Authorization', auth).set('Idempotency-Key', idemKey('cfg'))
    .send({ providerKey: 'anthropic.direct', providerVersion: '1', name: 'Anthropic cfg', modelId: MODEL, credentialConnectionId: anthConn, parameters: { maximumOutputTokens: 512 } });
  await request(server).post(`${b(orgId)}/model-configurations/${cfg.body.data.id}/activate`).set('Authorization', auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: cfg.body.data.revision });
  const agentKey = idemKey('agent').toLowerCase();
  const agent = await request(server).post(`${b(orgId)}/agents`).set('Authorization', auth).set('Idempotency-Key', idemKey('ag')).send({ key: agentKey, name: 'ToolAgent' });
  const def = validAgentVersionDefinition(cfg.body.data.id, { executionPolicy: toolExecPolicy(), toolPolicy: toolPolicy({ allowedAliases: ['reader'], allowRead: true, requireAuthorizationFor: [] }) });
  const draft = await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions`).set('Authorization', auth).set('Idempotency-Key', idemKey('v')).send({ definition: def });
  await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions/${draft.body.data.id}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: draft.body.data.revision, changeSummary: 'v1' });

  // Operação: etapa de agente + binding do alias + autoridade + publicação.
  const op = await request(server).post(`${b(orgId)}/operations`).set('Authorization', auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op tool anthropic' });
  const operationId = op.body.data.id as string;
  const versionId = op.body.data.currentDraftVersionId as string;
  const patched = await request(server).patch(`${b(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', auth).send({ definition: validDefinition({ steps: [agentStep(agentKey)] }), expectedRevision: 1 });
  await request(server).patch(`${b(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', auth).send({ authorityProfile: level3(), expectedRevision: patched.body.data.revision });
  await bindings.createOperationBinding(ctx, operationId, { organizationToolBindingId: orgBinding.id, alias: 'reader', allowedActionKeys: ['connector.test.echo' as never], inputMapping: {}, outputMapping: {} }, idemKey('opb'));
  const versions = await request(server).get(`${b(orgId)}/operations/${operationId}/versions`).set('Authorization', auth);
  const version = versions.body.data[0];
  await request(server).post(`${b(orgId)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('opub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });
  return { operationId };
}

async function execute(orgId: string, auth: string, operationId: string): Promise<string> {
  const created = await request(server).post(`${b(orgId)}/operations/${operationId}/executions`).set('Authorization', auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input: { lead: 'Acme' }, maxAttempts: 1 });
  expect(created.status).toBe(201);
  return created.body.data.id as string;
}
const agentStepRow = (runId: string) => prisma.executionStep.findFirst({ where: { executionRunId: runId, actionKey: 'agent.execute' } });
const eventTypes = async (runId: string): Promise<string[]> => (await prisma.executionEvent.findMany({ where: { executionRunId: runId }, select: { eventType: true } })).map((e) => e.eventType);

/** O canário do segredo NUNCA aparece em evidência, eventos ou payload de step (persistidos). */
async function noCanary(runId: string): Promise<void> {
  const evidence = await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } });
  const events = await prisma.executionEvent.findMany({ where: { executionRunId: runId } });
  const steps = await prisma.executionStep.findMany({ where: { executionRunId: runId } });
  const haystack = JSON.stringify({ evidence, events, steps }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  expect(haystack).not.toContain(CANARY);
}

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  worker = app.get(ExecutionWorker);
  connections = app.get(ConnectionsService);
  bindings = app.get(ToolBindingsService);
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
  delete process.env.ANTHROPIC_TOOL_CALLING_ENABLED;
});
beforeEach(async () => {
  await resetIdentity();
  await connectorProjector.project();
  await providerProjector.project();
  await modelProjector.project();
  await activateProvider();
  fake.reset();
});

describe('§38/§46 registro condicional', () => {
  it('provider anthropic.direct registrado com gates de runtime + tool calling', () => {
    expect(registry.has('anthropic.direct', '1')).toBe(true);
  });
});

describe('§43 E2E automático offline', () => {
  it('tool_use READ → ALLOW → executor → tool_result → continuação → structured output → SUCCEEDED', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('at-admin', org.id, ['corporate_admin']);
    const fx = await setupToolAgent(org.id, actor);
    fake.setDefault('tool_use_then_output');
    const runId = await execute(org.id, actor.auth, fx.operationId);
    await worker.drain(WK);

    const st = await agentStepRow(runId);
    expect(st?.status).toBe('SUCCEEDED');
    const types = await eventTypes(runId);
    expect(types).toContain('agent.tool_requested');
    expect(types).toContain('agent.tool_execution_succeeded');
    expect(types).toContain('agent.execution_completed');
    // 2 chamadas ao transporte Anthropic: proposta (tool_use) + continuação (structured output).
    expect(fake.calls.length).toBeGreaterThanOrEqual(2);
    // Uma única execução externa da tool (uma evidência de tool call).
    const evidence = await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } });
    const toolEv = evidence.filter((e) => (e.content as Record<string, unknown>).agentToolCall);
    expect(toolEv.length).toBe(1);
    await noCanary(runId);
  });
});

describe('§46 tool desconhecida', () => {
  it('fake retorna admin.delete (não allowlisted) → AGENT_TOOL_NOT_ALLOWED, sem execução', async () => {
    const org = await seedOrg({ name: 'Beta', slug: 'beta' });
    const actor = await seedActor('un-admin', org.id, ['corporate_admin']);
    const fx = await setupToolAgent(org.id, actor);
    fake.setDefault('tool_invalid_alias');
    const runId = await execute(org.id, actor.auth, fx.operationId);
    await worker.drain(WK);

    const st = await agentStepRow(runId);
    expect(st?.status).toBe('FAILED');
    const types = await eventTypes(runId);
    expect(types).toContain('agent.tool_call_rejected');
    expect(types).not.toContain('agent.tool_execution_succeeded');
  });
});

describe('§49 produção bloqueada', () => {
  it('NODE_ENV=production com tools → MODEL_PROVIDER_DISABLED (transporte não chamado)', async () => {
    const org = await seedOrg({ name: 'Gamma', slug: 'gamma' });
    const actor = await seedActor('pr-admin', org.id, ['corporate_admin']);
    const fx = await setupToolAgent(org.id, actor);
    fake.setDefault('tool_use_then_output');
    const before = fake.calls.length;
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const runId = await execute(org.id, actor.auth, fx.operationId);
      await worker.drain(WK);
      const st = await agentStepRow(runId);
      expect(st?.status).toBe('FAILED');
      expect(fake.calls.length).toBe(before); // transporte NÃO chamado.
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
