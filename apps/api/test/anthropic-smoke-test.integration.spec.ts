/**
 * Arden.AS API — smoke test real controlado, OFFLINE (ARDEN-BE-008.4 §47-51).
 *
 * PG real + fake transport. Comprova gates do comando, sucesso com marcação da verificação
 * na versão de credencial, sanitização (canário ausente), falha de auth, UNKNOWN, bloqueio de
 * produção, allowlist de organização e invalidação por rotação. Nenhuma rede; nenhuma chave real.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ANTHROPIC_MODEL_CATALOG } from '@arden/contracts';

process.env.ANTHROPIC_PROVIDER_RUNTIME_ENABLED = 'true';
process.env.ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED = 'true';
process.env.ANTHROPIC_SMOKE_TEST_ENABLED = 'true';
process.env.ANTHROPIC_SMOKE_TEST_ACKNOWLEDGED = 'true';

import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { idemKey, seedActor, type Actor } from './operations-helpers';
import { APP_CONFIG } from '../src/config/config.module';
import type { AppConfig } from '../src/config/env.schema';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ModelProviderCatalogProjector } from '../src/agents/providers/model-provider-catalog.projector';
import { FakeAnthropicTransport } from '../src/agents/providers/anthropic/anthropic-fake-transport';
import { AnthropicNonProdGate } from '../src/agents/providers/anthropic/anthropic-non-prod-gate';
import { AnthropicSmokeTestService } from '../src/agents/providers/anthropic/anthropic-smoke-test.service';

const CANARY = 'ARDEN_BE008_ANTHROPIC_SMOKE_SECRET_CANARY_44b1';
const MODEL = ANTHROPIC_MODEL_CATALOG[0].modelId;

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;
let fake: FakeAnthropicTransport;
let gate: AnthropicNonProdGate;
let smoke: AnthropicSmokeTestService;
let config: AppConfig;
let connectorProjector: ConnectorCatalogProjector;
let providerProjector: ModelProviderCatalogProjector;

const b = (o: string) => `/api/v1/organizations/${o}`;

async function activateProvider(): Promise<void> {
  await prisma.modelProviderDefinition.updateMany({ where: { key: 'anthropic.direct' }, data: { status: 'ACTIVE' } });
}
async function setup(orgId: string, auth: string): Promise<{ connectionId: string; modelConfigurationId: string }> {
  const conn = await request(server).post(`${b(orgId)}/connections`).set('Authorization', auth).set('Idempotency-Key', idemKey('conn'))
    .send({ connectorKey: 'system.anthropic', connectorVersion: '1', name: 'Anthropic', configuration: { baseUrlMode: 'OFFICIAL', timeoutMs: 60000, maximumRetries: 2 } });
  const connectionId = conn.body.data.id as string;
  await request(server).post(`${b(orgId)}/connections/${connectionId}/credentials`).set('Authorization', auth).set('Idempotency-Key', idemKey('cred')).send({ secret: { apiKey: CANARY } });
  const fresh = await request(server).get(`${b(orgId)}/connections/${connectionId}`).set('Authorization', auth);
  await request(server).post(`${b(orgId)}/connections/${connectionId}/activate`).set('Authorization', auth).send({ expectedRevision: fresh.body.data.revision });
  const cfg = await request(server).post(`${b(orgId)}/model-configurations`).set('Authorization', auth).set('Idempotency-Key', idemKey('cfg'))
    .send({ providerKey: 'anthropic.direct', providerVersion: '1', name: 'cfg', modelId: MODEL, credentialConnectionId: connectionId, parameters: { maximumOutputTokens: 256 } });
  return { connectionId, modelConfigurationId: cfg.body.data.id as string };
}
function allow(orgId: string): void {
  config.anthropicNonProdAllowedOrganizationIds.length = 0;
  config.anthropicNonProdAllowedOrganizationIds.push(orgId);
}

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();
  fake = app.get(FakeAnthropicTransport);
  gate = app.get(AnthropicNonProdGate);
  smoke = app.get(AnthropicSmokeTestService);
  config = app.get<AppConfig>(APP_CONFIG);
  connectorProjector = app.get(ConnectorCatalogProjector);
  providerProjector = app.get(ModelProviderCatalogProjector);
});
afterAll(async () => {
  await app.close(); await prisma.$disconnect();
  delete process.env.ANTHROPIC_PROVIDER_RUNTIME_ENABLED; delete process.env.ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED;
  delete process.env.ANTHROPIC_SMOKE_TEST_ENABLED; delete process.env.ANTHROPIC_SMOKE_TEST_ACKNOWLEDGED;
});
beforeEach(async () => {
  await resetIdentity(); await connectorProjector.project(); await providerProjector.project();
  await activateProvider(); fake.reset(); gate.resetState();
  config.anthropicNonProdAllowedOrganizationIds.length = 0;
});

async function run(orgId: string, ids: { connectionId: string; modelConfigurationId: string }, confirmed = true) {
  return smoke.run({ organizationId: orgId, connectionId: ids.connectionId, modelConfigurationId: ids.modelConfigurationId, confirmed, operator: 'op' });
}

describe('§9/§10 gates do comando', () => {
  it('sem confirmação → SMOKE_TEST_CONFIRMATION_REQUIRED', async () => {
    const orgId = (await seedOrg({ name: 'A', slug: 'a' })).id; const admin = await seedActor('s', orgId); allow(orgId);
    const ids = await setup(orgId, admin.auth);
    await expect(run(orgId, ids, false)).rejects.toMatchObject({ code: 'SMOKE_TEST_CONFIRMATION_REQUIRED' });
    expect(fake.calls.length).toBe(0);
  });
  it('organização fora da allowlist → MODEL_PROVIDER_DISABLED', async () => {
    const orgId = (await seedOrg({ name: 'A', slug: 'a' })).id; const admin = await seedActor('s', orgId);
    const ids = await setup(orgId, admin.auth); // allowlist vazia
    await expect(run(orgId, ids)).rejects.toMatchObject({ code: 'MODEL_PROVIDER_DISABLED' });
    expect(fake.calls.length).toBe(0);
  });
});

describe('§20/§21/§50 sucesso, marcação e sanitização', () => {
  it('PASSED → structured output válido, versão de credencial marcada, canário ausente', async () => {
    const orgId = (await seedOrg({ name: 'A', slug: 'a' })).id; const admin = await seedActor('s', orgId); allow(orgId);
    const ids = await setup(orgId, admin.auth);
    fake.setDefault('structured_success');
    const res = await run(orgId, ids);
    expect(res.status).toBe('PASSED');
    expect(res.structuredOutputValidated).toBe(true);
    expect(res.estimatedCostMinor).toBeNull();
    expect(res.currency).toBeNull();
    expect(res.requestIdHash).toBeTruthy();
    expect(JSON.stringify(res)).not.toContain(CANARY);
    // Versão de credencial marcada como smoke PASSED.
    const version = await prisma.connectionCredentialVersion.findFirst({ where: { connectionId: ids.connectionId, status: 'ACTIVE' } });
    expect((version?.metadata as { smokeTest?: { status?: string } })?.smokeTest?.status).toBe('PASSED');
    // Auditoria sem canário.
    const audit = await prisma.auditEvent.findMany({ where: { organizationId: orgId } });
    expect(JSON.stringify(audit)).not.toContain(CANARY);
  });
});

describe('§23/§24 erros reais mínimos', () => {
  it('falha de autenticação → FAILED, não marca a versão', async () => {
    const orgId = (await seedOrg({ name: 'A', slug: 'a' })).id; const admin = await seedActor('s', orgId); allow(orgId);
    const ids = await setup(orgId, admin.auth);
    fake.setDefault('authentication_error');
    const res = await run(orgId, ids);
    expect(res.status).toBe('FAILED');
    const version = await prisma.connectionCredentialVersion.findFirst({ where: { connectionId: ids.connectionId, status: 'ACTIVE' } });
    expect((version?.metadata as { smokeTest?: unknown })?.smokeTest).toBeUndefined();
  });
  it('timeout após envio → UNKNOWN, nunca sucesso', async () => {
    const orgId = (await seedOrg({ name: 'A', slug: 'a' })).id; const admin = await seedActor('s', orgId); allow(orgId);
    const ids = await setup(orgId, admin.auth);
    fake.setDefault('timeout_after_send');
    const res = await run(orgId, ids);
    expect(res.status).toBe('UNKNOWN');
    expect(res.structuredOutputValidated).toBe(false);
  });
});

describe('§50 bloqueio de produção', () => {
  it('NODE_ENV=production → MODEL_PROVIDER_DISABLED, transporte NÃO chamado', async () => {
    const orgId = (await seedOrg({ name: 'A', slug: 'a' })).id; const admin = await seedActor('s', orgId); allow(orgId);
    const ids = await setup(orgId, admin.auth);
    fake.setDefault('structured_success');
    const prev = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
    try {
      await expect(run(orgId, ids)).rejects.toMatchObject({ code: 'MODEL_PROVIDER_DISABLED' });
    } finally { process.env.NODE_ENV = prev; }
    expect(fake.calls.length).toBe(0);
  });
});

describe('§38/§51 rotação invalida o smoke', () => {
  it('após PASSED, rotacionar credencial invalida a verificação (nova versão sem smoke)', async () => {
    const orgId = (await seedOrg({ name: 'A', slug: 'a' })).id; const admin = await seedActor('s', orgId); allow(orgId);
    const ids = await setup(orgId, admin.auth);
    fake.setDefault('structured_success');
    expect((await run(orgId, ids)).status).toBe('PASSED');
    // Rotaciona: nova versão de credencial ATIVA, sem smoke marcado.
    const rot = await request(server).post(`${b(orgId)}/connections/${ids.connectionId}/credentials/rotate`).set('Authorization', admin.auth).set('Idempotency-Key', idemKey('rot')).send({ secret: { apiKey: CANARY + '-v2' } });
    expect(rot.status).toBe(201);
    const active = await prisma.connectionCredentialVersion.findFirst({ where: { connectionId: ids.connectionId, status: 'ACTIVE' }, orderBy: { versionNumber: 'desc' } });
    expect((active?.metadata as { smokeTest?: unknown })?.smokeTest).toBeUndefined();
  });
});
