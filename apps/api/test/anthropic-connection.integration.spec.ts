/**
 * Arden.AS API — integração Anthropic: connector, credencial tenant-managed, vault,
 * catálogos persistidos e lifecycle de ModelConfiguration (ARDEN-BE-008.2 §42–46).
 *
 * PostgreSQL real. Nenhuma chamada de geração; nenhuma rede ao provider; nenhum SDK.
 * Segredo write-only (canário), cifrado no cofre e AUSENTE de resposta/audit/DB plaintext.
 * Provider/modelos DISABLED; ModelConfiguration DRAFT pode ser preparada mas NÃO ativada.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, type Actor } from './operations-helpers';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ModelProviderCatalogProjector } from '../src/agents/providers/model-provider-catalog.projector';
import { ModelCatalogProjector } from '../src/agents/providers/project-model-catalog';

const CANARY = 'ARDEN_BE008_ANTHROPIC_SECRET_CANARY_7d31e9';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let connectorProjector: ConnectorCatalogProjector;
let providerProjector: ModelProviderCatalogProjector;
let modelProjector: ModelCatalogProjector;

const base = (orgId: string) => `/api/v1/organizations/${orgId}`;

async function projectAll(): Promise<void> {
  await connectorProjector.project();
  await providerProjector.project();
  await modelProjector.project();
}

async function anthropicModelId(): Promise<string> {
  const row = await prisma.modelCatalogEntry.findFirst({ where: { providerKey: 'anthropic.direct' }, orderBy: { modelId: 'asc' } });
  return row!.modelId;
}

async function createAnthropicConnection(orgId: string, admin: Actor): Promise<{ id: string; revision: number }> {
  const res = await request(server).post(`${base(orgId)}/connections`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('conn'))
    .send({ connectorKey: 'system.anthropic', connectorVersion: '1', name: 'Anthropic org', configuration: { baseUrlMode: 'OFFICIAL', timeoutMs: 60000, maximumRetries: 2 } });
  expect(res.status).toBe(201);
  return { id: res.body.data.id, revision: res.body.data.revision };
}

async function addCredential(orgId: string, admin: Actor, connectionId: string, secret = CANARY): Promise<{ status: number; body: { data?: { id: string; status: string }; error?: unknown } }> {
  return request(server).post(`${base(orgId)}/connections/${connectionId}/credentials`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('cred'))
    .send({ secret: { apiKey: secret } });
}

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  connectorProjector = app.get(ConnectorCatalogProjector);
  providerProjector = app.get(ModelProviderCatalogProjector);
  modelProjector = app.get(ModelCatalogProjector);
});
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetIdentity(); await projectAll(); });

describe('§42 catálogos persistidos', () => {
  it('connector ACTIVE/MODEL_PROVIDER; provider e modelos DISABLED; sem rate card', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('a-admin', orgId);
    const conn = await prisma.connectorDefinition.findFirst({ where: { key: 'system.anthropic' } });
    expect(conn?.status).toBe('ACTIVE');
    expect(conn?.category).toBe('MODEL_PROVIDER');
    const prov = await prisma.modelProviderDefinition.findFirst({ where: { key: 'anthropic.direct' } });
    expect(prov?.status).toBe('DISABLED');
    expect(prov?.productionAllowed).toBe(false);
    const models = await prisma.modelCatalogEntry.findMany({ where: { providerKey: 'anthropic.direct' } });
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.status === 'DISABLED' && !m.productionAllowed)).toBe(true);
    expect(await prisma.modelRateCard.count({ where: { providerKey: 'anthropic.direct' } })).toBe(0);
    // Endpoint público de catálogo de modelos: todos DISABLED.
    const list = await request(server).get('/api/v1/model-providers/anthropic.direct/versions/1/models').set('Authorization', admin.auth).set('X-Arden-Organization', orgId);
    expect(list.status).toBe(200);
    expect(list.body.data.every((m: { status: string }) => m.status === 'DISABLED')).toBe(true);
  });
});

describe('§43 credencial write-only + cofre (canário)', () => {
  it('segredo cifrado; ausente de resposta e de plaintext no banco', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('a-admin', orgId);
    const conn = await createAnthropicConnection(orgId, admin);
    const cred = await addCredential(orgId, admin, conn.id);
    expect(cred.status).toBe(201);
    // Resposta só metadados — nunca o segredo.
    expect(JSON.stringify(cred.body)).not.toContain(CANARY);
    expect(JSON.stringify(cred.body)).not.toContain('apiKey');
    // No banco: só ciphertext/metadata cripto; nenhum plaintext do canário.
    const version = await prisma.connectionCredentialVersion.findFirst({ where: { connectionId: conn.id } });
    expect(version).toBeTruthy();
    expect(version!.status).toBe('ACTIVE');
    const raw = JSON.stringify(version);
    expect(raw).not.toContain(CANARY);
    expect(version!.encryptedSecret).not.toContain(CANARY);
    // Auditoria não contém o segredo.
    const audits = await prisma.auditEvent.findMany({ where: { organizationId: orgId } });
    expect(JSON.stringify(audits)).not.toContain(CANARY);
  });
});

describe('§17 validação local de configuração', () => {
  it('valida localmente e declara NOT_VERIFIED_WITH_PROVIDER, sem segredo', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('a-admin', orgId);
    const conn = await createAnthropicConnection(orgId, admin);
    await addCredential(orgId, admin, conn.id);
    const res = await request(server).post(`${base(orgId)}/connections/${conn.id}/validate-configuration`).set('Authorization', admin.auth).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.configurationValid).toBe(true);
    expect(res.body.data.credentialPresent).toBe(true);
    expect(res.body.data.credentialDecryptable).toBe(true);
    expect(res.body.data.providerCompatible).toBe(true);
    expect(res.body.data.providerVerificationStatus).toBe('NOT_VERIFIED_WITH_PROVIDER');
    expect(JSON.stringify(res.body)).not.toContain(CANARY);
  });
});

describe('§44 rotação de credencial', () => {
  it('rotaciona: nova versão ativa, anterior superseded; nenhum segredo retornado', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('a-admin', orgId);
    const conn = await createAnthropicConnection(orgId, admin);
    await addCredential(orgId, admin, conn.id, CANARY + '-v1');
    // A conexão precisa estar ACTIVE para rotacionar (lifecycle BE-006; independente do
    // provider DISABLED — ativar a conexão apenas habilita operações de credencial).
    const activated = await request(server).post(`${base(orgId)}/connections/${conn.id}/activate`).set('Authorization', admin.auth).send({ expectedRevision: conn.revision });
    expect(activated.status).toBe(200);
    const rot = await request(server).post(`${base(orgId)}/connections/${conn.id}/credentials/rotate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('rot')).send({ secret: { apiKey: CANARY + '-v2' } });
    expect(rot.status).toBe(201);
    expect(JSON.stringify(rot.body)).not.toContain(CANARY);
    const versions = await prisma.connectionCredentialVersion.findMany({ where: { connectionId: conn.id }, orderBy: { versionNumber: 'asc' } });
    expect(versions).toHaveLength(2);
    expect(versions[0].status).toBe('SUPERSEDED');
    expect(versions[1].status).toBe('ACTIVE');
  });
});

describe('§45 ModelConfiguration Anthropic — draft preparável, ativação bloqueada', () => {
  async function prepareConfig(orgId: string, admin: Actor, modelId: string, connectionId?: string) {
    return request(server).post(`${base(orgId)}/model-configurations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('cfg'))
      .send({ providerKey: 'anthropic.direct', providerVersion: '1', name: 'Cfg Anthropic', modelId, credentialConnectionId: connectionId, parameters: { maximumOutputTokens: 512 } });
  }

  it('cria DRAFT (provider DISABLED) e bloqueia ativação com MODEL_PROVIDER_DISABLED', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('a-admin', orgId);
    const conn = await createAnthropicConnection(orgId, admin);
    await addCredential(orgId, admin, conn.id);
    const modelId = await anthropicModelId();
    const cfg = await prepareConfig(orgId, admin, modelId, conn.id);
    expect(cfg.status).toBe(201);
    expect(cfg.body.data.status).toBe('DRAFT');
    const act = await request(server).post(`${base(orgId)}/model-configurations/${cfg.body.data.id}/activate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('act')).send({ expectedRevision: cfg.body.data.revision });
    expect(act.status).toBe(409);
    expect(act.body.error.code).toBe('MODEL_PROVIDER_DISABLED');
  });

  it('rejeita modelId fora da allowlist e parâmetros proibidos', async () => {
    const orgId = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const admin = await seedActor('a-admin', orgId);
    const bad = await prepareConfig(orgId, admin, 'gpt-4');
    expect(bad.status).toBe(422);
    const modelId = await anthropicModelId();
    const badParams = await request(server).post(`${base(orgId)}/model-configurations`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('cfg2'))
      .send({ providerKey: 'anthropic.direct', providerVersion: '1', name: 'X', modelId, parameters: { maximumOutputTokens: 512, apiKey: 'leak' } });
    expect(badParams.status).toBe(422);
  });
});

describe('§46 cross-tenant', () => {
  it('Beta não lê/usa a conexão de Alpha (404 sem revelar existência)', async () => {
    const alpha = (await seedOrg({ name: 'Alpha', slug: 'alpha' })).id;
    const alphaAdmin = await seedActor('alpha-admin', alpha);
    const beta = (await seedOrg({ name: 'Beta', slug: 'beta' })).id;
    const betaAdmin = await seedActor('beta-admin', beta);
    const conn = await createAnthropicConnection(alpha, alphaAdmin);

    const read = await request(server).get(`${base(beta)}/connections/${conn.id}`).set('Authorization', betaAdmin.auth);
    expect(read.status).toBe(404);
    const modelId = await anthropicModelId();
    const cfg = await request(server).post(`${base(beta)}/model-configurations`).set('Authorization', betaAdmin.auth).set('Idempotency-Key', idemKey('xcfg'))
      .send({ providerKey: 'anthropic.direct', providerVersion: '1', name: 'X', modelId, credentialConnectionId: conn.id, parameters: { maximumOutputTokens: 512 } });
    expect(cfg.status).toBe(404);
  });
});

describe('§38 seed idempotente (re-projeção)', () => {
  it('re-projetar não cria duplicatas nem ativa o provider', async () => {
    await projectAll();
    await projectAll();
    expect(await prisma.modelProviderDefinition.count({ where: { key: 'anthropic.direct' } })).toBe(1);
    const models = await prisma.modelCatalogEntry.count({ where: { providerKey: 'anthropic.direct' } });
    expect(models).toBeGreaterThan(0);
    const prov = await prisma.modelProviderDefinition.findFirst({ where: { key: 'anthropic.direct' } });
    expect(prov?.status).toBe('DISABLED');
  });
});
