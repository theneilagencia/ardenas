/**
 * Arden.AS API — integração de tool calling do agente (ARDEN-BE-007.5 §36–45).
 *
 * PostgreSQL real + fila + worker + servidor. O provider DETERMINÍSTICO interno propõe a
 * tool call; o servidor resolve (BE-006), avalia autoridade (BE-004), executa via
 * `ExternalToolExecutor` (tool interna `connector.test.*`, sem internet), isola o resultado
 * e continua o loop. Cobre READ, WRITE com aprovação (suspende/retoma), DENY, UNKNOWN,
 * injeção via resultado, cross-tenant, limites e canário de segredo.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { OperationStep, AgentToolPolicy, AgentExecutionPolicy } from '@arden/contracts';
import {
  AGENT_EXECUTION_POLICY_SLICE_DEFAULT,
  AGENT_TOOL_POLICY_SAFE_DEFAULT,
} from '@arden/contracts';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';
import type { AuthenticatedRequestContext } from '../src/identity/request-context';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ConnectionsService } from '../src/connectors/connections/connections.service';
import { ToolBindingsService } from '../src/connectors/tool-bindings/tool-bindings.service';
import { ModelProviderCatalogProjector } from '../src/agents/providers/model-provider-catalog.projector';
import { ExecutionWorker } from '../src/executions/execution.worker';
import { validAgentVersionDefinition, testModelConfigurationBody } from './agents-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let worker: ExecutionWorker;
let connections: ConnectionsService;
let bindings: ToolBindingsService;
let catalog: ConnectorCatalogProjector;
let providerProjector: ModelProviderCatalogProjector;

const WK = { workerId: 'agent-tool-worker', leaseSeconds: 30, pollIntervalMs: 10 };
const b = (orgId: string) => `/api/v1/organizations/${orgId}`;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  worker = app.get(ExecutionWorker);
  connections = app.get(ConnectionsService);
  bindings = app.get(ToolBindingsService);
  catalog = app.get(ConnectorCatalogProjector);
  providerProjector = app.get(ModelProviderCatalogProjector);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetIdentity();
  await catalog.project();
  await providerProjector.project();
});

function ctxFor(actor: Actor, orgId: string): AuthenticatedRequestContext {
  return { correlationId: idemKey('corr'), userId: actor.userId, externalSubject: actor.userId, organizationId: orgId, membershipId: null, permissions: new Set<string>(), ipAddress: null, userAgent: null, identityExpiresAt: null };
}
function agentStep(agentKey: string, id = 's1'): OperationStep {
  return { id, order: 0, name: 'Etapa de agente', description: '', authorityLevel: 'execute_under_rule', requiresApproval: false, workUnitCost: 0, producesEvidence: true, agent: { agentKey, actionKey: 'agent.execute' } };
}
/** Perfil de autoridade: communication.send liberado; integration.invoke conforme `invokeSemantic`. */
function authorityProfile(invokeSemantic: 'execute_under_rule' | 'execute_with_approval', approvalPolicyId: string | null = null) {
  return {
    level: 3 as const,
    allowedActions: [
      { key: 'communication.send', semanticLevel: 'execute_under_rule' as const, destructive: false },
      { key: 'integration.invoke', semanticLevel: invokeSemantic, destructive: false },
    ],
    approvalRequired: false, approvalPolicyId, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false,
  };
}
function toolExecPolicy(): AgentExecutionPolicy {
  return { ...AGENT_EXECUTION_POLICY_SLICE_DEFAULT, toolCallingAllowed: true, maximumToolCalls: 5, maximumTurns: 4 } as AgentExecutionPolicy;
}
function toolPolicy(over: Partial<AgentToolPolicy>): AgentToolPolicy {
  return { ...AGENT_TOOL_POLICY_SAFE_DEFAULT, ...over } as AgentToolPolicy;
}

/** Fluxo de aprovação ativo com uma etapa (elegível por papel). */
async function activeFlow(orgId: string, auth: string, eligibleRoleKey: string): Promise<string> {
  const flow = await request(server).post(`${b(orgId)}/approval-flows`).set('Authorization', auth).set('Idempotency-Key', idemKey('flow')).send({
    key: `flow-${idemKey('k')}`, name: 'Fluxo', steps: [{ sequence: 1, name: 'Etapa 1', decisionMode: 'ANY_ONE', requesterCannotApprove: true, justificationRequired: false, eligibleRoleKey }],
  });
  expect(flow.status).toBe(201);
  await request(server).post(`${b(orgId)}/approval-flows/${flow.body.data.id}/activate`).set('Authorization', auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: flow.body.data.revision });
  return flow.body.data.id as string;
}

