/**
 * Arden.AS API — integração do cofre de credenciais (ARDEN-BE-006.4).
 * PostgreSQL real + provider AES-GCM. Cria/lista/rotaciona/revoga via HTTP; resolve
 * SÓ no servidor; comprova ciphertext persistido, plaintext ausente e respostas/
 * auditoria sanitizadas.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { seedActor, idemKey, type Actor } from './operations-helpers';
import type { AuthenticatedRequestContext } from '../src/identity/request-context';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ConnectionsService } from '../src/connectors/connections/connections.service';
import { CredentialResolver } from '../src/connectors/vault/credential-resolver';

let app: NestFastifyApplication;
let connections: ConnectionsService;
let resolver: CredentialResolver;

beforeAll(async () => {
  app = await startTestApp();
  await app.get(ConnectorCatalogProjector).project();
  connections = app.get(ConnectionsService);
  resolver = app.get(CredentialResolver);
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

const base = (orgId: string, connId: string) => `/api/v1/organizations/${orgId}/connections/${connId}/credentials`;

describe('cofre — criação, cifra e resolução', () => {
  it('cria credencial cifrada; response sem segredo; ciphertext persistido sem plaintext', async () => {
    const { orgId, actor, connectionId } = await setup('vault1');
    const res = await request(app.getHttpServer())
      .post(base(orgId, connectionId))
      .set('authorization', actor.auth)
      .set('idempotency-key', idemKey('cred'))
      .send({ secret: { scheme: 'BEARER_TOKEN', token: 'CANARY_TOKEN_1' } });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain('CANARY_TOKEN_1');
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.fingerprint).toMatch(/^sha256:/);
    expect(res.body.data).not.toHaveProperty('encryptedSecret');
    expect(res.body.data).not.toHaveProperty('secret');

    const row = await prisma.connectionCredentialVersion.findFirst({ where: { connectionId, status: 'ACTIVE' } });
    expect(row!.encryptedSecret).not.toBeNull();
    expect(row!.nonce).not.toBeNull();
    expect(row!.authTag).not.toBeNull();
    expect(row!.algorithm).toBe('AES-256-GCM');
    // plaintext ausente: o ciphertext decodificado não contém o canário.
    expect(Buffer.from(row!.encryptedSecret!, 'base64').toString('utf8')).not.toContain('CANARY_TOKEN_1');

    const conn = await prisma.organizationConnection.findFirst({ where: { id: connectionId } });
    expect(conn!.currentCredentialVersionId).toBe(row!.id);
  });

  it('resolução server-side devolve o segredo apenas em memória', async () => {
    const { orgId, actor, connectionId } = await setup('vault2');
    await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', idemKey('cred')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'RESOLVE_ME' } });
    const resolved = await resolver.resolveActiveCredential({ organizationId: orgId, connectionId });
    expect(resolved.secret.token).toBe('RESOLVE_ME');
    expect(resolved.fingerprint).toMatch(/^sha256:/);
  });

  it('GET lista só metadados (sem segredo)', async () => {
    const { orgId, actor, connectionId } = await setup('vault3');
    await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', idemKey('cred')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'LIST_SECRET' } });
    const res = await request(app.getHttpServer()).get(base(orgId, connectionId)).set('authorization', actor.auth);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('LIST_SECRET');
    expect(res.body.data[0]).toHaveProperty('fingerprint');
    expect(res.body.data[0]).not.toHaveProperty('encryptedSecret');
  });
});

describe('cofre — rotação e revogação', () => {
  it('rotação: v2 ativa, v1 superseded, ponteiro atualizado', async () => {
    const { orgId, actor, connectionId } = await setup('vault4');
    await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', idemKey('cred')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'V1' } });
    const rot = await request(app.getHttpServer()).post(`${base(orgId, connectionId)}/rotate`).set('authorization', actor.auth).set('idempotency-key', idemKey('rot')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'V2' } });
    expect(rot.status).toBe(201);
    expect(rot.body.data.versionNumber).toBe(2);
    const actives = await prisma.connectionCredentialVersion.count({ where: { connectionId, status: 'ACTIVE' } });
    expect(actives).toBe(1);
    const resolved = await resolver.resolveActiveCredential({ organizationId: orgId, connectionId });
    expect(resolved.secret.token).toBe('V2');
  });

  it('revogação: resolução falha após revogar (crypto-shredding)', async () => {
    const { orgId, actor, connectionId } = await setup('vault5');
    const created = await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', idemKey('cred')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'REVOKE_ME' } });
    const credId = created.body.data.id;
    const rev = await request(app.getHttpServer()).post(`${base(orgId, connectionId)}/${credId}/revoke`).set('authorization', actor.auth).set('idempotency-key', idemKey('rev')).send({});
    expect(rev.status).toBe(200);
    expect(rev.body.data.status).toBe('REVOKED');
    const row = await prisma.connectionCredentialVersion.findFirst({ where: { id: credId } });
    expect(row!.encryptedSecret).toBeNull(); // crypto-shredding
    await expect(resolver.resolveActiveCredential({ organizationId: orgId, connectionId })).rejects.toMatchObject({ code: 'CREDENTIAL_REQUIRED' });
  });
});

describe('cofre — idempotência e auditoria', () => {
  it('mesma Idempotency-Key + body → replay sem nova versão', async () => {
    const { orgId, actor, connectionId } = await setup('vault6');
    const key = idemKey('cred');
    const a = await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', key).send({ secret: { scheme: 'BEARER_TOKEN', token: 'IDEM' } });
    const b = await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', key).send({ secret: { scheme: 'BEARER_TOKEN', token: 'IDEM' } });
    expect(a.body.data.id).toBe(b.body.data.id);
    expect(await prisma.connectionCredentialVersion.count({ where: { connectionId } })).toBe(1);
  });

  it('auditoria e idempotency store não contêm segredo', async () => {
    const { orgId, actor, connectionId } = await setup('vault7');
    await request(app.getHttpServer()).post(base(orgId, connectionId)).set('authorization', actor.auth).set('idempotency-key', idemKey('cred')).send({ secret: { scheme: 'BEARER_TOKEN', token: 'AUDIT_CANARY' } });
    const events = await prisma.auditEvent.findMany({ where: { organizationId: orgId } });
    expect(events.map((e) => e.action)).toEqual(expect.arrayContaining(['credential.version_created', 'credential.activated']));
    expect(JSON.stringify(events)).not.toContain('AUDIT_CANARY');
    const idem = await prisma.idempotencyRecord.findMany();
    expect(JSON.stringify(idem)).not.toContain('AUDIT_CANARY');
  });
});
