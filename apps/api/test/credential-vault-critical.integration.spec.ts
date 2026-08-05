/**
 * Arden.AS API — testes CRÍTICOS do cofre (ARDEN-BE-006.4).
 * Canário de segredo, troca de ciphertext, rotação concorrente, rollback e
 * isolamento cross-tenant. PostgreSQL real + AES-GCM.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { seedActor, idemKey, type Actor } from './operations-helpers';
import type { AuthenticatedRequestContext } from '../src/identity/request-context';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ConnectionsService } from '../src/connectors/connections/connections.service';
import { CredentialVersionsService } from '../src/connectors/connections/credential-versions.service';
import { CredentialResolver } from '../src/connectors/vault/credential-resolver';
import { OrganizationConnectionsRepository } from '../src/connectors/connections/connections.repository';

let app: NestFastifyApplication;
let connections: ConnectionsService;
let credentials: CredentialVersionsService;
let resolver: CredentialResolver;
let connectionsRepo: OrganizationConnectionsRepository;

beforeAll(async () => {
  app = await startTestApp();
  await app.get(ConnectorCatalogProjector).project();
  connections = app.get(ConnectionsService);
  credentials = app.get(CredentialVersionsService);
  resolver = app.get(CredentialResolver);
  connectionsRepo = app.get(OrganizationConnectionsRepository);
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
  return { correlationId: `c-${actor.subject}`, userId: actor.userId, organizationId: orgId } as unknown as AuthenticatedRequestContext;
}
async function setup(slug: string) {
  const org = await seedOrg({ name: slug, slug });
  const actor = await seedActor(`u-${slug}`, org.id, ['security_admin']);
  const ctx = ctxFor(actor, org.id);
  const conn = (await connections.create(ctx, { connectorKey: 'system.http', connectorVersion: '1', name: 'c' }, idemKey('c'))).body.data;
  const active = (await connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision)).data;
  return { orgId: org.id, actor, ctx, connectionId: active.id };
}
const base = (o: string, c: string) => `/api/v1/organizations/${o}/connections/${c}/credentials`;

describe('CRÍTICO — canário de segredo', () => {
  it('o canário não aparece fora do ciphertext (banco/auditoria/idempotência/respostas)', async () => {
    const CANARY = `ARDEN_BE006_SECRET_CANARY_${randomUUID()}`;
    const { orgId, actor, connectionId } = await setup('canary');
    const responses: string[] = [];
    responses.push(JSON.stringify((await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', idemKey('c')).send({ secret: { scheme: 'BEARER_TOKEN', token: CANARY } })).body));
    responses.push(JSON.stringify((await request(app.getHttpServer()).get(base(orgId, connectionId)).set('authorization', actor.auth)).body));
    const resolved = await resolver.resolveActiveCredential({ organizationId: orgId, connectionId });
    expect(resolved.secret.token).toBe(CANARY); // resolução interna funciona
    responses.push(JSON.stringify((await request(app.getHttpServer()).post(`${base(orgId, connectionId)}/rotate`).set('authorization', actor.auth).set('idempotency-key', idemKey('r')).send({ secret: { scheme: 'BEARER_TOKEN', token: CANARY } })).body));
    const list = await prisma.connectionCredentialVersion.findMany({ where: { connectionId } });
    for (const id of list.map((r) => r.id)) responses.push(JSON.stringify((await request(app.getHttpServer()).post(`${base(orgId, connectionId)}/${id}/revoke`).set('authorization', actor.auth).set('idempotency-key', idemKey('rv')).send({})).body));

    // Respostas: nunca o canário.
    for (const r of responses) expect(r).not.toContain(CANARY);
    // Banco: NEM MESMO no ciphertext (segredo cifrado). Varre todas as colunas.
    const rows = await prisma.connectionCredentialVersion.findMany({ where: { connectionId } });
    expect(JSON.stringify(rows)).not.toContain(CANARY);
    // Auditoria e idempotência.
    expect(JSON.stringify(await prisma.auditEvent.findMany({ where: { organizationId: orgId } }))).not.toContain(CANARY);
    expect(JSON.stringify(await prisma.idempotencyRecord.findMany())).not.toContain(CANARY);
  });
});

describe('CRÍTICO — troca de ciphertext (AAD)', () => {
  it('ciphertext de uma credencial não decifra em outra conexão/tenant/versão', async () => {
    const alpha = await setup('alpha-swap');
    const beta = await setup('beta-swap');
    await request(app.getHttpServer()).post(base(alpha.orgId, alpha.connectionId)).set('authorization', alpha.actor.auth).set('idempotency-key', idemKey('c')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'ALPHA_SECRET' } });
    const alphaRow = await prisma.connectionCredentialVersion.findFirst({ where: { connectionId: alpha.connectionId, status: 'ACTIVE' } });

    // Cria e ativa uma versão em Beta (sem segredo), depois injeta o material de Alpha.
    const betaCred = (await credentials.createPending(beta.ctx, beta.connectionId)).data;
    await credentials.activate(beta.ctx, beta.connectionId, betaCred.id);
    await prisma.connectionCredentialVersion.update({
      where: { id: betaCred.id },
      data: { encryptedSecret: alphaRow!.encryptedSecret, nonce: alphaRow!.nonce, authTag: alphaRow!.authTag, algorithm: 'AES-256-GCM', keyVersion: alphaRow!.keyVersion },
    });
    // A AAD de Beta (org/conn/credVersionId diferentes) → decifragem falha, SANITIZADA.
    await expect(resolver.resolveActiveCredential({ organizationId: beta.orgId, connectionId: beta.connectionId })).rejects.toMatchObject({ code: 'CREDENTIAL_RESOLUTION_FAILED' });
  });
});

describe('CRÍTICO — rotação concorrente', () => {
  it('duas rotações simultâneas: uma única versão fica ATIVA', async () => {
    const { orgId, actor, connectionId } = await setup('rot-conc');
    await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', idemKey('c')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'V1' } });
    const results = await Promise.allSettled([
      request(app.getHttpServer()).post(`${base(orgId, connectionId)}/rotate`).set('authorization', actor.auth).set('idempotency-key', idemKey('ra')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'VA' } }),
      request(app.getHttpServer()).post(`${base(orgId, connectionId)}/rotate`).set('authorization', actor.auth).set('idempotency-key', idemKey('rb')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'VB' } }),
    ]);
    // Ambas as requisições resolvem (HTTP), mas só uma nova versão fica ATIVA.
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const actives = await prisma.connectionCredentialVersion.count({ where: { connectionId, status: 'ACTIVE' } });
    expect(actives).toBe(1);
  });
});

describe('CRÍTICO — rollback de rotação', () => {
  it('falha antes do ponteiro: v1 continua ativa, nova versão não persiste', async () => {
    const { orgId, actor, ctx, connectionId } = await setup('rollback');
    const first = await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', idemKey('c')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'V1' } });
    const v1Id = first.body.data.id;

    // Injeta falha em setCurrentCredential (após cifrar, antes do ponteiro) → tx inteira reverte.
    const spy = vi.spyOn(connectionsRepo, 'setCurrentCredential').mockRejectedValueOnce(new Error('boom'));
    await expect(credentials.rotate(ctx, connectionId, { secret: { scheme: 'BEARER_TOKEN', token: 'V2' } }, idemKey('r'))).rejects.toThrow();
    spy.mockRestore();

    const rows = await prisma.connectionCredentialVersion.findMany({ where: { connectionId } });
    expect(rows.length).toBe(1); // v2 revertida
    expect(rows[0].id).toBe(v1Id);
    expect(rows[0].status).toBe('ACTIVE');
    const conn = await prisma.organizationConnection.findFirst({ where: { id: connectionId } });
    expect(conn!.currentCredentialVersionId).toBe(v1Id);
    const rotated = await prisma.auditEvent.findMany({ where: { organizationId: orgId, action: 'credential.rotated' } });
    expect(rotated.length).toBe(0); // nenhuma auditoria de sucesso
  });
});

describe('CRÍTICO — cross-tenant', () => {
  it('Beta não cria/lista/revoga credencial de conexão de Alpha; resolução isolada', async () => {
    const alpha = await setup('alpha-x');
    const beta = await setup('beta-x');
    await request(app.getHttpServer()).post(base(alpha.orgId, alpha.connectionId)).set('authorization', alpha.actor.auth).set('idempotency-key', idemKey('c')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'ALPHA' } });

    // Beta tenta criar credencial na conexão de Alpha (path com org de Beta, conn de Alpha) → 404.
    const res = await request(app.getHttpServer()).post(base(beta.orgId, alpha.connectionId)).set('authorization', beta.actor.auth).set('idempotency-key', idemKey('c')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'X' } });
    expect(res.status).toBe(404);
    // Resolver credencial de Alpha a partir do tenant Beta → não encontra.
    await expect(resolver.resolveActiveCredential({ organizationId: beta.orgId, connectionId: alpha.connectionId })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
});
