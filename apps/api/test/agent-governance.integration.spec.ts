/**
 * Arden.AS API — integração de avaliação/usage/custo/governança/observabilidade (ARDEN-BE-007.6 §42–49).
 *
 * PostgreSQL real + fila durável + worker real. Cada `agent.execute` produz um REGISTRO
 * OPERACIONAL persistido e consultável: usage (tokens/contadores), custo estimado (inteiro,
 * rate card interna = 0 USD; ausente → null + warning), avaliação determinística
 * (PASSED/FAILED), governança (WITHIN_LIMITS/LIMIT_EXCEEDED/BLOCKED) e rollups diários por
 * dimensão. Cobre reprocessamento SEM duplicar rollup/custo, consultas administrativas com
 * filtros/paginação, isolamento cross-tenant e canário de segredo em todos os artefatos.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { OperationStep } from '@arden/contracts';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';
import { ModelProviderCatalogProjector } from '../src/agents/providers/model-provider-catalog.projector';
import { RateCardCatalogProjector } from '../src/agents/governance/rate-card.projector';
import { AgentMetrics } from '../src/agents/governance/agent-metrics';
import { ExecutionWorker } from '../src/executions/execution.worker';
import { validAgentVersionDefinition, testModelConfigurationBody } from './agents-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let worker: ExecutionWorker;
let providerProjector: ModelProviderCatalogProjector;
let rateCardProjector: RateCardCatalogProjector;
let metrics: AgentMetrics;

const WK = { workerId: 'agent-gov-worker', leaseSeconds: 30, pollIntervalMs: 10 };
const b = (orgId: string) => `/api/v1/organizations/${orgId}`;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  worker = app.get(ExecutionWorker);
  providerProjector = app.get(ModelProviderCatalogProjector);
  rateCardProjector = app.get(RateCardCatalogProjector);
  metrics = app.get(AgentMetrics);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetIdentity();
  await providerProjector.project();
  await rateCardProjector.project();
  // Limpa os registros operacionais (sem FK — não são removidos pelo reset de identidade).
  await prisma.agentUsageRollup.deleteMany();
  await prisma.agentModelCallUsage.deleteMany();
  await prisma.agentToolCallUsage.deleteMany();
  await prisma.agentExecutionResult.deleteMany();
});

function agentStep(agentKey: string, id = 's1'): OperationStep {
  return { id, order: 0, name: 'Etapa de agente', description: '', authorityLevel: 'execute_under_rule', requiresApproval: false, workUnitCost: 0, producesEvidence: true, agent: { agentKey, actionKey: 'agent.execute' } };
}
function level3() {
  return { level: 3 as const, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule' as const, destructive: false }], approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false };
}

/** Cria+ativa config (modelId do cenário), cria+publica agente; devolve {agentKey, agentId, versionId}. */
async function setupAgent(orgId: string, auth: string, modelId: string, defOverrides: Record<string, unknown> = {}): Promise<{ agentKey: string; agentId: string; agentVersionId: string }> {
  const cfg = await request(server).post(`${b(orgId)}/model-configurations`).set('Authorization', auth).set('Idempotency-Key', idemKey('cfg')).send(testModelConfigurationBody({ modelId }));
  expect(cfg.status).toBe(201);
  await request(server).post(`${b(orgId)}/model-configurations/${cfg.body.data.id}/activate`).set('Authorization', auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: cfg.body.data.revision });
  const agentKey = idemKey('agent').toLowerCase();
  const agent = await request(server).post(`${b(orgId)}/agents`).set('Authorization', auth).set('Idempotency-Key', idemKey('ag')).send({ key: agentKey, name: 'Classifier' });
  const draft = await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions`).set('Authorization', auth).set('Idempotency-Key', idemKey('v')).send({ definition: validAgentVersionDefinition(cfg.body.data.id, defOverrides) });
  const pub = await request(server).post(`${b(orgId)}/agents/${agent.body.data.id}/versions/${draft.body.data.id}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: draft.body.data.revision, changeSummary: 'v1' });
  expect(pub.status).toBe(200);
  return { agentKey, agentId: agent.body.data.id as string, agentVersionId: draft.body.data.id as string };
}

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

async function execute(orgId: string, auth: string, operationId: string, input: Record<string, unknown> = { lead: 'Acme' }): Promise<string> {
  const created = await request(server).post(`${b(orgId)}/operations/${operationId}/executions`).set('Authorization', auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input, maxAttempts: 1 });
  expect(created.status).toBe(201);
  return created.body.data.id as string;
}

