/**
 * Arden.AS API — teste CRÍTICO de isolamento multitenant de operações
 * (ARDEN-BE-003 §33).
 *
 * Alpha/Beta; A→Alpha, B→Beta, C→ambas (admin em Alpha, auditor em Beta).
 * Comprova: recurso de outro tenant não concede acesso mesmo com id conhecido
 * (404 pela própria rota do tenant), auditoria não vaza, comparação não atravessa
 * tenants, e a chave de idempotência de Alpha não colide com a de Beta.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg, seedUser, seedMembership, bearer } from './identity-helpers';
import { idemKey, seedActor, type Actor } from './operations-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let alpha: string;
let beta: string;
let userA: Actor;
let userB: Actor;
let cAuth: string;

const ops = (org: string) => `/api/v1/organizations/${org}/operations`;

async function createOperation(org: string, auth: string, name: string): Promise<string> {
  const res = await request(server)
    .post(ops(org))
    .set('Authorization', auth)
    .set('Idempotency-Key', idemKey('create'))
    .send({ name });
  return res.body.data.id;
}

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
  alpha = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
  beta = (await seedOrg({ name: 'Beta', slug: 'beta' })).id;
  userA = await seedActor('user-a', alpha);
  userB = await seedActor('user-b', beta);
  // C: admin em Alpha, auditor (somente leitura) em Beta.
  const c = await seedUser({ subject: 'user-c' });
  await seedMembership({ userId: c.id, organizationId: alpha, roleKeys: ['corporate_admin'] });
  await seedMembership({ userId: c.id, organizationId: beta, roleKeys: ['auditor'] });
  cAuth = bearer('user-c');
});

describe('isolamento multitenant de operações', () => {
  it('operationId de outro tenant não concede acesso pela própria rota (404)', async () => {
    const opBeta = await createOperation(beta, userB.auth, 'Op Beta');
    // A tenta acessar a operação de Beta pela rota de Alpha (seu tenant).
    const res = await request(server).get(`${ops(alpha)}/${opBeta}`).set('Authorization', userA.auth);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('A não acessa a organização de Beta (sem membership → 404)', async () => {
    const opBeta = await createOperation(beta, userB.auth, 'Op Beta');
    const res = await request(server).get(`${ops(beta)}/${opBeta}`).set('Authorization', userA.auth);
    expect(res.status).toBe(404);
  });

  it('versionId de outro tenant não concede acesso pela própria rota', async () => {
    const opBeta = await createOperation(beta, userB.auth, 'Op Beta');
    const betaOp = await request(server).get(`${ops(beta)}/${opBeta}`).set('Authorization', userB.auth);
    const versionId = betaOp.body.data.currentDraftVersionId;
    // A cria a sua própria operação em Alpha e tenta ler a versão de Beta por ela.
    const opAlpha = await createOperation(alpha, userA.auth, 'Op Alpha');
    const res = await request(server)
      .get(`${ops(alpha)}/${opAlpha}/versions/${versionId}`)
      .set('Authorization', userA.auth);
    expect(res.status).toBe(404);
  });

  it('a listagem só devolve operações do próprio tenant', async () => {
    await createOperation(alpha, userA.auth, 'Só Alpha');
    await createOperation(beta, userB.auth, 'Só Beta');
    const a = await request(server).get(ops(alpha)).set('Authorization', userA.auth);
    const names = a.body.data.map((o: { name: string }) => o.name);
    expect(names).toContain('Só Alpha');
    expect(names).not.toContain('Só Beta');
  });

  it('a auditoria de um tenant não vaza para o outro', async () => {
    await createOperation(alpha, userA.auth, 'Op Alpha');
    await createOperation(beta, userB.auth, 'Op Beta');
    const auditA = await request(server)
      .get(`/api/v1/organizations/${alpha}/audit-events`)
      .set('Authorization', userA.auth);
    const orgs = new Set(auditA.body.data.map((e: { organizationId: string }) => e.organizationId));
    expect([...orgs]).toEqual([alpha]);
  });

  it('comparação não atravessa tenants', async () => {
    const opAlpha = await createOperation(alpha, userA.auth, 'Op Alpha');
    const alphaOp = await request(server).get(`${ops(alpha)}/${opAlpha}`).set('Authorization', userA.auth);
    const vAlpha = alphaOp.body.data.currentDraftVersionId;

    const opBeta = await createOperation(beta, userB.auth, 'Op Beta');
    const betaOp = await request(server).get(`${ops(beta)}/${opBeta}`).set('Authorization', userB.auth);
    const vBeta = betaOp.body.data.currentDraftVersionId;

    // A tenta comparar a sua versão com uma versão de Beta → 404 (não pertence).
    const res = await request(server)
      .get(`${ops(alpha)}/${opAlpha}/versions/${vAlpha}/compare/${vBeta}`)
      .set('Authorization', userA.auth);
    expect(res.status).toBe(404);
  });

  it('idempotency key de Alpha não colide com Beta', async () => {
    const sharedKey = 'shared-key-1234';
    const inAlpha = await request(server)
      .post(ops(alpha))
      .set('Authorization', userA.auth)
      .set('Idempotency-Key', sharedKey)
      .send({ name: 'Alpha op' });
    const inBeta = await request(server)
      .post(ops(beta))
      .set('Authorization', userB.auth)
      .set('Idempotency-Key', sharedKey)
      .send({ name: 'Beta op' });
    expect(inAlpha.status).toBe(201);
    expect(inBeta.status).toBe(201);
    expect(inAlpha.body.data.id).not.toBe(inBeta.body.data.id);
    expect(inAlpha.body.data.organizationId).toBe(alpha);
    expect(inBeta.body.data.organizationId).toBe(beta);
  });

  it('C tem escopo diferente por organização (admin em Alpha, auditor em Beta)', async () => {
    // Cria em Alpha (admin) → ok.
    const okAlpha = await request(server)
      .post(ops(alpha))
      .set('Authorization', cAuth)
      .set('Idempotency-Key', idemKey('c-alpha'))
      .send({ name: 'C cria em Alpha' });
    expect(okAlpha.status).toBe(201);
    // Cria em Beta (auditor, sem operation.create) → 403.
    const deniedBeta = await request(server)
      .post(ops(beta))
      .set('Authorization', cAuth)
      .set('Idempotency-Key', idemKey('c-beta'))
      .send({ name: 'C tenta em Beta' });
    expect(deniedBeta.status).toBe(403);
    expect(deniedBeta.body.error.code).toBe('FORBIDDEN');
  });
});
