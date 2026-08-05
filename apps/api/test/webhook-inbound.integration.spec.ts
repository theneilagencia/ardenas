/**
 * Arden.AS API — integração de webhook de ENTRADA (API + worker) (ARDEN-BE-006.7).
 *
 * PostgreSQL, fila e worker reais. Cobre: criação de endpoint (token 1×), HMAC sobre
 * raw body, timestamp, replay (incl. concorrência), delivery conflict, event allowlist,
 * suspensão/revogação, cross-tenant, canário de segredo e E2E até execução terminal.
 * Tenant sempre do endpoint persistido; nunca do request.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AuthorityProfile, OperationStep } from '@arden/contracts';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';
import type { AuthenticatedRequestContext } from '../src/identity/request-context';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ConnectionsService } from '../src/connectors/connections/connections.service';
import { ExecutionWorker } from '../src/executions/execution.worker';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let worker: ExecutionWorker;
let projector: ConnectorCatalogProjector;
let connections: ConnectionsService;

const WK = { workerId: 'wh-worker', leaseSeconds: 30, pollIntervalMs: 10 };
const base = (orgId: string) => `/api/v1/organizations/${orgId}`;
const inbound = (token: string) => `/api/v1/webhooks/${token}`;

function ctxFor(actor: Actor, orgId: string): AuthenticatedRequestContext {
  return { correlationId: `corr-${actor.subject}`, userId: actor.userId, organizationId: orgId } as unknown as AuthenticatedRequestContext;
}

function step(id: string): OperationStep {
  return { id, order: 0, name: 'Etapa', description: '', authorityLevel: 'execute_under_rule', requiresApproval: false, workUnitCost: 0, producesEvidence: true };
}
function level3(): AuthorityProfile {
  return { level: 3, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule', destructive: false }], approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false };
}

interface Fixture { orgId: string; actor: Actor; token: string; secret: string; endpointId: string; operationId: string; canary: string; }

async function publishOperation(orgId: string, auth: string): Promise<string> {
  const op = await request(server).post(`${base(orgId)}/operations`).set('Authorization', auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op webhook' });
  const operationId = op.body.data.id as string;
  const versionId = op.body.data.currentDraftVersionId as string;
  const def = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', auth).send({ definition: validDefinition({ steps: [step('s1')] }), expectedRevision: 1 });
  const authRes = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', auth).send({ authorityProfile: level3(), expectedRevision: def.body.data.revision });
  await request(server).post(`${base(orgId)}/operations/${operationId}/versions/${versionId}/publish`).set('Authorization', auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: authRes.body.data.revision, changeSummary: 'v1' });
  return operationId;
}

async function setupWebhook(slug: string, opts: { scheme?: 'HMAC_SHA256' | 'STATIC_BEARER' | 'NONE'; withOperation?: boolean; allowedEventTypes?: string[] } = {}): Promise<Fixture> {
  const org = await seedOrg({ name: slug, slug });
  const actor = await seedActor(`u-${slug}`, org.id, ['corporate_admin']);
  const ctx = ctxFor(actor, org.id);
  const canary = `ARDEN_BE006_WEBHOOK_SECRET_CANARY_${randomUUID()}`;
  const conn = (await connections.create(ctx, { connectorKey: 'system.webhook', connectorVersion: '1', name: 'wh' }, idemKey('c'))).body.data;
  await connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision);
  const operationId = opts.withOperation === false ? '' : await publishOperation(org.id, actor.auth);

  const created = await request(server).post(`${base(org.id)}/webhook-endpoints`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('wh')).send({
    connectionId: conn.id, key: 'inbound', signatureScheme: opts.scheme ?? 'HMAC_SHA256',
    ...(opts.scheme === 'NONE' ? { allowInsecureNoSignature: true } : { signingSecret: canary }),
    replayWindowSeconds: 300, allowedEventTypes: opts.allowedEventTypes ?? [],
    ...(operationId ? { operationId } : {}),
  });
  expect(created.status).toBe(201);
  return { orgId: org.id, actor, token: created.body.data.endpointToken as string, secret: created.body.data.signingSecret ?? canary, endpointId: created.body.data.endpoint.id as string, operationId, canary };
}

function hmacHeaders(secret: string, rawBody: string, timestampSeconds: number, extra: Record<string, string> = {}): Record<string, string> {
  const sig = createHmac('sha256', secret).update(`${timestampSeconds}.`).update(Buffer.from(rawBody)).digest('hex');
  return { 'content-type': 'application/json', 'x-arden-timestamp': String(timestampSeconds), 'x-arden-signature': `sha256=${sig}`, ...extra };
}

function send(token: string, rawBody: string, headers: Record<string, string>) {
  return request(server).post(inbound(token)).set(headers).send(rawBody);
}

function nowSeconds() { return Math.floor(Date.now() / 1000); }

async function dump(execId?: string): Promise<string> {
  const [deliveries, audit, runs, events, evidence] = await Promise.all([
    prisma.webhookDelivery.findMany({}), prisma.auditEvent.findMany({}),
    prisma.executionRun.findMany({}), prisma.executionEvent.findMany({}), prisma.evidenceRecord.findMany({}),
  ]);
  void execId;
  return JSON.stringify({ deliveries, audit, runs, events, evidence }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  worker = app.get(ExecutionWorker);
  projector = app.get(ConnectorCatalogProjector);
  connections = app.get(ConnectionsService);
  await projector.project();
});
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetIdentity(); await projector.project(); });

describe('webhook inbound — HMAC + trigger + worker', () => {
  it('E2E: assinado → 202 → delivery → execução → worker → SUCCEEDED; canário ausente', async () => {
    const fx = await setupWebhook('alpha');
    const body = JSON.stringify({ event: 'order.created', id: 1 });
    const res = await send(fx.token, body, hmacHeaders(fx.secret, body, nowSeconds(), { 'x-arden-delivery-id': 'd-1', 'x-arden-event-type': 'order.created' }));
    expect(res.status).toBe(202);
    expect(res.body.data.accepted).toBe(true);

    const delivery = await prisma.webhookDelivery.findFirst({ where: { organizationId: fx.orgId } });
    expect(delivery?.externalDeliveryId).toBe('d-1');
    const run = await prisma.executionRun.findFirst({ where: { organizationId: fx.orgId } });
    expect(run?.triggerType).toBe('SYSTEM');
    expect(run?.triggerReference).toBe(delivery?.id);

    await worker.drain(WK);
    const done = await prisma.executionRun.findUnique({ where: { id: run!.id } });
    expect(done?.status).toBe('SUCCEEDED');

    // Evidência tem metadados de webhook (payloadHash), nunca o segredo.
    const evidence = await prisma.evidenceRecord.findMany({ where: { executionRunId: run!.id } });
    expect(JSON.stringify(evidence)).toContain(delivery!.payloadHash);
    const audit = await prisma.auditEvent.findMany({ where: { action: 'webhook.execution_created' } });
    expect(audit.length).toBeGreaterThan(0);
    // CANÁRIO ausente de tudo.
    expect(await dump(run!.id)).not.toContain(fx.canary);
  });

  it('assinatura inválida → 401, sem delivery, sem execução', async () => {
    const fx = await setupWebhook('sig');
    const body = JSON.stringify({ a: 1 });
    const res = await send(fx.token, body, { 'content-type': 'application/json', 'x-arden-timestamp': String(nowSeconds()), 'x-arden-signature': 'sha256=' + '0'.repeat(64) });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
    expect(await prisma.webhookDelivery.count({ where: { organizationId: fx.orgId } })).toBe(0);
    expect(await prisma.executionRun.count({ where: { organizationId: fx.orgId } })).toBe(0);
    expect(await dump()).not.toContain(fx.canary);
  });

  it('timestamp expirado → 401 WEBHOOK_TIMESTAMP_INVALID', async () => {
    const fx = await setupWebhook('ts');
    const body = JSON.stringify({ a: 1 });
    const old = nowSeconds() - 3600;
    const res = await send(fx.token, body, hmacHeaders(fx.secret, body, old));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('WEBHOOK_TIMESTAMP_INVALID');
  });

  it('raw body: assinatura sobre bytes exatos não valida corpo re-serializado', async () => {
    const fx = await setupWebhook('raw');
    const signedBody = '{"a":1,"b":2}';
    const headers = hmacHeaders(fx.secret, signedBody, nowSeconds());
    const res = await send(fx.token, '{ "b": 2, "a": 1 }', headers); // mesmo semântico, bytes diferentes
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });
});

describe('webhook inbound — replay e conflito', () => {
  it('replay (mesmo delivery id + payload) → sem nova execução', async () => {
    const fx = await setupWebhook('replay');
    const body = JSON.stringify({ x: 1 });
    const h = hmacHeaders(fx.secret, body, nowSeconds(), { 'x-arden-delivery-id': 'dup-1' });
    const first = await send(fx.token, body, h);
    expect(first.body.data.status).toBe('accepted');
    const second = await send(fx.token, body, h);
    expect(second.body.data.status).toBe('replayed');
    expect(await prisma.executionRun.count({ where: { organizationId: fx.orgId } })).toBe(1);
    expect(await prisma.webhookDelivery.count({ where: { organizationId: fx.orgId } })).toBe(1);
  });

  it('CRÍTICO: dois requests idênticos simultâneos → uma execução, um job', async () => {
    const fx = await setupWebhook('concurrent');
    const body = JSON.stringify({ x: 2 });
    const h = hmacHeaders(fx.secret, body, nowSeconds(), { 'x-arden-delivery-id': 'race-1' });
    const [a, b] = await Promise.all([send(fx.token, body, h), send(fx.token, body, h)]);
    const statuses = [a.body.data?.status, b.body.data?.status].sort();
    expect(statuses).toEqual(['accepted', 'replayed']);
    expect(await prisma.executionRun.count({ where: { organizationId: fx.orgId } })).toBe(1);
    expect(await prisma.executionJob.count({ where: { organizationId: fx.orgId } })).toBe(1);
  });

  it('CRÍTICO: mesmo delivery id, payload diferente → 409 conflito, sem nova execução', async () => {
    const fx = await setupWebhook('conflict');
    const b1 = JSON.stringify({ v: 1 });
    await send(fx.token, b1, hmacHeaders(fx.secret, b1, nowSeconds(), { 'x-arden-delivery-id': 'c-1' }));
    const b2 = JSON.stringify({ v: 2 });
    const res = await send(fx.token, b2, hmacHeaders(fx.secret, b2, nowSeconds(), { 'x-arden-delivery-id': 'c-1' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('WEBHOOK_DELIVERY_CONFLICT');
    expect(await prisma.executionRun.count({ where: { organizationId: fx.orgId } })).toBe(1);
  });
});

describe('webhook inbound — allowlist e estados', () => {
  it('event type não permitido → 422', async () => {
    const fx = await setupWebhook('evt', { allowedEventTypes: ['order.created'] });
    const body = JSON.stringify({ a: 1 });
    const res = await send(fx.token, body, hmacHeaders(fx.secret, body, nowSeconds(), { 'x-arden-event-type': 'other.event' }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WEBHOOK_EVENT_NOT_ALLOWED');
  });

  it('suspenso bloqueia; reativado aceita; revogado bloqueia (terminal)', async () => {
    const fx = await setupWebhook('states');
    const ep = await prisma.webhookEndpoint.findFirst({ where: { id: fx.endpointId } });
    const auth = fx.actor.auth;
    // Suspende.
    await request(server).post(`${base(fx.orgId)}/webhook-endpoints/${fx.endpointId}/suspend`).set('Authorization', auth).send({ expectedRevision: ep!.revision });
    const b = JSON.stringify({ a: 1 });
    let res = await send(fx.token, b, hmacHeaders(fx.secret, b, nowSeconds(), { 'x-arden-delivery-id': 's-1' }));
    expect(res.status).toBe(404);
    // Reativa.
    const ep2 = await prisma.webhookEndpoint.findFirst({ where: { id: fx.endpointId } });
    await request(server).post(`${base(fx.orgId)}/webhook-endpoints/${fx.endpointId}/reactivate`).set('Authorization', auth).send({ expectedRevision: ep2!.revision });
    res = await send(fx.token, b, hmacHeaders(fx.secret, b, nowSeconds(), { 'x-arden-delivery-id': 's-2' }));
    expect(res.status).toBe(202);
    // Revoga.
    const ep3 = await prisma.webhookEndpoint.findFirst({ where: { id: fx.endpointId } });
    await request(server).post(`${base(fx.orgId)}/webhook-endpoints/${fx.endpointId}/revoke`).set('Authorization', auth).send({ expectedRevision: ep3!.revision });
    res = await send(fx.token, b, hmacHeaders(fx.secret, b, nowSeconds(), { 'x-arden-delivery-id': 's-3' }));
    expect(res.status).toBe(404);
  });
});

describe('webhook inbound — token e cross-tenant', () => {
  it('token não retorna em GET; hash persistido', async () => {
    const fx = await setupWebhook('tok');
    const got = await request(server).get(`${base(fx.orgId)}/webhook-endpoints/${fx.endpointId}`).set('Authorization', fx.actor.auth);
    expect(got.status).toBe(200);
    expect(JSON.stringify(got.body.data)).not.toContain(fx.token);
    expect(JSON.stringify(got.body.data)).not.toContain('pathTokenHash');
  });

  it('CRÍTICO cross-tenant: token de Alpha não usa operação/execução de Beta', async () => {
    const alpha = await setupWebhook('alpha-x');
    const beta = await setupWebhook('beta-x');
    const body = JSON.stringify({ a: 1 });
    await send(alpha.token, body, hmacHeaders(alpha.secret, body, nowSeconds(), { 'x-arden-delivery-id': 'x-1' }));
    const alphaRun = await prisma.executionRun.findFirst({ where: { organizationId: alpha.orgId } });
    expect(alphaRun?.operationId).toBe(alpha.operationId);
    // Beta não tem execução criada pelo webhook de Alpha.
    expect(await prisma.executionRun.count({ where: { organizationId: beta.orgId } })).toBe(0);
    // Token de Beta valida só com o segredo de Beta (o de Alpha não valida em Beta).
    const bad = await send(beta.token, body, hmacHeaders(alpha.secret, body, nowSeconds()));
    expect(bad.status).toBe(401);
  });

  it('token inexistente → 404 indistinguível', async () => {
    const res = await send('whk_naoexiste', '{}', { 'content-type': 'application/json' });
    expect(res.status).toBe(404);
  });
});