/** Fluxo completo: setup + operação publicada + execução + drain do worker. Devolve ids. */
async function runAgent(orgId: string, actor: Actor, modelId: string, defOverrides: Record<string, unknown> = {}): Promise<{ runId: string; agentId: string; agentVersionId: string; operationId: string; stepId: string }> {
  const { agentKey, agentId, agentVersionId } = await setupAgent(orgId, actor.auth, modelId, defOverrides);
  const operationId = await publishOperationWithAgent(orgId, actor.auth, agentKey);
  const runId = await execute(orgId, actor.auth, operationId);
  await worker.drain(WK);
  const step = await prisma.executionStep.findFirstOrThrow({ where: { executionRunId: runId, actionKey: 'agent.execute' } });
  return { runId, agentId, agentVersionId, operationId, stepId: step.id };
}

async function resultRow(orgId: string, stepId: string) {
  return prisma.agentExecutionResult.findFirstOrThrow({ where: { organizationId: orgId, executionStepId: stepId } });
}

// ── §42 usage persistido + custo ZERO conhecido (rate card interna) ─────────────────
describe('§42 usage + custo estimado (rate card interna = 0 USD)', () => {
  it('SUCCEEDED → resultado com usage>0, custo 0 (não null), currency USD, avaliação PASSED', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-a', org.id, ['corporate_admin']);
    const { stepId } = await runAgent(org.id, actor, 'test/structured-success');

    const row = await resultRow(org.id, stepId);
    expect(row.status).toBe('SUCCEEDED');
    expect(row.modelCallCount).toBe(1);
    expect(row.inputTokens).toBeGreaterThan(0);
    expect(row.outputTokens).toBe(16);
    // Custo ZERO conhecido — nunca null quando há rate card.
    expect(row.estimatedCostMinor).toBe(0n);
    expect(row.currency).toBe('USD');
    expect(row.rateCardId).toBeTruthy();
    expect(row.evaluationStatus).toBe('PASSED');
    expect(row.governanceStatus).toBe('WITHIN_LIMITS');
    expect(row.outputValidationStatus).toBe('VALID');

    // Linha de usage por chamada de modelo persistida (idempotente por etapa+índice).
    const calls = await prisma.agentModelCallUsage.findMany({ where: { executionStepId: stepId } });
    expect(calls.length).toBe(1);
    expect(calls[0].purpose).toBe('PRIMARY');
    expect(calls[0].estimatedCostMinor).toBe(0n);
    expect(calls[0].currency).toBe('USD');
  });

  it('rate card AUSENTE → custo null + warning COST_RATE_CARD_NOT_AVAILABLE (nunca zero inventado)', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-nc', org.id, ['corporate_admin']);
    // Remove a rate card do modelo ANTES do drain: o custo não pode ser inventado como 0.
    await prisma.modelRateCard.deleteMany({ where: { providerKey: 'internal.test-model', modelId: 'test/structured-success' } });
    const { stepId } = await runAgent(org.id, actor, 'test/structured-success');

    const row = await resultRow(org.id, stepId);
    expect(row.status).toBe('SUCCEEDED');
    expect(row.estimatedCostMinor).toBeNull();
    expect(row.currency).toBeNull();
    const gov = row.governanceSummary as Record<string, unknown>;
    const cost = gov.cost as Record<string, unknown>;
    expect(cost.warningCode).toBe('COST_RATE_CARD_NOT_AVAILABLE');
    // Evento operacional de rate card ausente emitido.
    const events = (await prisma.executionEvent.findMany({ where: { executionRunId: (await prisma.executionStep.findUniqueOrThrow({ where: { id: stepId } })).executionRunId } })).map((e) => e.eventType);
    expect(events).toContain('agent.cost_rate_card_missing');
  });
});

// ── §43 avaliação determinística FAILED em output inválido ───────────────────────────
describe('§43 avaliação determinística', () => {
  it('output inválido (repair exhausted) → status FAILED, avaliação FAILED, output INVALID', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-f', org.id, ['corporate_admin']);
    const { stepId } = await runAgent(org.id, actor, 'test/structured-invalid');

    const row = await resultRow(org.id, stepId);
    expect(row.status).toBe('FAILED');
    expect(row.evaluationStatus).toBe('FAILED');
    expect(row.outputValidationStatus).toBe('INVALID');
    const evalSummary = row.evaluationSummary as Record<string, unknown>;
    expect(Array.isArray(evalSummary.checks)).toBe(true);
    expect((evalSummary.checks as unknown[]).length).toBeGreaterThan(0);
  });

  it('resultado incerto (UNKNOWN) → NUNCA marcado PASSED; avaliação FAILED', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-u', org.id, ['corporate_admin']);
    const { stepId } = await runAgent(org.id, actor, 'test/unknown-result');

    const row = await resultRow(org.id, stepId);
    expect(row.status).not.toBe('SUCCEEDED');
    expect(row.evaluationStatus).not.toBe('PASSED');
  });
});

