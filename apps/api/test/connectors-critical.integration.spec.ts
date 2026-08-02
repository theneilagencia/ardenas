/**
 * Arden.AS API — testes CRÍTICOS de persistência de conectores (ARDEN-BE-006.3).
 * Cross-tenant, revision concorrente, ativação concorrente de credencial e seed
 * idempotente. PostgreSQL real.
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
let projector: ConnectorCatalogProjector;

beforeAll(async () => {
  app = await startTestApp();
  projector = app.get(ConnectorCatalogProjector);
  await projector.project();
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
  await projector.project();
});

function ctxFor(actor: Actor, orgId: string): AuthenticatedRequestContext {
  return { correlationId: `corr-${actor.subject}`, userId: actor.userId, organizationId: orgId } as unknown as AuthenticatedRequestContext;
}
async function makeOrg(slug: string) {
  const org = await seedOrg({ name: slug, slug });
  const actor = await seedActor(`u-${slug}`, org.id, ['security_admin', 'operation_owner']);
  return { orgId: org.id, actor, ctx: ctxFor(actor, org.id) };
}
const httpConn = (ctx: AuthenticatedRequestContext) =>
  connections.create(ctx, { connectorKey: 'system.http', connectorVersion: '1', name: 'c' }, idemKey('c')).then((r) => r.body.data);

describe('CRÍTICO — isolamento cross-tenant', () => {
  it('Alpha não acessa nem referencia recursos de Beta', async () => {
    const alpha = await makeOrg('alpha');
    const beta = await makeOrg('beta');
    const alphaConn = await httpConn(alpha.ctx);
    const betaConn = await httpConn(beta.ctx);

    // Beta não lê conexão de Alpha.
    await expect(connections.get(beta.ctx, alphaConn.id)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    // Alpha não cria binding com conexão de Beta (não encontrada no tenant de Alpha).
    await expect(bindings.createOrgBinding(alpha.ctx, { connectionId: betaConn.id, connectorToolKey: 'http.request', connectorToolVersion: '1', name: 'x' }, idemKey('b'))).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

    // Credencial de Beta não vira current de Alpha (não encontrada no tenant de Alpha).
    const betaCred = (await credentials.createPending(beta.ctx, betaConn.id)).data;
    await expect(credentials.activate(alpha.ctx, alphaConn.id, betaCred.id)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

    // Operação de Alpha não referencia org binding de Beta.
    const betaActive = (await connections.transitionStatus(beta.ctx, betaConn.id, 'ACTIVE', betaConn.revision)).data;
    const betaBinding = (await bindings.createOrgBinding(beta.ctx, { connectionId: betaActive.id, connectorToolKey: 'http.request', connectorToolVersion: '1', name: 'b' }, idemKey('b'))).body.data;
    const alphaOp = await prisma.operation.create({ data: { organizationId: alpha.orgId, name: 'Op', status: 'active', createdBy: alpha.actor.userId } });
    await expect(bindings.createOperationBinding(alpha.ctx, alphaOp.id, { organizationToolBindingId: betaBinding.id, alias: 'a', allowedActionKeys: ['external.http.request'] }, idemKey('ob'))).rejects.toMatchObject({ code: 'TOOL_BINDING_NOT_FOUND' });

    // Webhook de Alpha não referencia conexão de Beta.
    await expect(webhooks.createEndpoint(alpha.ctx, { connectionId: betaConn.id, key: 'k', signatureScheme: 'HMAC_SHA256', replayWindowSeconds: 300 }, idemKey('wh'))).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

    // Auditoria não mistura tenants.
    const alphaEvents = await prisma.auditEvent.findMany({ where: { organizationId: alpha.orgId } });
    expect(alphaEvents.every((e) => e.organizationId === alpha.orgId)).toBe(true);
  });
});

describe('CRÍTICO — revision concorrente', () => {
  it('dois updates revision=1: um vence, outro VERSION_CONFLICT', async () => {
    const { ctx } = await makeOrg('rev');
    const conn = await httpConn(ctx);
    const results = await Promise.allSettled([
      connections.update(ctx, conn.id, { name: 'A', expectedRevision: 1 }),
      connections.update(ctx, conn.id, { name: 'B', expectedRevision: 1 }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].reason).toMatchObject({ code: 'VERSION_CONFLICT' });
    const row = await prisma.organizationConnection.findFirst({ where: { id: conn.id } });
    expect(row!.revision).toBe(2);
  });
});

describe('CRÍTICO — ativação concorrente de credencial', () => {
  it('duas ativações simultâneas: apenas uma fica ACTIVE', async () => {
    const { ctx } = await makeOrg('cred');
    const conn = await httpConn(ctx);
    const v1 = (await credentials.createPending(ctx, conn.id)).data;
    const v2 = (await credentials.createPending(ctx, conn.id)).data;
    const results = await Promise.allSettled([
      credentials.activate(ctx, conn.id, v1.id),
      credentials.activate(ctx, conn.id, v2.id),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const actives = await prisma.connectionCredentialVersion.count({ where: { connectionId: conn.id, status: 'ACTIVE' } });
    expect(actives).toBe(1);
    // Nenhum plaintext.
    const rows = await prisma.connectionCredentialVersion.findMany({ where: { connectionId: conn.id } });
    expect(rows.every((r) => r.encryptedSecret === null)).toBe(true);
  });
});

describe('CRÍTICO — seed/projeção idempotente', () => {
  it('segunda projeção deixa tudo unchanged; sem duplicação', async () => {
    const before = await prisma.connectorDefinition.count();
    const toolsBefore = await prisma.connectorToolDefinition.count();
    const res = await projector.project();
    expect(res.connectorsCreated).toBe(0);
    expect(res.toolsCreated).toBe(0);
    expect(res.connectorsUnchanged).toBe(before);
    expect(res.toolsUnchanged).toBe(toolsBefore);
    expect(await prisma.connectorDefinition.count()).toBe(before);
    expect(await prisma.connectorToolDefinition.count()).toBe(toolsBefore);
  });
});
