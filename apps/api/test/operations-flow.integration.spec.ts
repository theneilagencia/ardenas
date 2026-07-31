/**
 * Arden.AS API — fluxo principal de operações (ARDEN-BE-003).
 * App real + Postgres + provider fake. Cobre criar → editar rascunho → definir
 * Gradiente → publicar → imutabilidade → auditoria, tudo pelo backend.
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

describe('fluxo principal de operações', () => {
  it('cria operação com primeira versão em rascunho', async () => {
    const res = await request(server)
      .post(base())
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('create'))
      .send({ name: 'Operação Incidentes' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.currentDraftVersionId).toBeTruthy();
    expect(res.body.data.revision).toBe(1);

    const draftId = res.body.data.currentDraftVersionId;
    const version = await request(server)
      .get(`${base()}/${res.body.data.id}/versions/${draftId}`)
      .set('Authorization', admin.auth);
    expect(version.status).toBe(200);
    expect(version.body.data.versionNumber).toBe(1);
    expect(version.body.data.status).toBe('draft');
  });

  it('edita rascunho, define Gradiente e publica de forma transacional', async () => {
    const created = await request(server)
      .post(base())
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('create'))
      .send({ name: 'Operação Publicável' });
    const opId = created.body.data.id;
    const draftId = created.body.data.currentDraftVersionId;

    // Edita a definição (revisão 1 → 2).
    const patched = await request(server)
      .patch(`${base()}/${opId}/versions/${draftId}`)
      .set('Authorization', admin.auth)
      .send({ definition: validDefinition(), expectedRevision: 1 });
    expect(patched.status).toBe(200);
    expect(patched.body.data.revision).toBe(2);

    // Define o Gradiente de Autoridade (revisão 2 → 3).
    const authority = await request(server)
      .patch(`${base()}/${opId}/versions/${draftId}/authority`)
      .set('Authorization', admin.auth)
      .send({ authorityProfile: level3Profile(), expectedRevision: 2 });
    expect(authority.status).toBe(200);
    expect(authority.body.data.revision).toBe(3);

    // Publica (revisão 3).
    const published = await request(server)
      .post(`${base()}/${opId}/versions/${draftId}/publish`)
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('publish'))
      .send({ expectedRevision: 3, changeSummary: 'Primeira publicação.' });
    expect(published.status).toBe(200);
    expect(published.body.data.version.status).toBe('published');
    expect(published.body.data.operation.status).toBe('active');
    expect(published.body.data.operation.publishedVersionId).toBe(draftId);
    expect(published.body.data.operation.currentDraftVersionId).toBeNull();
    expect(published.body.data.auditEvents.length).toBeGreaterThanOrEqual(2);

    // Recarrega pelo backend: persistido.
    const reloaded = await request(server).get(`${base()}/${opId}`).set('Authorization', admin.auth);
    expect(reloaded.body.data.status).toBe('active');
    expect(reloaded.body.data.publishedVersionId).toBe(draftId);

    // Imutabilidade: PATCH da versão publicada → 409 ALREADY_PUBLISHED.
    const blocked = await request(server)
      .patch(`${base()}/${opId}/versions/${draftId}`)
      .set('Authorization', admin.auth)
      .send({ changeSummary: 'tentativa', expectedRevision: 4 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('ALREADY_PUBLISHED');

    // Auditoria: evento de publicação presente.
    const audit = await request(server)
      .get(`/api/v1/organizations/${orgId}/audit-events?resourceType=operation_version`)
      .set('Authorization', admin.auth);
    expect(audit.status).toBe(200);
    const actions = audit.body.data.map((e: { action: string }) => e.action);
    expect(actions).toContain('operation_version.published');
  });

  it('publicação inválida (sem objetivo) é bloqueada com 422', async () => {
    const created = await request(server)
      .post(base())
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('create'))
      .send({ name: 'Operação Incompleta' });
    const opId = created.body.data.id;
    const draftId = created.body.data.currentDraftVersionId;

    const res = await request(server)
      .post(`${base()}/${opId}/versions/${draftId}/publish`)
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('publish'))
      .send({ expectedRevision: 1, changeSummary: 'tentativa' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    // Nada publicado.
    const reloaded = await request(server).get(`${base()}/${opId}`).set('Authorization', admin.auth);
    expect(reloaded.body.data.publishedVersionId).toBeNull();
  });
});