// ── §44 rollups diários por dimensão + reprocessamento sem duplicar ─────────────────
describe('§44 rollups por dimensão (idempotência de reprocessamento)', () => {
  it('incrementa rollup de ORGANIZATION/OPERATION/AGENT_VERSION uma vez; replay NÃO duplica', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-r', org.id, ['corporate_admin']);
    const { runId, agentVersionId, operationId, stepId } = await runAgent(org.id, actor, 'test/structured-success');

    const orgRollup = await prisma.agentUsageRollup.findFirstOrThrow({ where: { organizationId: org.id, dimensionType: 'ORGANIZATION', dimensionId: org.id } });
    expect(orgRollup.executionCount).toBe(1);
    expect(orgRollup.succeededCount).toBe(1);
    expect(orgRollup.modelCallCount).toBe(1);
    expect(orgRollup.estimatedCostMinor).toBe(0n);
    // Dimensões operação e versão do agente também presentes.
    expect(await prisma.agentUsageRollup.count({ where: { organizationId: org.id, dimensionType: 'OPERATION', dimensionId: operationId } })).toBe(1);
    const versionRollup = await prisma.agentUsageRollup.findFirstOrThrow({ where: { organizationId: org.id, dimensionType: 'AGENT_VERSION', dimensionId: agentVersionId } });
    expect(versionRollup.executionCount).toBe(1);

    // Reprocessa a mesma etapa terminal (replay do worker) — não deve duplicar rollup/custo.
    await worker.drain(WK);
    const orgRollupAfter = await prisma.agentUsageRollup.findFirstOrThrow({ where: { organizationId: org.id, dimensionType: 'ORGANIZATION', dimensionId: org.id } });
    expect(orgRollupAfter.executionCount).toBe(1);
    expect(orgRollupAfter.modelCallCount).toBe(1);
    expect(orgRollupAfter.estimatedCostMinor).toBe(0n);
    // Continua havendo exatamente UM resultado e UMA linha de usage por chamada.
    expect(await prisma.agentExecutionResult.count({ where: { executionStepId: stepId } })).toBe(1);
    expect(await prisma.agentModelCallUsage.count({ where: { executionStepId: stepId } })).toBe(1);
    expect(runId).toBeTruthy();
  });
});

// ── §45 consultas administrativas (filtros + paginação) ─────────────────────────────
describe('§45 endpoints administrativos (somente leitura)', () => {
  it('lista resultados com filtro por status, detalha por id (404 fora do tenant) e agrega usage', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-q', org.id, ['corporate_admin']);
    const { runId, stepId, operationId } = await runAgent(org.id, actor, 'test/structured-success');
    const row = await resultRow(org.id, stepId);

    // Lista com filtro status=SUCCEEDED.
    const list = await request(server).get(`${b(org.id)}/agent-execution-results?status=SUCCEEDED`).set('Authorization', actor.auth);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
    expect(list.body.data[0].id).toBe(row.id);
    expect(list.body.data[0].costSummary.estimatedCostMinor).toBe(0);
    expect(list.body.data[0].usageSummary.outputTokens).toBe(16);
    expect(list.body.pagination.hasNextPage).toBe(false);

    // Filtro por execução.
    const byRun = await request(server).get(`${b(org.id)}/agent-execution-results?executionRunId=${runId}`).set('Authorization', actor.auth);
    expect(byRun.body.data.length).toBe(1);

    // Detalhe por id.
    const detail = await request(server).get(`${b(org.id)}/agent-execution-results/${row.id}`).set('Authorization', actor.auth);
    expect(detail.status).toBe(200);
    expect(detail.body.data.evaluationStatus).toBe('PASSED');

    // Usage agregado por operação.
    const usage = await request(server).get(`${b(org.id)}/agent-usage?groupBy=OPERATION&operationId=${operationId}`).set('Authorization', actor.auth);
    expect(usage.status).toBe(200);
    expect(usage.body.data.length).toBe(1);
    expect(usage.body.data[0].executionCount).toBe(1);
    expect(usage.body.data[0].dimensionId).toBe(operationId);

    // Usage por execução (rota dedicada).
    const execUsage = await request(server).get(`${b(org.id)}/executions/${runId}/agent-usage`).set('Authorization', actor.auth);
    expect(execUsage.status).toBe(200);
    expect(execUsage.body.data.results.length).toBe(1);
  });

  it('paginação por cursor devolve páginas disjuntas', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-p', org.id, ['corporate_admin']);
    await runAgent(org.id, actor, 'test/structured-success');
    await runAgent(org.id, actor, 'test/structured-success');
    await runAgent(org.id, actor, 'test/structured-success');

    const page1 = await request(server).get(`${b(org.id)}/agent-execution-results?limit=2`).set('Authorization', actor.auth);
    expect(page1.body.data.length).toBe(2);
    expect(page1.body.pagination.hasNextPage).toBe(true);
    const page2 = await request(server).get(`${b(org.id)}/agent-execution-results?limit=2&cursor=${encodeURIComponent(page1.body.pagination.nextCursor)}`).set('Authorization', actor.auth);
    expect(page2.body.data.length).toBe(1);
    const ids1 = new Set(page1.body.data.map((r: { id: string }) => r.id));
    expect(page2.body.data.some((r: { id: string }) => ids1.has(r.id))).toBe(false);
  });

  it('detalhe de resultado de OUTRO tenant → 404 AGENT_RESULT_NOT_FOUND', async () => {
    const alpha = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const beta = await seedOrg({ name: 'Beta', slug: 'beta' });
    const aAdmin = await seedActor('g-ca', alpha.id, ['corporate_admin']);
    const bAdmin = await seedActor('g-cb', beta.id, ['corporate_admin']);
    const { stepId } = await runAgent(alpha.id, aAdmin, 'test/structured-success');
    const row = await resultRow(alpha.id, stepId);

    // Beta tenta ler o resultado de Alpha pelo id → 404 (nunca vaza cross-tenant).
    const cross = await request(server).get(`${b(beta.id)}/agent-execution-results/${row.id}`).set('Authorization', bAdmin.auth);
    expect(cross.status).toBe(404);
    expect(cross.body.error.code).toBe('AGENT_RESULT_NOT_FOUND');
    // A lista de Beta não contém o resultado de Alpha.
    const list = await request(server).get(`${b(beta.id)}/agent-execution-results`).set('Authorization', bAdmin.auth);
    expect(list.body.data.length).toBe(0);
  });
});

