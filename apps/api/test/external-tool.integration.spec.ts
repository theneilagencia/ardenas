/**
 * Arden.AS API — integração de ferramenta externa (API + worker) (ARDEN-BE-006.6).
 *
 * PostgreSQL, fila, worker e servidor HTTP LOCAL reais (nunca a internet). Cobre:
 * criação de bindings, resolução por alias, external.http.request (bearer/API key),
 * evidência/auditoria sanitizadas, retry 429/5xx, timeout, resultado incerto,
 * conexão suspensa, credencial revogada, binding removido, cross-tenant, idempotência
 * e o canário de segredo. O segredo NUNCA aparece em job/log/audit/evidence/output.
 */

import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AuthorityProfile, OperationStep } from '@arden/contracts';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';
import type { AuthenticatedRequestContext } from '../src/identity/request-context';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ConnectionsService } from '../src/connectors/connections/connections.service';
import { CredentialVersionsService } from '../src/connectors/connections/credential-versions.service';
import { ToolBindingsService } from '../src/connectors/tool-bindings/tool-bindings.service';
import { ExecutionWorker } from '../src/executions/execution.worker';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let worker: ExecutionWorker;
let connections: ConnectionsService;
let credentials: CredentialVersionsService;
let bindings: ToolBindingsService;
let projector: ConnectorCatalogProjector;

const WK = { workerId: 'tool-worker', leaseSeconds: 30, pollIntervalMs: 10 };

// ── Servidor HTTP local ─────────────────────────────────────────────────────────
type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;
let http: Server;
let port: number;
let handler: Handler = (_req, res) => res.end('{}');
const received: Array<{ method?: string; url?: string; headers: IncomingMessage['headers']; body: string }> = [];

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  worker = app.get(ExecutionWorker);
  projector = app.get(ConnectorCatalogProjector);
  connections = app.get(ConnectionsService);
  credentials = app.get(CredentialVersionsService);
  bindings = app.get(ToolBindingsService);
  await projector.project();

  http = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      received.push({ method: req.method, url: req.url, headers: req.headers, body });
      handler(req, res, body);
    });
  });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  port = (http.address() as AddressInfo).port;
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve) => http.close(() => resolve()));
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetIdentity();
  await projector.project();
  received.length = 0;
  handler = (_req, res) => res.end('{}');
});

// ── Fixtures ──────────────────────────────────────────────────────────────────────
const base = (orgId: string) => `/api/v1/organizations/${orgId}`;
function ctxFor(actor: Actor, orgId: string): AuthenticatedRequestContext {
  return { correlationId: `corr-${actor.subject}`, userId: actor.userId, organizationId: orgId } as unknown as AuthenticatedRequestContext;
}

function toolStep(alias: string, actionKey: OperationStep['tool'] extends undefined ? never : NonNullable<OperationStep['tool']>['actionKey'] = 'external.http.request', id = 's1'): OperationStep {
  return { id, order: 0, name: 'Chamada externa', description: '', authorityLevel: 'execute_under_rule', requiresApproval: false, workUnitCost: 0, producesEvidence: false, tool: { alias, actionKey } };
}