interface ToolAgentFixture { operationId: string; agentKey: string; }

/** Cria conexão internal.test + org binding + agente (toolPolicy) + operação (etapa de agente + binding do alias) publicada. */
async function setupToolAgent(orgId: string, actor: Actor, opts: {
  modelId: string; toolKey: string; alias: string; actionKey: string; tp: AgentToolPolicy;
  invokeSemantic: 'execute_under_rule' | 'execute_with_approval'; approvalPolicyId?: string | null;
}): Promise<ToolAgentFixture> {
  const auth = actor.auth;
  const ctx = ctxFor(actor, orgId);

  // Conexão internal.test (sem credencial) ativa + binding da organização para a tool.
  const conn = (await connections.create(ctx, { connectorKey: 'internal.test', connectorVersion: '1', name: 'it' }, idemKey('c'))).body.data;
  await connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision);
  const orgBinding = (await bindings.createOrgBinding(ctx, { connectionId: conn.id, connectorToolKey: opts.toolKey, connectorToolVersion: '1', name: opts.alias }, idemKey('ob'))).body.data;

  // Config + agente com toolPolicy/executionPolicy de tool calling.
  const cfg = await request(server).post(`${b(orgId)}/model-configurations`).set('Authorization', auth).set('Idempotency-Key', idemKey('cfg')).send(testModelConfigurationBody({ modelId: opts.modelId }));
  await request(server).post(`${b(orgId)}/model-configurations/${cfg.body.data.id}/activate`).set('Authorization', auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: cfg.body.data.revision });
  const agentKey = idemKey('agent').toLowerCase();
  const agent = await request(server).post(`${b(orgId)}/agents`).set('Authorization', auth).set('Idempotency-Key', idemKey('ag')).send({ key: agentKey, name: 'ToolAgent' });
  const def = validAgentVersionDefinition(cfg.body.data.id, { executionPolicy: toolExecPolicy(), toolPolicy: opts.tp });
  const draft = await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions`).set('Authorization', auth).set('Idempotency-Key', idemKey('v')).send({ definition: def });
  const pub = await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions/${draft.body.data.id}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: draft.body.data.revision, changeSummary: 'v1' });
  expect(pub.status).toBe(200);

  // Operação: etapa de agente + binding do alias + autoridade + publicação.
  const op = await request(server).post(`${b(orgId)}/operations`).set('Authorization', auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op tool agente' });
  const operationId = op.body.data.id as string;
  const versionId = op.body.data.currentDraftVersionId as string;
  const patched = await request(server).patch(`${b(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', auth).send({ definition: validDefinition({ steps: [agentStep(agentKey)] }), expectedRevision: 1 });
  await request(server).patch(`${b(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', auth).send({ authorityProfile: authorityProfile(opts.invokeSemantic, opts.approvalPolicyId ?? null), expectedRevision: patched.body.data.revision });
  await bindings.createOperationBinding(ctx, operationId, { organizationToolBindingId: orgBinding.id, alias: opts.alias, allowedActionKeys: [opts.actionKey as never], inputMapping: {}, outputMapping: {} }, idemKey('opb'));
  const versions = await request(server).get(`${b(orgId)}/operations/${operationId}/versions`).set('Authorization', auth);
  const version = versions.body.data[0];
  await request(server).post(`${b(orgId)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('opub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });
  return { operationId, agentKey };
}

async function execute(orgId: string, auth: string, operationId: string, input: Record<string, unknown> = { lead: 'Acme' }): Promise<string> {
  const created = await request(server).post(`${b(orgId)}/operations/${operationId}/executions`).set('Authorization', auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input, maxAttempts: 1 });
  expect(created.status).toBe(201);
  return created.body.data.id as string;
}
async function agentStepRow(runId: string) {
  return prisma.executionStep.findFirst({ where: { executionRunId: runId, actionKey: 'agent.execute' } });
}
async function eventTypes(runId: string): Promise<string[]> {
  return (await prisma.executionEvent.findMany({ where: { executionRunId: runId }, select: { eventType: true } })).map((e) => e.eventType);
}

// ── §37 READ ─────────────────────────────────────────────────────────────────────
describe('§37 tool READ permitida', () => {
  it('provider pede READ → executa → resultado isolado → output final → SUCCEEDED', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('rd-admin', org.id, ['corporate_admin']);
    const fx = await setupToolAgent(org.id, actor, { modelId: 'test/tool-read-success', toolKey: 'test.echo', alias: 'reader', actionKey: 'connector.test.echo', tp: toolPolicy({ allowedAliases: ['reader'], allowRead: true, requireAuthorizationFor: [] }), invokeSemantic: 'execute_under_rule' });
    const runId = await execute(org.id, actor.auth, fx.operationId);
    await worker.drain(WK);

    const st = await agentStepRow(runId);
    expect(st?.status).toBe('SUCCEEDED');
    const types = await eventTypes(runId);
    expect(types).toContain('agent.tool_requested');
    expect(types).toContain('agent.tool_execution_succeeded');
    expect(types).toContain('agent.tool_result_isolated');
    expect(types).toContain('agent.execution_completed');
    // Uma única execução externa da tool (uma evidência de tool call).
    const ev = await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } });
    const toolEv = ev.filter((e) => (e.content as Record<string, unknown>).agentToolCall);
    expect(toolEv.length).toBe(1);
  });
});

