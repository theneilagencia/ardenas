/**
 * Arden.AS API — integração de persistência do runtime de agentes (ARDEN-BE-007.2).
 *
 * Exercita via HTTP (PostgreSQL real): projeção de providers, CRUD e lifecycle de
 * configurações de modelo, agentes e versões, publicação imutável, retirada,
 * revisão, idempotência, paginação/filtros e auditoria. Nenhuma resposta expõe segredo.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, type Actor } from './operations-helpers';
import { ModelProviderCatalogProjector } from '../src/agents/providers/model-provider-catalog.projector';
import { validAgentVersionDefinition, testModelConfigurationBody } from './agents-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let providerProjector: ModelProviderCatalogProjector;
let orgId: string;
let admin: Actor;

const base = () => `/api/v1/organizations/${orgId}`;

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
  orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
  admin = await seedActor('agent-admin', orgId);
});

async function createActiveConfig(): Promise<string> {
  const created = await request(server).post(`${base()}/model-configurations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('cfg')).send(testModelConfigurationBody());
  expect(created.status).toBe(201);
  const id = created.body.data.id;
  const activated = await request(server).post(`${base()}/model-configurations/${id}/activate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: created.body.data.revision });
  expect(activated.status).toBe(200);
  expect(activated.body.data.status).toBe('ACTIVE');
  return id;
}

async function createAgent(): Promise<{ id: string; revision: number }> {
  const res = await request(server).post(`${base()}/agents`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('ag')).send({ key: idemKey('classifier').toLowerCase(), name: 'Classifier' });
  expect(res.status).toBe(201);
  return { id: res.body.data.id, revision: res.body.data.revision };
}

describe('catálogo de providers', () => {
  it('lista o provider de teste (productionAllowed=false) após projeção', async () => {
    const res = await request(server).get('/api/v1/model-providers').set('Authorization', admin.auth).set('X-Arden-Organization', orgId);
    expect(res.status).toBe(200);
    const test = res.body.data.find((p: { key: string }) => p.key === 'internal.test-model');
    expect(test).toBeTruthy();
    expect(test.productionAllowed).toBe(false);
  });

  it('a projeção é idempotente (segunda chamada não duplica)', async () => {
    await providerProjector.project();
    const count = await prisma.modelProviderDefinition.count({ where: { key: 'internal.test-model' } });
    expect(count).toBe(1);
  });
});

describe('configurações de modelo — CRUD e lifecycle', () => {
  it('cria (DRAFT), ativa, suspende, reativa e revoga (terminal)', async () => {
    const created = await request(server).post(`${base()}/model-configurations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('cfg')).send(testModelConfigurationBody());
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('DRAFT');
    expect(JSON.stringify(created.body.data)).not.toContain('secret');
    const id = created.body.data.id;

    let rev = created.body.data.revision;
    const act = await request(server).post(`${base()}/model-configurations/${id}/activate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('a')).send({ expectedRevision: rev });
    expect(act.body.data.status).toBe('ACTIVE');
    rev = act.body.data.revision;
    const susp = await request(server).post(`${base()}/model-configurations/${id}/suspend`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('s')).send({ expectedRevision: rev });
    expect(susp.body.data.status).toBe('SUSPENDED');
    rev = susp.body.data.revision;
    const react = await request(server).post(`${base()}/model-configurations/${id}/activate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('r')).send({ expectedRevision: rev });
    expect(react.body.data.status).toBe('ACTIVE');
    rev = react.body.data.revision;
    const rev2 = await request(server).post(`${base()}/model-configurations/${id}/revoke`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v')).send({ expectedRevision: rev });
    expect(rev2.body.data.status).toBe('REVOKED');
    // Revogada é terminal: reativar falha.
    const again = await request(server).post(`${base()}/model-configurations/${id}/activate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('x')).send({ expectedRevision: rev2.body.data.revision });
    expect(again.status).toBe(409);
  });

  it('rejeita provider inexistente na criação', async () => {
    const res = await request(server).post(`${base()}/model-configurations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('bad')).send(testModelConfigurationBody({ providerKey: 'does.not-exist' }));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MODEL_PROVIDER_NOT_AVAILABLE');
  });
});

describe('agentes e versões — lifecycle e publicação imutável', () => {
  it('cria agente, versão draft, atualiza, publica e torna imutável', async () => {
    const configId = await createActiveConfig();
    const agent = await createAgent();

    const draft = await request(server).post(`${base()}/agents/${agent.id}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v')).send({ definition: validAgentVersionDefinition(configId) });
    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe('DRAFT');
    expect(draft.body.data.versionNumber).toBe(1);
    const versionId = draft.body.data.id;

    // Atualiza rascunho com revisão.
    const upd = await request(server).patch(`${base()}/agents/${agent.id}/versions/${versionId}`).set('Authorization', admin.auth)
      .send({ definition: validAgentVersionDefinition(configId, { objective: 'Classificar e priorizar o lead.' }), expectedRevision: draft.body.data.revision });
    expect(upd.status).toBe(200);

    // Publica.
    const pub = await request(server).post(`${base()}/agents/${agent.id}/versions/${versionId}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('pub'))
      .send({ expectedRevision: upd.body.data.revision, changeSummary: 'Primeira publicação.' });
    expect(pub.status).toBe(200);
    expect(pub.body.data.status).toBe('PUBLISHED');
    expect(pub.body.data.publishedAt).toBeTruthy();

    // Agente aponta para a versão e ficou ACTIVE.
    const gotAgent = await request(server).get(`${base()}/agents/${agent.id}`).set('Authorization', admin.auth);
    expect(gotAgent.body.data.currentPublishedVersionId).toBe(versionId);
    expect(gotAgent.body.data.status).toBe('ACTIVE');

    // Publicada é imutável: PATCH falha.
    const patchPublished = await request(server).patch(`${base()}/agents/${agent.id}/versions/${versionId}`).set('Authorization', admin.auth)
      .send({ definition: validAgentVersionDefinition(configId, { objective: 'x' }), expectedRevision: pub.body.data.revision });
    expect(patchPublished.status).toBe(409);

    // Nova versão a partir da publicada → versionNumber 2, DRAFT.
    const draft2 = await request(server).post(`${base()}/agents/${agent.id}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v2')).send({ basedOnVersionId: versionId });
    expect(draft2.status).toBe(201);
    expect(draft2.body.data.versionNumber).toBe(2);
    expect(draft2.body.data.status).toBe('DRAFT');

    // Retira a versão publicada → RETIRED, ponteiro limpo (não seleciona antiga).
    const retire = await request(server).post(`${base()}/agents/${agent.id}/versions/${versionId}/retire`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('ret'))
      .send({ expectedRevision: pub.body.data.revision });
    expect(retire.status).toBe(200);
    expect(retire.body.data.status).toBe('RETIRED');
    const afterRetire = await request(server).get(`${base()}/agents/${agent.id}`).set('Authorization', admin.auth);
    expect(afterRetire.body.data.currentPublishedVersionId).toBeNull();

    // Auditoria registrada (trilha de negócio).
    const events = await prisma.auditEvent.findMany({ where: { organizationId: orgId }, select: { action: true } });
    const actions = events.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['agent.created', 'agent_version.created', 'agent_version.published', 'agent_version.retired']));
  });

  it('publicar com model configuration inativa falha', async () => {
    // Config criada mas NÃO ativada (DRAFT).
    const created = await request(server).post(`${base()}/model-configurations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('cfg')).send(testModelConfigurationBody());
    const configId = created.body.data.id;
    const agent = await createAgent();
    const draft = await request(server).post(`${base()}/agents/${agent.id}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v')).send({ definition: validAgentVersionDefinition(configId) });
    const pub = await request(server).post(`${base()}/agents/${agent.id}/versions/${draft.body.data.id}/publish`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('pub'))
      .send({ expectedRevision: draft.body.data.revision, changeSummary: 'x' });
    expect(pub.status).toBe(409);
    expect(pub.body.error.code).toBe('MODEL_CONFIGURATION_NOT_ACTIVE');
  });

  it('conflito de revisão ao atualizar rascunho retorna VERSION_CONFLICT', async () => {
    const configId = await createActiveConfig();
    const agent = await createAgent();
    const draft = await request(server).post(`${base()}/agents/${agent.id}/versions`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('v')).send({ definition: validAgentVersionDefinition(configId) });
    const bad = await request(server).patch(`${base()}/agents/${agent.id}/versions/${draft.body.data.id}`).set('Authorization', admin.auth)
      .send({ definition: validAgentVersionDefinition(configId), expectedRevision: 999 });
    expect(bad.status).toBe(409);
    expect(bad.body.error.code).toBe('VERSION_CONFLICT');
  });

  it('agente revogado é terminal (update falha)', async () => {
    const agent = await createAgent();
    const rev = await request(server).post(`${base()}/agents/${agent.id}/revoke`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('rv')).send({ expectedRevision: agent.revision });
    expect(rev.body.data.status).toBe('REVOKED');
    const upd = await request(server).patch(`${base()}/agents/${agent.id}`).set('Authorization', admin.auth).send({ name: 'x', expectedRevision: rev.body.data.revision });
    expect(upd.status).toBe(409);
    expect(upd.body.error.code).toBe('AGENT_REVOKED');
  });
});

describe('idempotência, paginação e filtros', () => {
  it('mesma Idempotency-Key + mesmo body → mesmo agente; body diferente → conflito', async () => {
    const key = idemKey('idem');
    const body = { key: 'idem-agent', name: 'A' };
    const first = await request(server).post(`${base()}/agents`).set('Authorization', admin.auth).set('Idempotency-Key', key).send(body);
    const replay = await request(server).post(`${base()}/agents`).set('Authorization', admin.auth).set('Idempotency-Key', key).send(body);
    expect(first.status).toBe(201);
    expect(replay.body.data.id).toBe(first.body.data.id);
    const conflict = await request(server).post(`${base()}/agents`).set('Authorization', admin.auth).set('Idempotency-Key', key).send({ key: 'idem-agent', name: 'DIFF' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('lista com filtro de status e paginação', async () => {
    await createAgent();
    await createAgent();
    const list = await request(server).get(`${base()}/agents?limit=1`).set('Authorization', admin.auth);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);
    expect(list.body.pagination.hasNextPage).toBe(true);
    const filtered = await request(server).get(`${base()}/agents?status=REVOKED`).set('Authorization', admin.auth);
    expect(filtered.body.data.length).toBe(0);
  });
});