function level3(): AuthorityProfile {
  return { level: 3, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_under_rule', destructive: false }], approvalRequired: false, approvalPolicyId: null, financialLimit: null, destructiveActionsAllowed: false, justificationRequired: false };
}

async function draftOperationWithTool(orgId: string, auth: string, alias: string, actionKey: NonNullable<OperationStep['tool']>['actionKey'] = 'external.http.request'): Promise<string> {
  const op = await request(server).post(`${base(orgId)}/operations`).set('Authorization', auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op com ferramenta' });
  const operationId = op.body.data.id as string;
  const versionId = op.body.data.currentDraftVersionId as string;
  const def = await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}`).set('Authorization', auth).send({ definition: validDefinition({ steps: [toolStep(alias, actionKey)] }), expectedRevision: 1 });
  await request(server).patch(`${base(orgId)}/operations/${operationId}/versions/${versionId}/authority`).set('Authorization', auth).send({ authorityProfile: level3(), expectedRevision: def.body.data.revision });
  return operationId;
}

interface Fixture { orgId: string; actor: Actor; ctx: AuthenticatedRequestContext; operationId: string; connectionId: string; canary: string; }

/** Cria conexão http ACTIVE (credencial canário), bindings e operação publicada com etapa externa. */
async function setupHttpTool(
  slug: string,
  opts: { scheme?: 'BEARER_TOKEN' | 'API_KEY_HEADER' | 'NONE'; inputMapping?: Record<string, unknown>; outputMapping?: Record<string, unknown>; policyOverrides?: Record<string, unknown> } = {},
): Promise<Fixture> {
  const org = await seedOrg({ name: slug, slug });
  const actor = await seedActor(`u-${slug}`, org.id, ['corporate_admin']);
  const ctx = ctxFor(actor, org.id);
  const canary = `ARDEN_BE006_TOOL_SECRET_CANARY_${randomUUID()}`;

  const conn = (await connections.create(ctx, { connectorKey: 'system.http', connectorVersion: '1', name: 'http' }, idemKey('c'))).body.data;
  // Política de rede de DEV (http + loopback) e baseUrl fixo do servidor local — via
  // Prisma direto (a API valida https-only; testes usam servidor local).
  await prisma.organizationConnection.update({
    where: { id: conn.id },
    data: {
      configuration: { baseUrl: `http://127.0.0.1:${port}` },
      networkPolicy: { allowedProtocols: ['http'], allowedHosts: ['127.0.0.1'], allowedPorts: [port], allowRedirects: true, maximumRedirects: 3, allowPrivateNetworks: false, allowLoopback: true, allowLinkLocal: false, maximumRequestBytes: 1_048_576, maximumResponseBytes: 5_242_880, timeoutMs: 1_500 },
    },
  });
  const scheme = opts.scheme ?? 'BEARER_TOKEN';
  const secret = scheme === 'BEARER_TOKEN' ? { scheme, token: canary }
    : scheme === 'API_KEY_HEADER' ? { scheme, token: canary, headerName: 'x-api-key' }
      : { scheme: 'NONE' };
  await credentials.create(ctx, conn.id, { secret } as never, idemKey('cred'));
  const fresh = (await connections.get(ctx, conn.id)).data;
  await connections.transitionStatus(ctx, conn.id, 'ACTIVE', fresh.revision);

  const orgBinding = (await bindings.createOrgBinding(ctx, { connectionId: conn.id, connectorToolKey: 'http.request', connectorToolVersion: '1', name: 'http-tool', ...(opts.policyOverrides ? { policyOverrides: opts.policyOverrides } : {}) }, idemKey('ob'))).body.data;
  const operationId = await draftOperationWithTool(org.id, actor.auth, 'httpx');
  await bindings.createOperationBinding(ctx, operationId, { organizationToolBindingId: orgBinding.id, alias: 'httpx', allowedActionKeys: ['external.http.request'], inputMapping: opts.inputMapping ?? {}, outputMapping: opts.outputMapping ?? {} }, idemKey('opb'));

  // Publica a versão (agora que o binding existe).
  const versions = await request(server).get(`${base(org.id)}/operations/${operationId}/versions`).set('Authorization', actor.auth);
  const version = versions.body.data[0];
  await request(server).post(`${base(org.id)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });

  return { orgId: org.id, actor, ctx, operationId, connectionId: conn.id, canary };
}

async function execute(fx: Fixture, input: Record<string, unknown>, maxAttempts = 1): Promise<string> {
  const created = await request(server).post(`${base(fx.orgId)}/operations/${fx.operationId}/executions`).set('Authorization', fx.actor.auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input, maxAttempts });
  expect(created.status).toBe(201);
  return created.body.data.id as string;
}

async function fullDump(execId: string): Promise<string> {
  const [run, steps, events, evidence, jobs, audit] = await Promise.all([
    prisma.executionRun.findUnique({ where: { id: execId } }),
    prisma.executionStep.findMany({ where: { executionRunId: execId } }),
    prisma.executionEvent.findMany({ where: { executionRunId: execId } }),
    prisma.evidenceRecord.findMany({ where: { executionRunId: execId } }),
    prisma.executionJob.findMany({ where: { executionRunId: execId } }),
    prisma.auditEvent.findMany({}),
  ]);
  return JSON.stringify({ run, steps, events, evidence, jobs, audit }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

// ── Testes ──────────────────────────────────────────────────────────────────────
describe('external.http.request — sucesso + segredo', () => {
  it('executa com bearer, valida output, evidência sanitizada; canário ausente em tudo', async () => {
    const fx = await setupHttpTool('alpha');
    handler = (_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true })); };
    const execId = await execute(fx, { method: 'GET', path: '/ok' });

    await worker.drain(WK);

    const run = await prisma.executionRun.findUnique({ where: { id: execId } });
    expect(run?.status).toBe('SUCCEEDED');
    // Servidor recebeu o Bearer com o canário (prova que a auth foi montada server-side).
    expect(received.at(-1)?.headers.authorization).toBe(`Bearer ${fx.canary}`);

    // Evidência tem host/path/fingerprint mas NUNCA o segredo.
    const evidence = await prisma.evidenceRecord.findMany({ where: { executionRunId: execId } });
    const outEv = evidence.find((e) => e.evidenceType === 'OUTPUT');
    const content = JSON.stringify(outEv?.content);
    expect(content).toContain('127.0.0.1');
    expect(content).toContain('sha256:');
    expect(content).not.toContain(fx.canary);

    // Auditoria external_tool.execution_succeeded presente.
    const audit = await prisma.auditEvent.findMany({ where: { action: 'external_tool.execution_succeeded' } });
    expect(audit.length).toBeGreaterThan(0);

    // CANÁRIO ausente em job/evento/evidência/audit/output.
    expect(await fullDump(execId)).not.toContain(fx.canary);
  });

  it('API key header: envia x-api-key com o segredo, nunca o expõe', async () => {
    const fx = await setupHttpTool('apikey', { scheme: 'API_KEY_HEADER' });
    handler = (_req, res) => res.end('{}');
    const execId = await execute(fx, { method: 'GET', path: '/k' });
    await worker.drain(WK);
    expect(received.at(-1)?.headers['x-api-key']).toBe(fx.canary);
    expect(await fullDump(execId)).not.toContain(fx.canary);
  });

  it('input/output mapping declarativo', async () => {
    const fx = await setupHttpTool('mapping', {
      inputMapping: { method: { const: 'POST' }, path: { const: '/echo' }, body: { path: 'input.payload' } },
      outputMapping: { echoed: { path: 'output.body.echoed' } },
    });
    handler = (_req, res, body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ echoed: JSON.parse(body || '{}') })); };
    const execId = await execute(fx, { payload: { hi: 'there' } });
    await worker.drain(WK);
    const step = await prisma.executionStep.findFirst({ where: { executionRunId: execId } });
    expect(step?.status).toBe('SUCCEEDED');
    expect(step?.output).toMatchObject({ echoed: { hi: 'there' } });
  });
});

describe('external.http.request — retry e resultado incerto', () => {
  it('retry em 429 (Retry-After) e depois 200 → SUCCEEDED, idempotency-key estável', async () => {
    const fx = await setupHttpTool('retry429');
    let calls = 0;
    const keys = new Set<string>();
    handler = (req, res) => {
      calls += 1;
      keys.add(String(req.headers['idempotency-key'] ?? ''));
      if (calls === 1) { res.writeHead(429, { 'retry-after': '0' }); res.end('rate'); }
      else { res.writeHead(200); res.end('{}'); }
    };
    const execId = await execute(fx, { method: 'GET', path: '/r' }, 3);
    await worker.drain(WK);
    const run = await prisma.executionRun.findUnique({ where: { id: execId } });
    expect(run?.status).toBe('SUCCEEDED');
    expect(calls).toBe(2);
    // Idempotency-key estável entre tentativas.
    expect(keys.size).toBe(1);
  });

  it('retry em 5xx e depois 200 → SUCCEEDED', async () => {
    const fx = await setupHttpTool('retry5xx');
    let calls = 0;
    handler = (_req, res) => { calls += 1; if (calls === 1) { res.writeHead(503); res.end('err'); } else { res.writeHead(200); res.end('{}'); } };
    const execId = await execute(fx, { method: 'GET', path: '/5' }, 3);
    await worker.drain(WK);
    expect((await prisma.executionRun.findUnique({ where: { id: execId } }))?.status).toBe('SUCCEEDED');
    expect(calls).toBe(2);
  });

  it('timeout idempotente (GET) → retry conforme motor', async () => {
    const fx = await setupHttpTool('timeout');
    let calls = 0;
    handler = (_req, res) => { calls += 1; if (calls >= 2) { res.writeHead(200); res.end('{}'); } /* 1ª: nunca responde → timeout */ };
    const execId = await execute(fx, { method: 'GET', path: '/t' }, 3);
    await worker.drain(WK);
    const run = await prisma.executionRun.findUnique({ where: { id: execId } });
    expect(run?.status).toBe('SUCCEEDED');
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('POST não idempotente + drop após envio → EXTERNAL_RESULT_UNKNOWN, sem retry, não vira sucesso', async () => {
    const fx = await setupHttpTool('unknown');
    let calls = 0;
    handler = (req, res) => { calls += 1; req.socket.destroy(); void res; };
    const execId = await execute(fx, { method: 'POST', path: '/u', body: { x: 1 } }, 3);
    await worker.drain(WK);
    const run = await prisma.executionRun.findUnique({ where: { id: execId } });
    const step = await prisma.executionStep.findFirst({ where: { executionRunId: execId } });
    expect(step?.status).toBe('FAILED');
    expect(step?.errorCode).toBe('EXTERNAL_RESULT_UNKNOWN');
    expect(run?.status).not.toBe('SUCCEEDED');
    // Sem repetição automática (uma única chamada).
    expect(calls).toBe(1);
    const attempts = await prisma.executionAttempt.count({ where: { executionStepId: step?.id } });
    expect(attempts).toBe(1);
    // Evidência registra a incerteza; audit external_tool.execution_unknown.
    const evidence = await prisma.evidenceRecord.findMany({ where: { executionRunId: execId } });
    expect(JSON.stringify(evidence)).toContain('EXTERNAL_RESULT_UNKNOWN');
    const audit = await prisma.auditEvent.findMany({ where: { action: 'external_tool.execution_unknown' } });
    expect(audit.length).toBeGreaterThan(0);
    expect(await fullDump(execId)).not.toContain(fx.canary);
  });
});

describe('external.http.request — bloqueios de estado', () => {
  it('conexão suspensa → falha sem chamar o servidor', async () => {
    const fx = await setupHttpTool('suspended');
    const fresh = (await connections.get(fx.ctx, fx.connectionId)).data;
    await connections.transitionStatus(fx.ctx, fx.connectionId, 'SUSPENDED', fresh.revision);
    handler = (_req, res) => res.end('{}');
    const execId = await execute(fx, { method: 'GET', path: '/x' });
    await worker.drain(WK);
    const step = await prisma.executionStep.findFirst({ where: { executionRunId: execId } });
    expect(step?.status).toBe('FAILED');
    expect(received.length).toBe(0);
  });

  it('credencial revogada → falha sem chamar o servidor', async () => {
    const fx = await setupHttpTool('revoked');
    const active = await prisma.connectionCredentialVersion.findFirst({ where: { connectionId: fx.connectionId, status: 'ACTIVE' } });
    await credentials.revoke(fx.ctx, fx.connectionId, active!.id);
    const execId = await execute(fx, { method: 'GET', path: '/x' });
    await worker.drain(WK);
    expect((await prisma.executionStep.findFirst({ where: { executionRunId: execId } }))?.status).toBe('FAILED');
    expect(received.length).toBe(0);
  });
});

describe('external.http.request — cross-tenant', () => {
  it('alias conhecido não concede acesso ao binding/conexão de outro tenant', async () => {
    const alpha = await setupHttpTool('alpha2');
    // Beta tem o MESMO alias, mas conexão/credencial próprias.
    const beta = await setupHttpTool('beta2');
    handler = (_req, res) => res.end('{}');

    const execId = await execute(alpha, { method: 'GET', path: '/x' });
    await worker.drain(WK);

    // A execução de Alpha usou a conexão de Alpha (nunca a de Beta).
    const evidence = await prisma.evidenceRecord.findMany({ where: { executionRunId: execId } });
    const content = JSON.stringify(evidence);
    expect(content).toContain(alpha.connectionId);
    expect(content).not.toContain(beta.connectionId);
    // Beta não enxerga a execução de Alpha.
    const res = await request(server).get(`${base(beta.orgId)}/executions/${execId}`).set('Authorization', beta.actor.auth);
    expect(res.status).toBe(404);
  });
});

describe('external.webhook.send — outbound', () => {
  it('envia POST JSON assinado (HMAC) ao endpoint fixo; segredo nunca exposto', async () => {
    const org = await seedOrg({ name: 'wh', slug: 'wh' });
    const actor = await seedActor('u-wh', org.id, ['corporate_admin']);
    const ctx = ctxFor(actor, org.id);
    const canary = `ARDEN_BE006_TOOL_SECRET_CANARY_${randomUUID()}`;

    const conn = (await connections.create(ctx, { connectorKey: 'system.webhook', connectorVersion: '1', name: 'wh' }, idemKey('c'))).body.data;
    await prisma.organizationConnection.update({
      where: { id: conn.id },
      data: {
        configuration: { endpointUrl: `http://127.0.0.1:${port}/hook`, signPayload: true },
        networkPolicy: { allowedProtocols: ['http'], allowedHosts: ['127.0.0.1'], allowedPorts: [port], allowRedirects: false, maximumRedirects: 0, allowPrivateNetworks: false, allowLoopback: true, allowLinkLocal: false, maximumRequestBytes: 1_048_576, maximumResponseBytes: 5_242_880, timeoutMs: 1_500 },
      },
    });
    await credentials.create(ctx, conn.id, { secret: { signingSecret: canary } } as never, idemKey('cred'));
    const fresh = (await connections.get(ctx, conn.id)).data;
    await connections.transitionStatus(ctx, conn.id, 'ACTIVE', fresh.revision);

    const orgBinding = (await bindings.createOrgBinding(ctx, { connectionId: conn.id, connectorToolKey: 'webhook.send', connectorToolVersion: '1', name: 'wh-tool' }, idemKey('ob'))).body.data;
    const operationId = await draftOperationWithTool(org.id, actor.auth, 'wh', 'external.webhook.send');
    await bindings.createOperationBinding(ctx, operationId, { organizationToolBindingId: orgBinding.id, alias: 'wh', allowedActionKeys: ['external.webhook.send'], inputMapping: {}, outputMapping: {} }, idemKey('opb'));
    const versions = await request(server).get(`${base(org.id)}/operations/${operationId}/versions`).set('Authorization', actor.auth);
    const version = versions.body.data[0];
    await request(server).post(`${base(org.id)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });

    handler = (_req, res) => { res.writeHead(200); res.end('{}'); };
    const created = await request(server).post(`${base(org.id)}/operations/${operationId}/executions`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input: { event: 'order.created', payload: { id: 1 } }, maxAttempts: 2 });
    const execId = created.body.data.id as string;
    await worker.drain(WK);

    expect((await prisma.executionRun.findUnique({ where: { id: execId } }))?.status).toBe('SUCCEEDED');
    const seen = received.at(-1)!;
    expect(seen.method).toBe('POST');
    expect(seen.url).toBe('/hook');
    expect(seen.headers['x-arden-signature']).toMatch(/^sha256=/);
    expect(seen.headers['idempotency-key']).toBeTruthy();
    const body = JSON.parse(seen.body);
    expect(body.event).toBe('order.created');
    // O segredo de assinatura nunca vai no corpo/headers em claro nem na evidência.
    expect(seen.body).not.toContain(canary);
    expect(await fullDump(execId)).not.toContain(canary);
  });
});

describe('internal.test — proibido em produção', () => {
  it('connector.test.echo é bloqueado quando NODE_ENV=production', async () => {
    const org = await seedOrg({ name: 'itp', slug: 'itp' });
    const actor = await seedActor('u-itp', org.id, ['corporate_admin']);
    const ctx = ctxFor(actor, org.id);
    const conn = (await connections.create(ctx, { connectorKey: 'internal.test', connectorVersion: '1', name: 'it' }, idemKey('c'))).body.data;
    // internal.test não usa credencial; ativa direto.
    await connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision);
    const orgBinding = (await bindings.createOrgBinding(ctx, { connectionId: conn.id, connectorToolKey: 'test.echo', connectorToolVersion: '1', name: 'echo' }, idemKey('ob'))).body.data;
    const operationId = await draftOperationWithTool(org.id, actor.auth, 'echo', 'connector.test.echo');
    await bindings.createOperationBinding(ctx, operationId, { organizationToolBindingId: orgBinding.id, alias: 'echo', allowedActionKeys: ['connector.test.echo'], inputMapping: {}, outputMapping: {} }, idemKey('opb'));
    const versions = await request(server).get(`${base(org.id)}/operations/${operationId}/versions`).set('Authorization', actor.auth);
    const version = versions.body.data[0];
    await request(server).post(`${base(org.id)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });

    const created = await request(server).post(`${base(org.id)}/operations/${operationId}/executions`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input: { hi: 1 } });
    const execId = created.body.data.id as string;

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await worker.drain(WK);
    } finally {
      process.env.NODE_ENV = prev;
    }
    const step = await prisma.executionStep.findFirst({ where: { executionRunId: execId } });
    expect(step?.status).toBe('FAILED');
    expect(step?.errorCode).toBe('TOOL_EXECUTION_DENIED');
  });

  it('connector.test.echo funciona fora de produção (echo determinístico)', async () => {
    const org = await seedOrg({ name: 'ite', slug: 'ite' });
    const actor = await seedActor('u-ite', org.id, ['corporate_admin']);
    const ctx = ctxFor(actor, org.id);
    const conn = (await connections.create(ctx, { connectorKey: 'internal.test', connectorVersion: '1', name: 'it' }, idemKey('c'))).body.data;
    await connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision);
    const orgBinding = (await bindings.createOrgBinding(ctx, { connectionId: conn.id, connectorToolKey: 'test.echo', connectorToolVersion: '1', name: 'echo' }, idemKey('ob'))).body.data;
    const operationId = await draftOperationWithTool(org.id, actor.auth, 'echo', 'connector.test.echo');
    await bindings.createOperationBinding(ctx, operationId, { organizationToolBindingId: orgBinding.id, alias: 'echo', allowedActionKeys: ['connector.test.echo'], inputMapping: {}, outputMapping: {} }, idemKey('opb'));
    const versions = await request(server).get(`${base(org.id)}/operations/${operationId}/versions`).set('Authorization', actor.auth);
    const version = versions.body.data[0];
    await request(server).post(`${base(org.id)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });
    const created = await request(server).post(`${base(org.id)}/operations/${operationId}/executions`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input: { hi: 'echo' } });
    const execId = created.body.data.id as string;
    await worker.drain(WK);
    expect((await prisma.executionRun.findUnique({ where: { id: execId } }))?.status).toBe('SUCCEEDED');
  });
});

describe('tool bindings — endpoints (controllers) e binding removido', () => {
  it('cria org/operation bindings via API e bloqueia execução após remoção do binding', async () => {
    const org = await seedOrg({ name: 'ctl', slug: 'ctl' });
    const actor = await seedActor('u-ctl', org.id, ['corporate_admin']);
    const ctx = ctxFor(actor, org.id);
    const conn = (await connections.create(ctx, { connectorKey: 'system.http', connectorVersion: '1', name: 'http' }, idemKey('c'))).body.data;
    await prisma.organizationConnection.update({ where: { id: conn.id }, data: { configuration: { baseUrl: `http://127.0.0.1:${port}` }, networkPolicy: { allowedProtocols: ['http'], allowedHosts: ['127.0.0.1'], allowedPorts: [port], allowRedirects: false, maximumRedirects: 0, allowPrivateNetworks: false, allowLoopback: true, allowLinkLocal: false, maximumRequestBytes: 1_048_576, maximumResponseBytes: 5_242_880, timeoutMs: 1_500 } } });
    await credentials.create(ctx, conn.id, { secret: { scheme: 'NONE' } } as never, idemKey('cred'));
    const fresh = (await connections.get(ctx, conn.id)).data;
    await connections.transitionStatus(ctx, conn.id, 'ACTIVE', fresh.revision);

    // Cria org binding via HTTP API (controller).
    const orgB = await request(server).post(`${base(org.id)}/tool-bindings`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('ob')).send({ connectionId: conn.id, connectorToolKey: 'http.request', connectorToolVersion: '1', name: 'http-tool' });
    expect(orgB.status).toBe(201);
    // Lista e consulta.
    const list = await request(server).get(`${base(org.id)}/tool-bindings`).set('Authorization', actor.auth);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);

    const operationId = await draftOperationWithTool(org.id, actor.auth, 'api');
    const opB = await request(server).post(`${base(org.id)}/operations/${operationId}/tool-bindings`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('opb')).send({ organizationToolBindingId: orgB.body.data.id, alias: 'api', allowedActionKeys: ['external.http.request'] });
    expect(opB.status).toBe(201);
    const versions = await request(server).get(`${base(org.id)}/operations/${operationId}/versions`).set('Authorization', actor.auth);
    const version = versions.body.data[0];
    await request(server).post(`${base(org.id)}/operations/${operationId}/versions/${version.id}/publish`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: version.revision, changeSummary: 'v1' });

    // Remove o operation binding via DELETE (controller) e depois a execução falha.
    const del = await request(server).delete(`${base(org.id)}/operations/${operationId}/tool-bindings/${opB.body.data.id}?expectedRevision=${opB.body.data.revision}`).set('Authorization', actor.auth);
    expect(del.status).toBe(200);

    const created = await request(server).post(`${base(org.id)}/operations/${operationId}/executions`).set('Authorization', actor.auth).set('Idempotency-Key', idemKey('exec')).send({ actionKey: 'communication.send', input: { method: 'GET', path: '/x' } });
    // Fail-fast na criação: alias indisponível.
    expect(created.status).toBe(403);
    expect(created.body.error.code).toBe('EXECUTION_NOT_ALLOWED');
  });
});