// ── §38 WRITE com aprovação (suspende → aprova → retoma → executa uma vez) ──────────
describe('§38 tool WRITE requer aprovação, suspende e retoma', () => {
  it('suspende sem executar; após aprovação humana retoma e executa uma única vez', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const admin = await seedActor('wa-admin', org.id, ['corporate_admin']);
    const approver = await seedActor('wa-approver', org.id, ['approver']);
    const flowId = await activeFlow(org.id, admin.auth, 'approver');
    const fx = await setupToolAgent(org.id, admin, { modelId: 'test/tool-write-authorized', toolKey: 'test.write', alias: 'writer', actionKey: 'connector.test.write', tp: toolPolicy({ allowedAliases: ['writer'], allowWrite: true, requireAuthorizationFor: ['WRITE'] }), invokeSemantic: 'execute_with_approval', approvalPolicyId: flowId });
    const runId = await execute(org.id, admin.auth, fx.operationId);

    // 1º drain: suspende aguardando aprovação; a tool NÃO executa.
    await worker.drain(WK);
    let st = await agentStepRow(runId);
    expect(st?.status).toBe('PAUSED');
    const run1 = await prisma.executionRun.findUnique({ where: { id: runId } });
    expect(run1?.status).toBe('PAUSED');
    const pendingReq = await prisma.approvalRequest.findFirst({ where: { organizationId: org.id, status: 'PENDING' } });
    expect(pendingReq).toBeTruthy();
    // Nenhuma evidência de execução de tool ainda.
    const before = await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } });
    expect(before.filter((e) => (e.content as Record<string, unknown>).agentToolCall && ((e.content as Record<string, unknown>).agentToolCall as Record<string, unknown>).status === 'SUCCEEDED').length).toBe(0);

    // Aprovação humana (emite ActionAuthorization single-use).
    const approve = await request(server).post(`${b(org.id)}/approval-requests/${pendingReq!.id}/approve`).set('Authorization', approver.auth).send({ expectedRevision: pendingReq!.revision, justification: 'ok' });
    expect(approve.status).toBe(200);

    // Retoma a execução (endpoint existente) → worker reprocessa a etapa.
    const resume = await request(server).post(`${b(org.id)}/executions/${runId}/resume`).set('Authorization', admin.auth).send({ expectedRevision: run1!.revision });
    expect(resume.status).toBe(200);
    await worker.drain(WK);

    st = await agentStepRow(runId);
    expect(st?.status).toBe('SUCCEEDED');
    // Autorização consumida (single-use) exatamente uma vez.
    const auths = await prisma.actionAuthorization.findMany({ where: { organizationId: org.id, actionKey: 'integration.invoke' } });
    expect(auths.length).toBe(1);
    expect(auths[0].status).toBe('USED');
    const types = await eventTypes(runId);
    expect(types).toContain('agent.tool_approval_requested');
    expect(types).toContain('agent.tool_execution_succeeded');
  });
});