// ── §46 governança: sinal crítico / limites ─────────────────────────────────────────
describe('§46 governança operacional', () => {
  it('execução dentro dos limites → governanceStatus WITHIN_LIMITS', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-gl', org.id, ['corporate_admin']);
    const { stepId } = await runAgent(org.id, actor, 'test/structured-success');
    const row = await resultRow(org.id, stepId);
    expect(row.governanceStatus).toBe('WITHIN_LIMITS');
  });
});

// ── §47 canário de segredo não vaza para NENHUM artefato operacional ────────────────
describe('§47 canário de segredo', () => {
  it('segredo no input não aparece em result/usage/rollup/eventos/audit/métricas', async () => {
    const CANARY = 'ARDEN_BE0076_GOVERNANCE_SECRET_CANARY_e2e';
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-cy', org.id, ['corporate_admin']);
    const { agentKey } = await setupAgent(org.id, actor.auth, 'test/structured-success');
    const operationId = await publishOperationWithAgent(org.id, actor.auth, agentKey);
    const runId = await execute(org.id, actor.auth, operationId, { lead: 'Acme', secret: CANARY, apiKey: CANARY });
    await worker.drain(WK);

    const dump = JSON.stringify([
      await prisma.agentExecutionResult.findMany({ where: { organizationId: org.id } }),
      await prisma.agentModelCallUsage.findMany({ where: { organizationId: org.id } }),
      await prisma.agentToolCallUsage.findMany({ where: { organizationId: org.id } }),
      await prisma.agentUsageRollup.findMany({ where: { organizationId: org.id } }),
      await prisma.executionEvent.findMany({ where: { executionRunId: runId } }),
      await prisma.evidenceRecord.findMany({ where: { executionRunId: runId } }),
      await prisma.auditEvent.findMany({ where: { organizationId: org.id } }),
      metrics.snapshot(),
    ], (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(dump.includes(CANARY)).toBe(false);
  });
});

// ── §48 observabilidade: métricas terminais emitidas uma vez por execução ────────────
describe('§48 observabilidade (métricas)', () => {
  it('recordExecution incrementa arden_agent_executions_total apenas na transição terminal', async () => {
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const actor = await seedActor('g-m', org.id, ['corporate_admin']);
    // O registro é um singleton acumulado no processo; somamos por prefixo do nome da métrica.
    const total = (snap: ReturnType<AgentMetrics['snapshot']>): number =>
      Object.entries(snap.counters).filter(([k]) => k.startsWith('arden_agent_executions_total')).reduce((a, [, v]) => a + v, 0);
    const beforeTotal = total(metrics.snapshot());

    const { stepId } = await runAgent(org.id, actor, 'test/structured-success');
    await worker.drain(WK); // replay não deve re-emitir métrica terminal

    const afterTotal = total(metrics.snapshot());
    expect(afterTotal - beforeTotal).toBe(1);
    // A métrica não carrega ids de alta cardinalidade nas labels — apenas o valor persistido no result.
    const row = await resultRow(org.id, stepId);
    expect(row.status).toBe('SUCCEEDED');
  });
});
