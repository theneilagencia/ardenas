/**
 * Arden.AS API — ciclo de vida de operações (ARDEN-BE-003).
 * pause/resume/archive/duplicate, nova versão (rascunho único), comparação,
 * listagem de versões e negação por permissão.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, level3Profile, type Actor } from './operations-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let orgId: string;
let admin: Actor;

const base = () => `/api/v1/organizations/${orgId}/operations`;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetIdentity();
  orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
  admin = await seedActor('op-admin', orgId);
});

/** Cria e publica uma operação; devolve ids e a operação publicada. */
async function publishedOperation(): Promise<{ opId: string; v1: string }> {
  const created = await request(server).post(base()).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('c')).send({ name: 'Op Ciclo' });
  const opId = created.body.data.id;
  const v1 = created.body.data.currentDraftVersionId;
  await request(server).patch(`${base()}/${opId}/versions/${v1}`).set('Authorization', admin.auth).send({ definition: validDefinition(), expectedRevision: 1 });
  await request(server).patch(`${base()}/${opId}/versions/${v1}/authority`).set('Authorization', admin.auth).send({ authorityProfile: level3Profile(), expectedRevision: 2 });
  await request(server).post(`${base()}/${opId}/versions/${v1}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('p')).send({ expectedRevision: 3, changeSummary: 'pub' });
  return { opId, v1 };
}

describe('ciclo de vida', () => {
  it('pausa e retoma uma operação ativa', async () => {
    const { opId } = await publishedOperation();
    let op = (await request(server).get(`${base()}/${opId}`).set('Authorization', admin.auth)).body.data;
    expect(op.status).toBe('active');

    const paused = await request(server).post(`${base()}/${opId}/pause`).set('Authorization', admin.auth).send({ expectedRevision: op.revision });
    expect(paused.status).toBe(200);
    expect(paused.body.data.status).toBe('paused');

    op = paused.body.data;
    const resumed = await request(server).post(`${base()}/${opId}/resume`).set('Authorization', admin.auth).send({ expectedRevision: op.revision });
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.status).toBe('active');
  });

  it('pausar operação em rascunho é transição inválida (409)', async () => {
    const created = await request(server).post(base()).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('c')).send({ name: 'Rascunho' });
    const res = await request(server).post(`${base()}/${created.body.data.id}/pause`).set('Authorization', admin.auth).send({ expectedRevision: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('arquiva sem apagar fisicamente e é idempotente', async () => {
    const created = await request(server).post(base()).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('c')).send({ name: 'Arquivar' });
    const opId = created.body.data.id;
    const archived = await request(server).post(`${base()}/${opId}/archive`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('a')).send({ expectedRevision: 1 });
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe('archived');
    // Ainda existe (não apagada) e a versão foi preservada.
    expect(await prisma.operation.count({ where: { id: opId } })).toBe(1);
    expect(await prisma.operationVersion.count({ where: { operationId: opId } })).toBe(1);
    // Edição normal bloqueada após arquivar.
    const edit = await request(server).patch(`${base()}/${opId}`).set('Authorization', admin.auth).send({ name: 'x', expectedRevision: 2 });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('duplica dentro do tenant com novos ids, rascunho e sem publicar', async () => {
    const { opId } = await publishedOperation();
    const dup = await request(server).post(`${base()}/${opId}/duplicate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('d')).send({ name: 'Cópia' });
    expect(dup.status).toBe(201);
    expect(dup.body.data.id).not.toBe(opId);
    expect(dup.body.data.status).toBe('draft');
    expect(dup.body.data.publishedVersionId).toBeNull();
    expect(dup.body.data.name).toBe('Cópia');
  });

  it('cria nova versão após publicar e recusa segundo rascunho', async () => {
    const { opId } = await publishedOperation();
    const v2 = await request(server).post(`${base()}/${opId}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v')).send({ changeSummary: 'v2' });
    expect(v2.status).toBe(201);
    expect(v2.body.data.versionNumber).toBe(2);
    expect(v2.body.data.status).toBe('draft');

    const conflict = await request(server).post(`${base()}/${opId}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v2')).send({ changeSummary: 'v3' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('RESOURCE_CONFLICT');
  });

  it('compara duas versões da mesma operação', async () => {
    const { opId, v1 } = await publishedOperation();
    const v2res = await request(server).post(`${base()}/${opId}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v')).send({});
    const v2 = v2res.body.data.id;
    await request(server).patch(`${base()}/${opId}/versions/${v2}`).set('Authorization', admin.auth).send({ definition: validDefinition({ objective: 'novo objetivo' }), expectedRevision: 1 });

    const cmp = await request(server).get(`${base()}/${opId}/versions/${v1}/compare/${v2}`).set('Authorization', admin.auth);
    expect(cmp.status).toBe(200);
    expect(cmp.body.data.base.versionId).toBe(v1);
    expect(cmp.body.data.other.versionId).toBe(v2);
    const paths = cmp.body.data.differences.map((d: { path: string }) => d.path);
    expect(paths).toContain('definition.objective');
  });

  it('lista versões da operação', async () => {
    const { opId } = await publishedOperation();
    await request(server).post(`${base()}/${opId}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v')).send({});
    const list = await request(server).get(`${base()}/${opId}/versions`).set('Authorization', admin.auth);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(2);
    expect(list.body.pagination.hasNextPage).toBe(false);
  });

  it('usuário com operation.view mas sem operation.create recebe 403 ao criar', async () => {
    const viewer = await seedActor('viewer', orgId, ['analyst']);
    const created = await request(server).post(base()).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('c')).send({ name: 'Visível' });
    // Consegue ler.
    const read = await request(server).get(`${base()}/${created.body.data.id}`).set('Authorization', viewer.auth);
    expect(read.status).toBe(200);
    // Não consegue criar.
    const denied = await request(server).post(base()).set('Authorization', viewer.auth).set('Idempotency-Key', idemKey('c2')).send({ name: 'Bloqueado' });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
  });
});
