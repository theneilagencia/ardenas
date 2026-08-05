/**
 * Arden.AS API — concorrência otimista e idempotência de operações (ARDEN-BE-003).
 * §22 (idempotência) e §23 (concorrência).
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, validDefinition, type Actor } from './operations-helpers';

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

async function createOp(name = 'Op'): Promise<{ opId: string; draftId: string }> {
  const res = await request(server)
    .post(base())
    .set('Authorization', admin.auth)
    .set('Idempotency-Key', idemKey('create'))
    .send({ name });
  return { opId: res.body.data.id, draftId: res.body.data.currentDraftVersionId };
}

describe('concorrência otimista', () => {
  it('edição do rascunho com revisão desatualizada retorna 409 VERSION_CONFLICT', async () => {
    const { opId, draftId } = await createOp();
    // Primeira edição (revisão 1 → 2) vence.
    const first = await request(server)
      .patch(`${base()}/${opId}/versions/${draftId}`)
      .set('Authorization', admin.auth)
      .send({ definition: validDefinition({ objective: 'A' }), expectedRevision: 1 });
    expect(first.status).toBe(200);
    expect(first.body.data.revision).toBe(2);

    // Segunda edição com a MESMA revisão esperada (1) → conflito.
    const second = await request(server)
      .patch(`${base()}/${opId}/versions/${draftId}`)
      .set('Authorization', admin.auth)
      .send({ definition: validDefinition({ objective: 'B' }), expectedRevision: 1 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('VERSION_CONFLICT');
    expect(second.body.error.details).toMatchObject({ resourceType: 'operation_version', currentRevision: 2 });

    // A alteração da primeira não foi perdida.
    const reloaded = await request(server)
      .get(`${base()}/${opId}/versions/${draftId}`)
      .set('Authorization', admin.auth);
    expect(reloaded.body.data.definition.objective).toBe('A');
  });

  it('edição de metadados da operação com revisão errada retorna 409', async () => {
    const { opId } = await createOp();
    const res = await request(server)
      .patch(`${base()}/${opId}`)
      .set('Authorization', admin.auth)
      .send({ name: 'Novo nome', expectedRevision: 99 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERSION_CONFLICT');
  });
});

describe('idempotência', () => {
  it('mesma chave + mesmo body devolve a mesma resposta sem duplicar', async () => {
    const key = idemKey('same');
    const body = { name: 'Idempotente' };
    const first = await request(server).post(base()).set('Authorization', admin.auth).set('Idempotency-Key', key).send(body);
    const second = await request(server).post(base()).set('Authorization', admin.auth).set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    // Nenhuma operação duplicada.
    expect(await prisma.operation.count()).toBe(1);
  });

  it('mesma chave + body diferente retorna 409 IDEMPOTENCY_CONFLICT', async () => {
    const key = idemKey('conflict');
    await request(server).post(base()).set('Authorization', admin.auth).set('Idempotency-Key', key).send({ name: 'A' });
    const res = await request(server).post(base()).set('Authorization', admin.auth).set('Idempotency-Key', key).send({ name: 'B' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('comando sem Idempotency-Key é rejeitado (422)', async () => {
    const res = await request(server).post(base()).set('Authorization', admin.auth).send({ name: 'Sem chave' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('publicação idempotente não duplica efeitos', async () => {
    const { opId, draftId } = await createOp('Publicar');
    await request(server)
      .patch(`${base()}/${opId}/versions/${draftId}`)
      .set('Authorization', admin.auth)
      .send({ definition: validDefinition(), expectedRevision: 1 });
    const key = idemKey('publish');
    const body = { expectedRevision: 2, changeSummary: 'Publicação idempotente.' };
    const first = await request(server).post(`${base()}/${opId}/versions/${draftId}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', key).send(body);
    const second = await request(server).post(`${base()}/${opId}/versions/${draftId}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.version.id).toBe(first.body.data.version.id);
    // Exatamente um evento de publicação (não duplicado).
    const published = await prisma.auditEvent.count({ where: { action: 'operation_version.published', resourceId: draftId } });
    expect(published).toBe(1);
  });
});
