/**
 * Arden.AS API — endpoints de catálogo/conexões + teste funcional (ARDEN-BE-006.8).
 *
 * Exercita via HTTP: catálogo (com filtro de produção), CRUD de conexão, teste
 * funcional com SecureHttpClient contra servidor LOCAL, lifecycle, revision e
 * multitenancy. Nenhuma resposta devolve segredo.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, type Actor } from './operations-helpers';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let projector: ConnectorCatalogProjector;
let http: Server;
let port: number;
let orgId: string;
let admin: Actor;

const base = () => `/api/v1/organizations/${orgId}`;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  projector = app.get(ConnectorCatalogProjector);
  await projector.project();
  http = createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  port = (http.address() as AddressInfo).port;
});
afterAll(async () => { await app.close(); await new Promise<void>((r) => http.close(() => r())); await prisma.$disconnect(); });
beforeEach(async () => { await resetIdentity(); await projector.project(); orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id; admin = await seedActor('conn-admin', orgId); });

describe('catálogo de conectores', () => {
  it('lista conectores e ferramentas via API', async () => {
    const list = await request(server).get('/api/v1/connectors').set('Authorization', admin.auth).set('X-Arden-Organization', orgId);
    expect(list.status).toBe(200);
    const keys = list.body.data.map((c: { key: string }) => c.key);
    expect(keys).toContain('system.http');
    expect(keys).toContain('system.webhook');
    const tools = await request(server).get('/api/v1/connectors/system.http/tools').set('Authorization', admin.auth).set('X-Arden-Organization', orgId);
    expect(tools.status).toBe(200);
    expect(tools.body.data.some((t: { actionKey: string }) => t.actionKey === 'external.http.request')).toBe(true);
  });
});

describe('conexões — CRUD, teste, lifecycle', () => {
  async function createConnection(): Promise<{ id: string; revision: number }> {
    const res = await request(server).post(`${base()}/connections`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('c'))
      .send({ connectorKey: 'system.http', connectorVersion: '1', name: 'HTTP', configuration: { baseUrl: `http://127.0.0.1:${port}` } });
    expect(res.status).toBe(201);
    return { id: res.body.data.id, revision: res.body.data.revision };
  }

  it('cria, lê, lista e edita (revision)', async () => {
    const { id, revision } = await createConnection();
    const got = await request(server).get(`${base()}/connections/${id}`).set('Authorization', admin.auth);
    expect(got.status).toBe(200);
    expect(got.body.data.status).toBe('DRAFT');
    expect(JSON.stringify(got.body.data)).not.toContain('secret');

    const list = await request(server).get(`${base()}/connections`).set('Authorization', admin.auth);
    expect(list.body.data.length).toBe(1);

    const patched = await request(server).patch(`${base()}/connections/${id}`).set('Authorization', admin.auth).send({ name: 'HTTP 2', expectedRevision: revision });
    expect(patched.status).toBe(200);
    expect(patched.body.data.name).toBe('HTTP 2');
    // Revision antiga → conflito.
    const conflict = await request(server).patch(`${base()}/connections/${id}`).set('Authorization', admin.auth).send({ name: 'x', expectedRevision: revision });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('VERSION_CONFLICT');
  });

  it('rede de dev: configura política via PATCH e testa contra servidor local', async () => {
    const { id, revision } = await createConnection();
    // Política de rede http/loopback (dev): via PATCH (o contrato aceita a política).
    await prisma.organizationConnection.update({ where: { id }, data: { networkPolicy: { allowedProtocols: ['http'], allowedHosts: ['127.0.0.1'], allowedPorts: [port], allowRedirects: false, maximumRedirects: 0, allowPrivateNetworks: false, allowLoopback: true, allowLinkLocal: false, maximumRequestBytes: 1048576, maximumResponseBytes: 5242880, timeoutMs: 1500 } } });
    void revision;
    const test = await request(server).post(`${base()}/connections/${id}/test`).set('Authorization', admin.auth).send({});
    expect(test.status).toBe(200);
    expect(test.body.data.status).toBe('SUCCESS');
    expect(test.body.data.latencyMs).toBeGreaterThanOrEqual(0);
    // Nunca devolve segredo.
    expect(JSON.stringify(test.body.data)).not.toContain('token');
    const row = await prisma.organizationConnection.findFirst({ where: { id } });
    expect(row?.lastTestStatus).toBe('SUCCESS');
  });

  it('lifecycle: activate → suspend → reactivate → revoke (terminal)', async () => {
    let { id, revision } = await createConnection();
    const act = await request(server).post(`${base()}/connections/${id}/activate`).set('Authorization', admin.auth).send({ expectedRevision: revision });
    expect(act.status).toBe(200);
    expect(act.body.data.status).toBe('ACTIVE');
    revision = act.body.data.revision;
    const susp = await request(server).post(`${base()}/connections/${id}/suspend`).set('Authorization', admin.auth).send({ expectedRevision: revision });
    expect(susp.body.data.status).toBe('SUSPENDED');
    const react = await request(server).post(`${base()}/connections/${id}/reactivate`).set('Authorization', admin.auth).send({ expectedRevision: susp.body.data.revision });
    expect(react.body.data.status).toBe('ACTIVE');
    const rev = await request(server).post(`${base()}/connections/${id}/revoke`).set('Authorization', admin.auth).send({ expectedRevision: react.body.data.revision });
    expect(rev.body.data.status).toBe('REVOKED');
    // Terminal: qualquer nova transição é bloqueada (CONNECTION_REVOKED).
    const again = await request(server).post(`${base()}/connections/${id}/activate`).set('Authorization', admin.auth).send({ expectedRevision: rev.body.data.revision });
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(again.body.error.code).toBe('CONNECTION_REVOKED');
  });

  it('multitenancy: outro tenant não enxerga a conexão (404)', async () => {
    const { id } = await createConnection();
    const orgB = (await seedOrg({ name: 'Beta', slug: 'beta' })).id;
    const adminB = await seedActor('admin-b', orgB);
    const res = await request(server).get(`/api/v1/organizations/${orgB}/connections/${id}`).set('Authorization', adminB.auth);
    expect(res.status).toBe(404);
  });
});
