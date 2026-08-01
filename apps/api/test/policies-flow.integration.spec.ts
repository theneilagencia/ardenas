/**
 * Arden.AS API — fluxo de políticas (ARDEN-BE-004).
 * Criar → editar rascunho → publicar → imutabilidade → suspender → vincular.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, type Actor } from './operations-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let orgId: string;
let admin: Actor;

const base = () => `/api/v1/organizations/${orgId}`;

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
  admin = await seedActor('gov-admin', orgId);
});

describe('fluxo de políticas', () => {
  it('cria, edita, publica, bloqueia edição da publicada e suspende', async () => {
    const created = await request(server)
      .post(`${base()}/policies`)
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('pol'))
      .send({ key: 'aprovacao-financeira', name: 'Aprovação financeira', category: 'APPROVAL' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('DRAFT');
    const policyId = created.body.data.id;
    const draftId = created.body.data.currentDraftVersionId;
    expect(draftId).toBeTruthy();

    const patched = await request(server)
      .patch(`${base()}/policies/${policyId}/versions/${draftId}`)
      .set('Authorization', admin.auth)
      .send({ definition: { appliesWhen: [], effect: 'REQUIRE_APPROVAL' }, expectedRevision: 1 });
    expect(patched.status).toBe(200);
    expect(patched.body.data.revision).toBe(2);

    const published = await request(server)
      .post(`${base()}/policies/${policyId}/versions/${draftId}/publish`)
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('pub'))
      .send({ expectedRevision: 2, changeSummary: 'Primeira publicação.' });
    expect(published.status).toBe(200);
    expect(published.body.data.status).toBe('PUBLISHED');

    const policy = await request(server).get(`${base()}/policies/${policyId}`).set('Authorization', admin.auth);
    expect(policy.body.data.status).toBe('PUBLISHED');
    expect(policy.body.data.publishedVersionId).toBe(draftId);

    // Imutabilidade.
    const blocked = await request(server)
      .patch(`${base()}/policies/${policyId}/versions/${draftId}`)
      .set('Authorization', admin.auth)
      .send({ changeSummary: 'x', expectedRevision: 3 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('ALREADY_PUBLISHED');

    // Suspende (política revisão atual).
    const suspend = await request(server)
      .post(`${base()}/policies/${policyId}/suspend`)
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('sus'))
      .send({ expectedRevision: policy.body.data.revision });
    expect(suspend.status).toBe(200);
    expect(suspend.body.data.status).toBe('SUSPENDED');
  });

  it('cria vínculo de política a uma operação', async () => {
    // Política publicada.
    const pol = await request(server).post(`${base()}/policies`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('pol')).send({ key: 'p1', name: 'P1', category: 'AUTHORITY' });
    const policyId = pol.body.data.id;
    const versionId = pol.body.data.currentDraftVersionId;
    await request(server).patch(`${base()}/policies/${policyId}/versions/${versionId}`).set('Authorization', admin.auth).send({ definition: { appliesWhen: [], effect: 'ALLOW' }, expectedRevision: 1 });
    await request(server).post(`${base()}/policies/${policyId}/versions/${versionId}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: 2, changeSummary: 'pub' });

    // Operação.
    const op = await request(server).post(`${base()}/operations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('op')).send({ name: 'Op com política' });
    const operationId = op.body.data.id;

    const binding = await request(server)
      .post(`${base()}/operations/${operationId}/policy-bindings`)
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('bind'))
      .send({ policyId, policyVersionId: versionId, scope: 'OPERATION', priority: 10 });
    expect(binding.status).toBe(201);
    expect(binding.body.data.policyId).toBe(policyId);

    const list = await request(server).get(`${base()}/operations/${operationId}/policy-bindings`).set('Authorization', admin.auth);
    expect(list.body.data.length).toBe(1);
  });
});
