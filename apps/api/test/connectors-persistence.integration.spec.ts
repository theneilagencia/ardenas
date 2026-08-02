/**
 * Arden.AS API — integração de persistência de conectores (ARDEN-BE-006.3).
 * PostgreSQL real. Testa catálogo projetado, conexões/credenciais/bindings/webhooks
 * tenant-scoped, revision, idempotência, auditoria sanitizada e ausência de segredo.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { seedActor, idemKey, type Actor } from './operations-helpers';
import type { AuthenticatedRequestContext } from '../src/identity/request-context';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ConnectionsService } from '../src/connectors/connections/connections.service';
import { CredentialVersionsService } from '../src/connectors/connections/credential-versions.service';
import { ToolBindingsService } from '../src/connectors/tool-bindings/tool-bindings.service';
import { WebhooksService } from '../src/connectors/webhooks/webhooks.service';

let app: NestFastifyApplication;
let connections: ConnectionsService;
let credentials: CredentialVersionsService;
let bindings: ToolBindingsService;
let webhooks: WebhooksService;

beforeAll(async () => {
  app = await startTestApp();
  await app.get(ConnectorCatalogProjector).project();
  connections = app.get(ConnectionsService);
  credentials = app.get(CredentialVersionsService);
  bindings = app.get(ToolBindingsService);
  webhooks = app.get(WebhooksService);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetIdentity();
  await app.get(ConnectorCatalogProjector).project();
});

function ctxFor(actor: Actor, orgId: string): AuthenticatedRequestContext {
  return { correlationId: `corr-${actor.subject}`, userId: actor.userId, organizationId: orgId } as unknown as AuthenticatedRequestContext;
}

async function makeOrgActor(slug: string) {
  const org = await seedOrg({ name: slug, slug });
  const actor = await seedActor(`user-${slug}`, org.id, ['security_admin', 'operation_owner']);
  return { orgId: org.id, actor, ctx: ctxFor(actor, org.id) };
}

async function newConnection(ctx: AuthenticatedRequestContext) {
  const res = await connections.create(ctx, { connectorKey: 'system.http', connectorVersion: '1', name: 'HTTP conn' }, idemKey('conn'));
  return res.body.data;
}

describe('catálogo projetado', () => {
  it('conectores e ferramentas de referência existem; internal.test não é de produção', async () => {
    const defs = await prisma.connectorDefinition.findMany();
    expect(defs.map((d) => d.key).sort()).toEqual(['internal.test', 'system.http', 'system.webhook']);
    expect(defs.find((d) => d.key === 'internal.test')!.productionAllowed).toBe(false);
    const tools = await prisma.connectorToolDefinition.count();
    expect(tools).toBe(5);
  });
});

describe('conexões — tenant-scoped, revision, transições', () => {
  it('cria (DRAFT rev 1), lê tenant-scoped e lista', async () => {
    const { ctx } = await makeOrgActor('alpha1');
    const conn = await newConnection(ctx);
    expect(conn.status).toBe('DRAFT');
    expect(conn.revision).toBe(1);
    expect(conn.connectorKey).toBe('system.http');
    const got = await connections.get(ctx, conn.id);
    expect(got.data.id).toBe(conn.id);
    const list = await connections.list(ctx, {}, 50);
    expect(list.data.length).toBe(1);
  });

  it('update usa revision e incrementa', async () => {
    const { ctx } = await makeOrgActor('alpha2');
    const conn = await newConnection(ctx);
    const updated = await connections.update(ctx, conn.id, { name: 'Renamed', expectedRevision: 1 });
    expect(updated.data.name).toBe('Renamed');
    expect(updated.data.revision).toBe(2);
    await expect(connections.update(ctx, conn.id, { name: 'X', expectedRevision: 1 })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('DRAFT→ACTIVE→SUSPENDED→ACTIVE(reactivated)→REVOKED; REVOKED é terminal', async () => {
    const { ctx } = await makeOrgActor('alpha3');
    let conn = await newConnection(ctx);
    conn = (await connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision)).data;
    expect(conn.status).toBe('ACTIVE');
    conn = (await connections.transitionStatus(ctx, conn.id, 'SUSPENDED', conn.revision)).data;
    conn = (await connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision)).data;
    conn = (await connections.transitionStatus(ctx, conn.id, 'REVOKED', conn.revision)).data;
    expect(conn.status).toBe('REVOKED');
    await expect(connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision)).rejects.toMatchObject({ code: 'CONNECTION_REVOKED' });
  });

  it('transição inválida é rejeitada', async () => {
    const { ctx } = await makeOrgActor('alpha4');
    const conn = await newConnection(ctx);
    await expect(connections.transitionStatus(ctx, conn.id, 'SUSPENDED', conn.revision)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });
});

describe('credenciais — lifecycle sem segredo', () => {
  it('cria PENDING (sem material cripto), ativa, e nenhuma coluna sensível vaza no DTO', async () => {
    const { ctx } = await makeOrgActor('cred1');
    const conn = await newConnection(ctx);
    const cred = (await credentials.createPending(ctx, conn.id)).data;
    expect(cred.status).toBe('PENDING');
    // DTO não tem campos criptográficos.
    expect(Object.keys(cred)).not.toContain('encryptedSecret');
    expect(Object.keys(cred)).not.toContain('nonce');
    // Banco: nenhum plaintext/cipher — tudo nulo.
    const row = await prisma.connectionCredentialVersion.findFirst({ where: { id: cred.id } });
    expect(row!.encryptedSecret).toBeNull();
    expect(row!.nonce).toBeNull();
    expect(row!.authTag).toBeNull();
    expect(row!.fingerprint).toBeNull();

    const activated = (await credentials.activate(ctx, conn.id, cred.id)).data;
    expect(activated.status).toBe('ACTIVE');
    const freshConn = await connections.get(ctx, conn.id);
    expect(freshConn.data.currentCredentialVersionId).toBe(cred.id);
  });

  it('rotação: nova versão supersede a anterior; só uma ACTIVE', async () => {
    const { ctx } = await makeOrgActor('cred2');
    const conn = await newConnection(ctx);
    const v1 = (await credentials.createPending(ctx, conn.id)).data;
    await credentials.activate(ctx, conn.id, v1.id);
    const v2 = (await credentials.createPending(ctx, conn.id)).data;
    await credentials.activate(ctx, conn.id, v2.id);
    const actives = await prisma.connectionCredentialVersion.count({ where: { connectionId: conn.id, status: 'ACTIVE' } });
    expect(actives).toBe(1);
    const v1row = await prisma.connectionCredentialVersion.findFirst({ where: { id: v1.id } });
    expect(v1row!.status).toBe('SUPERSEDED');
  });
});

describe('tool bindings + operation bindings', () => {
  async function boundConnection(ctx: AuthenticatedRequestContext) {
    const conn = await newConnection(ctx);
    const active = (await connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision)).data;
    const binding = (await bindings.createOrgBinding(ctx, { connectionId: active.id, connectorToolKey: 'http.request', connectorToolVersion: '1', name: 'call' }, idemKey('b'))).body.data;
    return { conn: active, binding };
  }

  it('cria org binding compatível; incompatível é rejeitado', async () => {
    const { ctx } = await makeOrgActor('bind1');
    const { binding } = await boundConnection(ctx);
    expect(binding.connectorToolKey).toBe('http.request');
    const conn2 = await newConnection(ctx);
    await expect(bindings.createOrgBinding(ctx, { connectionId: conn2.id, connectorToolKey: 'webhook.send', connectorToolVersion: '1', name: 'x' }, idemKey('b'))).rejects.toMatchObject({ code: 'TOOL_NOT_AVAILABLE' });
  });

  it('operation binding: alias único, action keys válidas e remoção LÓGICA', async () => {
    const { ctx, orgId, actor } = await makeOrgActor('bind2');
    const { binding } = await boundConnection(ctx);
    const op = await prisma.operation.create({ data: { organizationId: orgId, name: 'Op', status: 'active', createdBy: actor.userId } });
    const created = (await bindings.createOperationBinding(ctx, op.id, { organizationToolBindingId: binding.id, alias: 'call', allowedActionKeys: ['external.http.request'] }, idemKey('ob'))).body.data;
    expect(created.alias).toBe('call');
    // alias duplicado → conflito.
    await expect(bindings.createOperationBinding(ctx, op.id, { organizationToolBindingId: binding.id, alias: 'call', allowedActionKeys: ['external.http.request'] }, idemKey('ob'))).rejects.toMatchObject({ code: 'RESOURCE_CONFLICT' });
    // action key desconhecida → validação.
    await expect(bindings.createOperationBinding(ctx, op.id, { organizationToolBindingId: binding.id, alias: 'other', allowedActionKeys: ['bogus.key'] as never }, idemKey('ob'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    // remoção lógica preserva o registro.
    await bindings.removeOperationBinding(ctx, op.id, created.id, created.revision);
    const row = await prisma.operationToolBinding.findFirst({ where: { id: created.id } });
    expect(row).not.toBeNull();
    expect(row!.removedAt).not.toBeNull();
    expect(row!.enabled).toBe(false);
    const list = await bindings.listOperationBindings(ctx, op.id);
    expect(list.data.find((b) => b.id === created.id)).toBeUndefined();
  });
});

describe('webhooks — endpoint (token só hash) e delivery (dedup)', () => {
  it('cria endpoint: token retornado 1×; hash persistido; DTO sem hash/segredo', async () => {
    const { ctx } = await makeOrgActor('wh1');
    const conn = await newConnection(ctx);
    const created = (await webhooks.createEndpoint(ctx, { connectionId: conn.id, key: 'inbound', signatureScheme: 'HMAC_SHA256', replayWindowSeconds: 300 }, idemKey('wh'))).body.data;
    // Token opaco retornado UMA vez (whk_...); HMAC gera segredo de assinatura 1×.
    expect(created.endpointToken).toBeTruthy();
    expect(created.endpointToken!.length).toBeGreaterThan(20);
    expect(typeof created.signingSecret).toBe('string');
    expect(Object.keys(created.endpoint)).not.toContain('pathTokenHash');
    const row = await prisma.webhookEndpoint.findFirst({ where: { id: created.endpoint.id } });
    expect(row!.pathTokenHash).not.toBe(created.endpointToken); // guardado só como hash
    expect(row!.secretCredentialVersionId).toBeTruthy(); // segredo cifrado no cofre
  });

  it('endpoint REVOKED não reativa; delivery dedup por externalDeliveryId', async () => {
    const { ctx } = await makeOrgActor('wh2');
    const conn = await newConnection(ctx);
    const created = (await webhooks.createEndpoint(ctx, { connectionId: conn.id, key: 'k', signatureScheme: 'HMAC_SHA256', replayWindowSeconds: 300 }, idemKey('wh'))).body.data;
    const ep = created.endpoint;
    const revoked = (await webhooks.transitionEndpoint(ctx, ep.id, 'REVOKED', ep.revision)).data;
    await expect(webhooks.transitionEndpoint(ctx, ep.id, 'ACTIVE', revoked.revision)).rejects.toMatchObject({ code: 'WEBHOOK_ENDPOINT_REVOKED' });

    const d1 = await webhooks.recordDelivery(ctx, ep.id, { externalDeliveryId: 'ext-1', payloadHash: 'h1' });
    expect(d1.deduplicated).toBe(false);
    const d2 = await webhooks.recordDelivery(ctx, ep.id, { externalDeliveryId: 'ext-1', payloadHash: 'h1' });
    expect(d2.deduplicated).toBe(true);
    expect(d2.data.id).toBe(d1.data.id);
    const count = await prisma.webhookDelivery.count({ where: { webhookEndpointId: ep.id, externalDeliveryId: 'ext-1' } });
    expect(count).toBe(1);
  });
});

describe('idempotência e auditoria', () => {
  it('mesma Idempotency-Key + body → replay sem duplicar', async () => {
    const { ctx } = await makeOrgActor('idem1');
    const key = idemKey('c');
    const first = await connections.create(ctx, { connectorKey: 'system.http', connectorVersion: '1', name: 'A' }, key);
    const second = await connections.create(ctx, { connectorKey: 'system.http', connectorVersion: '1', name: 'A' }, key);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await prisma.organizationConnection.count()).toBe(1);
  });

  it('auditoria registra ações e nunca contém campos de segredo', async () => {
    const { ctx, orgId } = await makeOrgActor('audit1');
    const conn = await newConnection(ctx);
    const cred = (await credentials.createPending(ctx, conn.id)).data;
    await credentials.activate(ctx, conn.id, cred.id);
    const events = await prisma.auditEvent.findMany({ where: { organizationId: orgId } });
    const actions = events.map((e) => e.action);
    expect(actions).toContain('connection.created');
    expect(actions).toContain('credential.version_created');
    expect(actions).toContain('credential.activated');
    const blob = JSON.stringify(events).toLowerCase();
    for (const bad of ['encryptedsecret', 'authtag', 'nonce', 'plaintext']) expect(blob.includes(bad)).toBe(false);
  });
});