// ── §39 DENY ───────────────────────────────────────────────────────────────────────
describe('§39 tool negada pela política do agente', () => {
  it('WRITE com allowWrite=false → DENIED; tool não executa; modelo finaliza', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('dn-admin', org.id, ['corporate_admin']);
    const fx = await setupToolAgent(org.id, actor, { modelId: 'test/tool-denied', toolKey: 'test.write', alias: 'writer', actionKey: 'connector.test.write', tp: toolPolicy({ allowedAliases: ['writer'], allowWrite: false, requireAuthorizationFor: [] }), invokeSemantic: 'execute_under_rule' });
    const runId = await execute(org.id, actor.auth, fx.operationId);
    await worker.drain(WK);

    const st = await agentStepRow(runId);
    expect(st?.status).toBe('SUCCEEDED'); // o modelo recebe DENIED e finaliza
    const types = await eventTypes(runId);
    expect(types).toContain('agent.tool_authority_evaluated');
    expect(types).toContain('agent.tool_execution_failed');
    // Nenhuma tool call bem-sucedida.
    const ev = await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } });
    expect(ev.some((e) => { const a = (e.content as Record<string, unknown>).agentToolCall as Record<string, unknown> | undefined; return a?.status === 'DENIED'; })).toBe(true);
  });
});

// ── §40 UNKNOWN ─────────────────────────────────────────────────────────────────────
describe('§40 resultado de tool incerto', () => {
  it('UNKNOWN → step FAILED (não SUCCEEDED); não repete; MODEL_RESULT_UNKNOWN', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('uk-admin', org.id, ['corporate_admin']);
    const fx = await setupToolAgent(org.id, actor, { modelId: 'test/tool-unknown-result', toolKey: 'test.unknown', alias: 'flaky', actionKey: 'connector.test.unknown', tp: toolPolicy({ allowedAliases: ['flaky'], allowWrite: true, requireAuthorizationFor: [] }), invokeSemantic: 'execute_under_rule' });
    const runId = await execute(org.id, actor.auth, fx.operationId);
    await worker.drain(WK);

    const st = await agentStepRow(runId);
    expect(st?.status).toBe('FAILED');
    expect(st?.errorCode).toBe('MODEL_RESULT_UNKNOWN');
    expect(await eventTypes(runId)).toContain('agent.tool_execution_unknown');
  });
});

// ── §41 injeção via resultado de tool + canário de cabeçalho ───────────────────────
describe('§41 injeção via resultado de tool', () => {
  it('resultado com authorization + injeção → redigido, isolado, agente não chama admin.delete', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('ij-admin', org.id, ['corporate_admin']);
    const fx = await setupToolAgent(org.id, actor, { modelId: 'test/tool-result-injection', toolKey: 'test.inject', alias: 'reader', actionKey: 'connector.test.inject', tp: toolPolicy({ allowedAliases: ['reader'], allowRead: true, requireAuthorizationFor: [] }), invokeSemantic: 'execute_under_rule' });
    const runId = await execute(org.id, actor.auth, fx.operationId);
    await worker.drain(WK);

    const st = await agentStepRow(runId);
    expect(st?.status).toBe('SUCCEEDED');
    // O canário "Bearer will-be-redacted" é redigido em todos os artefatos derivados.
    const dump = JSON.stringify([
      await prisma.executionEvent.findMany({ where: { executionRunId: runId } }),
      await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } }),
      await prisma.auditEvent.findMany({ where: { organizationId: org.id } }),
    ], (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(dump.includes('will-be-redacted')).toBe(false);
    // Apenas UMA tool legítima executou; o agente nunca chamou admin.delete.
    const types = await eventTypes(runId);
    expect(types.filter((t) => t === 'agent.tool_execution_started').length).toBe(1);
    expect(types).toContain('agent.tool_result_isolated');
  });
});

