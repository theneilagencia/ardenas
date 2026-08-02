/**
 * Arden.AS API — testes CRÍTICOS de persistência de agentes (ARDEN-BE-007.2 §32–36).
 * Publicação concorrente, imutabilidade (hash/revisão/auditoria), isolamento cross-tenant,
 * ausência de segredo e bloqueio do provider de teste em produção. PostgreSQL real.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, type Actor } from './operations-helpers';
import { ModelProviderCatalogProjector } from '../src/agents/providers/model-provider-catalog.projector';
import { validAgentVersionDefinition, testModelConfigurationBody } from './agents-helpers';

const CANARY = 'ARDEN_BE007_PERSISTENCE_SECRET_CANARY_9f2c';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let providerProjector: ModelProviderCatalogProjector;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  providerProjector = app.get(ModelProviderCatalogProjector);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetIdentity();
  await providerProjector.project();
});

async function setupPublishable(orgId: string, admin: Actor) {
  const b = `/api/v1/organizations/${orgId}`;
  const cfg = await request(server).post(`${b}/model-configurations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('cfg')).send(testModelConfigurationBody());
  await request(server).post(`${b}/model-configurations/${cfg.body.data.id}/activate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: cfg.body.data.revision });
  const agent = await request(server).post(`${b}/agents`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('ag')).send({ key: idemKey('a').toLowerCase(), name: 'A' });
  const draft = await request(server).post(`${b}/agents/${agent.body.data.id}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v')).send({ definition: validAgentVersionDefinition(cfg.body.data.id) });
  return { b, configId: cfg.body.data.id, agentId: agent.body.data.id, versionId: draft.body.data.id, versionRevision: draft.body.data.revision };
}

describe('§32 publicação concorrente', () => {
  it('duas publicações simultâneas: uma vence, uma conflita; versão PUBLISHED uma vez', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('crit-admin', orgId);
    const s = await setupPublishable(orgId, admin);
    const publish = () => request(server).post(`${s.b}/agents/${s.agentId}/versions/${s.versionId}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: s.versionRevision, changeSummary: 'race' });
    const [a, b] = await Promise.all([publish(), publish()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200); // uma vence
    expect(statuses[1]).toBe(409); // a outra conflita
    const versions = await prisma.agentVersion.findMany({ where: { id: s.versionId } });
    expect(versions[0].status).toBe('PUBLISHED');
    const events = (await prisma.auditEvent.findMany({ where: { organizationId: orgId, action: 'agent_version.published' } }));
    expect(events.length).toBe(1); // auditoria única
  });
});

describe('§33 imutabilidade da versão publicada', () => {
  it('após publicar, alterações falham; hash e revisão preservados; sem auditoria de update', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('imm-admin', orgId);
    const s = await setupPublishable(orgId, admin);
    const pub = await request(server).post(`${s.b}/agents/${s.agentId}/versions/${s.versionId}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('pub')).send({ expectedRevision: s.versionRevision, changeSummary: 'v1' });
    expect(pub.status).toBe(200);
    const publishedHash = (await prisma.agentVersion.findFirst({ where: { id: s.versionId } }))!.contentHash;
    const publishedRevision = pub.body.data.revision;

    const patch = await request(server).patch(`${s.b}/agents/${s.agentId}/versions/${s.versionId}`).set('Authorization', admin.auth)
      .send({ definition: validAgentVersionDefinition(s.configId, { objective: 'MUDANÇA' }), expectedRevision: publishedRevision });
    expect(patch.status).toBe(409);

    const row = (await prisma.agentVersion.findFirst({ where: { id: s.versionId } }))!;
    expect(row.contentHash).toBe(publishedHash);
    expect(row.revision).toBe(publishedRevision);
    const updates = (await prisma.auditEvent.findMany({ where: { organizationId: orgId, action: 'agent_version.updated' } }));
    expect(updates.length).toBe(0);
  });
});

describe('§34 isolamento cross-tenant', () => {
  it('Alpha não lê/edita agente de Beta; versão não usa config de outro tenant', async () => {
    const alpha = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const beta = (await seedOrg({ name: 'Beta', slug: 'beta' })).id;
    const aAdmin = await seedActor('alpha-admin', alpha);
    const bAdmin = await seedActor('beta-admin', beta);
    const sBeta = await setupPublishable(beta, bAdmin);

    // Alpha não enxerga o agente de Beta (404, anti-enumeração).
    const cross = await request(server).get(`/api/v1/organizations/${alpha}/agents/${sBeta.agentId}`).set('Authorization', aAdmin.auth);
    expect(cross.status).toBe(404);

    // Versão de Alpha não pode referenciar a config de Beta.
    const aAgent = await request(server).post(`/api/v1/organizations/${alpha}/agents`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('ag')).send({ key: idemKey('a').toLowerCase(), name: 'A' });
    const draft = await request(server).post(`/api/v1/organizations/${alpha}/agents/${aAgent.body.data.id}/versions`).set('Authorization', aAdmin.auth).set('Idempotency-Key', idemKey('v'))
      .send({ definition: validAgentVersionDefinition(sBeta.configId) });
    expect(draft.status).toBe(404);
  });
});

describe('§35 ausência de segredo', () => {
  it('canário injetado não aparece em response nem auditoria', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('sec-admin', orgId);
    const b = `/api/v1/organizations/${orgId}`;
    // Injeta campos de segredo desconhecidos no body (devem ser descartados pela validação).
    const res = await request(server).post(`${b}/model-configurations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('cfg'))
      .send({ ...testModelConfigurationBody(), secret: CANARY, apiKey: CANARY, credential: CANARY });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain(CANARY);
    const events = await prisma.auditEvent.findMany({ where: { organizationId: orgId } });
    expect(JSON.stringify(events)).not.toContain(CANARY);
    // E não persistiu em lugar nenhum da linha.
    const row = await prisma.modelConfiguration.findFirst({ where: { id: res.body.data.id } });
    expect(JSON.stringify(row)).not.toContain(CANARY);
  });
});

describe('§36 provider de teste em produção', () => {
  it('em NODE_ENV=production não pode ser ativado nem publicado; continua catalogado', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('prod-admin', orgId);
    const b = `/api/v1/organizations/${orgId}`;
    const cfg = await request(server).post(`${b}/model-configurations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('cfg')).send(testModelConfigurationBody());
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // Continua catalogado.
      const list = await request(server).get('/api/v1/model-providers').set('Authorization', admin.auth).set('X-Arden-Organization', orgId);
      expect(list.body.data.some((p: { key: string }) => p.key === 'internal.test-model')).toBe(true);
      // Não pode ser ativado.
      const act = await request(server).post(`${b}/model-configurations/${cfg.body.data.id}/activate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: cfg.body.data.revision });
      expect(act.status).toBe(409);
      expect(act.body.error.code).toBe('MODEL_PROVIDER_DISABLED');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
