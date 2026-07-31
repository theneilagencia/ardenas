/**
 * Arden.AS API — teste CRÍTICO de rollback de publicação (ARDEN-BE-003 §32).
 *
 * Provoca uma falha DEPOIS de alterar a versão (draft→published) mas ANTES de
 * concluir a publicação (ao gravar o evento `operation_version.published`).
 * Comprova que a transação reverte por completo: versão continua rascunho, a
 * operação não aponta para a nova versão, nenhuma auditoria de sucesso é gravada e
 * nenhum registro de idempotência de sucesso permanece.
 */

import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { AuditRecorder } from '../src/audit/audit.recorder';
import { idemKey, seedActor, validDefinition, level3Profile, type Actor } from './operations-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let orgId: string;
let admin: Actor;
let recorder: AuditRecorder;

const base = () => `/api/v1/organizations/${orgId}/operations`;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  recorder = app.get(AuditRecorder, { strict: false });
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
afterEach(() => vi.restoreAllMocks());

async function makePublishableDraft(): Promise<{ opId: string; draftId: string }> {
  const created = await request(server)
    .post(base())
    .set('Authorization', admin.auth)
    .set('Idempotency-Key', idemKey('create'))
    .send({ name: 'Operação Rollback' });
  const opId = created.body.data.id;
  const draftId = created.body.data.currentDraftVersionId;
  await request(server)
    .patch(`${base()}/${opId}/versions/${draftId}`)
    .set('Authorization', admin.auth)
    .send({ definition: validDefinition(), expectedRevision: 1 });
  await request(server)
    .patch(`${base()}/${opId}/versions/${draftId}/authority`)
    .set('Authorization', admin.auth)
    .send({ authorityProfile: level3Profile(), expectedRevision: 2 });
  return { opId, draftId };
}

describe('rollback transacional de publicação', () => {
  it('falha no meio da publicação não deixa estado parcial', async () => {
    const { opId, draftId } = await makePublishableDraft();
    const publishKey = idemKey('publish');

    // Injeta falha ao gravar o evento de publicação (dentro da transação).
    const original = recorder.record.bind(recorder);
    vi.spyOn(recorder, 'record').mockImplementation(async (db, input) => {
      if (input.action === 'operation_version.published') {
        throw new Error('falha injetada durante a publicação');
      }
      return original(db, input);
    });

    const res = await request(server)
      .post(`${base()}/${opId}/versions/${draftId}/publish`)
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', publishKey)
      .send({ expectedRevision: 3, changeSummary: 'Publicação que vai falhar.' });
    expect(res.status).toBe(500);

    // Estado revertido por completo.
    const version = await prisma.operationVersion.findUniqueOrThrow({ where: { id: draftId } });
    expect(version.status).toBe('draft');
    expect(version.revision).toBe(3); // não incrementou (rollback)

    const operation = await prisma.operation.findUniqueOrThrow({ where: { id: opId } });
    expect(operation.publishedVersionId).toBeNull();
    expect(operation.currentDraftVersionId).toBe(draftId);
    expect(operation.status).toBe('draft');

    // Nenhuma auditoria de publicação persistida.
    const publishedAudit = await prisma.auditEvent.count({
      where: { resourceId: draftId, action: { in: ['operation_version.published', 'operation_version.publication_validated'] } },
    });
    expect(publishedAudit).toBe(0);

    // Nenhum registro de idempotência de sucesso para a chave de publicação.
    const idem = await prisma.idempotencyRecord.count({
      where: { idempotencyKey: { contains: publishKey } },
    });
    expect(idem).toBe(0);
  });

  it('após a falha, uma nova publicação (sem falha) conclui normalmente', async () => {
    const { opId, draftId } = await makePublishableDraft();
    const publishKey = idemKey('publish');

    const original = recorder.record.bind(recorder);
    const spy = vi.spyOn(recorder, 'record').mockImplementation(async (db, input) => {
      if (input.action === 'operation_version.published') throw new Error('boom');
      return original(db, input);
    });

    await request(server)
      .post(`${base()}/${opId}/versions/${draftId}/publish`)
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', publishKey)
      .send({ expectedRevision: 3, changeSummary: 'vai falhar' });

    spy.mockRestore();

    const ok = await request(server)
      .post(`${base()}/${opId}/versions/${draftId}/publish`)
      .set('Authorization', admin.auth)
      .set('Idempotency-Key', idemKey('publish-2'))
      .send({ expectedRevision: 3, changeSummary: 'agora publica' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.version.status).toBe('published');
  });
});