// ── §42 cross-tenant ─────────────────────────────────────────────────────────────────
describe('§42 cross-tenant: alias de Beta não é usável em Alpha', () => {
  it('agente de Alpha não resolve/executa binding de Beta', async () => {
    const alpha = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const beta = await seedOrg({ name: 'Beta', slug: 'beta' });
    const aAdmin = await seedActor('x-a', alpha.id, ['corporate_admin']);
    const bAdmin = await seedActor('x-b', beta.id, ['corporate_admin']);
    // Beta tem o alias 'reader'; Alpha NÃO cria binding, mas o agente lista 'reader'.
    await setupToolAgent(beta.id, bAdmin, { modelId: 'test/tool-read-success', toolKey: 'test.echo', alias: 'reader', actionKey: 'connector.test.echo', tp: toolPolicy({ allowedAliases: ['reader'], allowRead: true, requireAuthorizationFor: [] }), invokeSemantic: 'execute_under_rule' });

    // Alpha: agente com allowedAliases ['reader'] mas SEM binding de operação → tool indisponível.
    const cfg = await request(server).post(`${b(alpha.id)}/model-configurations`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('cfg')).send(testModelConfigurationBody({ modelId: 'test/tool-read-success' }));
    await request(server).post(`${b(alpha.id)}/model-configurations/${cfg.body.data.id}/activate`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: cfg.body.data.revision });
    const agentKey = idemKey('agent').toLowerCase();
    const agent = await request(server).post(`${b(alpha.id)}/agents`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('ag')).send({ key: agentKey, name: 'A' });
    const def = validAgentVersionDefinition(cfg.body.data.id, { executionPolicy: toolExecPolicy(), toolPolicy: toolPolicy({ allowedAliases: ['reader'], allowRead: true, requireAuthorizationFor: [] }) });
    const draft = await request(server).post(`${b(alpha.id)}/agents/${agent.body.data.id}/versions`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('v')).send({ definition: def });
    await request(server).post(`${b(alpha.id)}/agents/${agent.body.data.id}/versions/${draft.body.data.id}/publish`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: draft.body.data.revision, changeSummary: 'v1' });
    const op = await request(server).post(`${b(alpha.id)}/operations`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('op')).send({ name: 'A' });
    const operationId = op.body.data.id as string; const versionId = op.body.data.currentDraftVersionId as string;
    const patched = await request(server).patch(`${b(alpha.id)}/operations/${operationId}/versions/${versionId}`).set('Authorization', aAdmin.auth).send({ definition: validDefinition({ steps: [agentStep(agentKey)] }), expectedRevision: 1 });
    await request(server).patch(`${b(alpha.id)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', aAdmin.auth).send({ authorityProfile: authorityProfile('execute_under_rule'), expectedRevision: patched.body.data.revision });
    const versions = await request(server).get(`${b(alpha.id)}/operations/${operationId}/versions`).set('Authorization', aAdmin.auth);
    await request(server).post(`${b(alpha.id)}/operations/${operationId}/versions/${versions.body.data[0].id}/publish`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('opub')).send({ expectedRevision: versions.body.data[0].revision, changeSummary: 'v1' });

    const runId = await execute(alpha.id, aAdmin.auth, operationId);
    await worker.drain(WK);
    const st = await agentStepRow(runId);
    // O modelo propõe 'reader', que não resolve em Alpha → AGENT_TOOL_NOT_ALLOWED.
    expect(st?.status).toBe('FAILED');
    expect(st?.errorCode).toBe('AGENT_TOOL_NOT_ALLOWED');
  });
});

// ── §44 canário de segredo ──────────────────────────────────────────────────────────
describe('§44 canário de segredo não vaza', () => {
  it('canário no input da tool não aparece no job/eventos/evidência/audit', async () => {
    const CANARY = 'ARDEN_BE007_TOOLCALL_SECRET_CANARY_e2e';
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('cy-admin', org.id, ['corporate_admin']);
    const fx = await setupToolAgent(org.id, actor, { modelId: 'test/tool-read-success', toolKey: 'test.echo', alias: 'reader', actionKey: 'connector.test.echo', tp: toolPolicy({ allowedAliases: ['reader'], allowRead: true, requireAuthorizationFor: [] }), invokeSemantic: 'execute_under_rule' });
    const runId = await execute(org.id, actor.auth, fx.operationId, { lead: 'Acme', secret: CANARY, apiKey: CANARY });
    await worker.drain(WK);

    const st = await agentStepRow(runId);
    const dump = JSON.stringify([
      await prisma.executionJob.findMany({ where: { executionRunId: runId } }),
      await prisma.executionEvent.findMany({ where: { executionRunId: runId } }),
      await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } }),
      await prisma.auditEvent.findMany({ where: { organizationId: org.id } }),
      await prisma.agentRuntimeCheckpoint.findMany({ where: { executionRunId: runId } }),
      st?.output ?? null,
    ], (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(dump.includes(CANARY)).toBe(false);
  });
});
