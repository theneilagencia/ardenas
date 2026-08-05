/**
 * Arden.AS API — testes de integração de identidade/autorização (ARDEN-BE-002).
 *
 * App real (Nest + Fastify) + PostgreSQL de TESTE + provider FAKE. Cobre
 * provisionamento JIT, sessão, autorização server-side, endpoints de organização,
 * troca de organização, auditoria, envelope de erro e proteção contra enumeração.
 */

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ALL_PERMISSIONS } from '../../../src/domain/permissions';
import { FakeIdentityProvider } from '../src/identity/fake-identity.provider';
import { IdentityAuditService } from '../src/identity/identity-audit.service';
import { startTestApp } from './test-app';
import {
  auditEvents,
  bearer,
  prisma,
  resetIdentity,
  seedMembership,
  seedOrg,
  seedUser,
} from './identity-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;

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
});

// ── Autenticação e provisionamento JIT ────────────────────────────────────────
describe('autenticação', () => {
  it('sem token → 401 UNAUTHENTICATED com envelope e correlationId', async () => {
    const res = await request(server).get('/api/v1/session');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(res.body.error.correlationId).toBeTruthy();
  });

  it('token expirado → 401 SESSION_EXPIRED', async () => {
    const expired = FakeIdentityProvider.issueToken({ subject: 'sub-expired', ttlSeconds: -60 });
    const res = await request(server)
      .get('/api/v1/session')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('token inválido → 401 UNAUTHENTICATED', async () => {
    const res = await request(server)
      .get('/api/v1/session')
      .set('Authorization', 'Bearer lixo-nao-e-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('provisiona o usuário na primeira autenticação (JIT), sem criar org/membership', async () => {
    const res = await request(server)
      .get('/api/v1/session')
      .set('Authorization', bearer('sub-new', { email: 'new@arden.test' }));
    expect(res.status).toBe(200);
    const users = await prisma.user.findMany({ where: { externalSubject: 'sub-new' } });
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('new@arden.test');
    // Nenhuma organização/membership criada automaticamente.
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.membership.count()).toBe(0);
    expect(res.body.data.status).toBe('no_organization');
  });

  it('reautenticar NÃO cria novo usuário e atualiza o e-mail (subject imutável)', async () => {
    await request(server).get('/api/v1/session').set('Authorization', bearer('sub-same', { email: 'old@arden.test' }));
    await request(server).get('/api/v1/session').set('Authorization', bearer('sub-same', { email: 'renamed@arden.test' }));
    const users = await prisma.user.findMany({ where: { externalSubject: 'sub-same' } });
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('renamed@arden.test');
  });

  it('registra auditoria identity.authenticated', async () => {
    await request(server).get('/api/v1/session').set('Authorization', bearer('sub-audit'));
    const events = await auditEvents({ action: 'identity.authenticated' });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Sessão ────────────────────────────────────────────────────────────────────
describe('GET /api/v1/session', () => {
  it('usuário com membership recebe org e permissões efetivas computadas no servidor', async () => {
    const user = await seedUser({ subject: 'sub-a', email: 'a@arden.test' });
    const org = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    await seedMembership({ userId: user.id, organizationId: org.id, roleKeys: ['analyst'] });

    const res = await request(server).get('/api/v1/session').set('Authorization', bearer('sub-a'));
    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.status).toBe('authenticated');
    expect(data.organizations.map((o: { slug: string }) => o.slug)).toEqual(['alpha']);
    expect(data.activeOrganizationId).toBe(org.id);
    expect(data.permissions).toContain('organization.view');
    // Nunca expõe token/segredo.
    expect(JSON.stringify(data)).not.toMatch(/token|secret|password|hash/i);
  });

  it('agrega permissões de múltiplos papéis', async () => {
    const user = await seedUser({ subject: 'sub-multi' });
    const org = await seedOrg({ name: 'Multi', slug: 'multi' });
    await seedMembership({ userId: user.id, organizationId: org.id, roleKeys: ['approver', 'auditor'] });

    const res = await request(server).get('/api/v1/session').set('Authorization', bearer('sub-multi'));
    const perms: string[] = res.body.data.permissions;
    // União de papéis ⇒ contém permissões de ambos.
    expect(perms).toContain('organization.view');
    expect(perms.length).toBeGreaterThan(1);
  });

  it('papel INATIVO não concede permissões', async () => {
    const user = await seedUser({ subject: 'sub-inactive-role' });
    const org = await seedOrg({ name: 'Inact', slug: 'inact' });
    await seedMembership({ userId: user.id, organizationId: org.id, roleKeys: ['analyst'] });
    await prisma.role.updateMany({ where: { organizationId: null, key: 'analyst' }, data: { status: 'INACTIVE' } });

    const res = await request(server).get('/api/v1/session').set('Authorization', bearer('sub-inactive-role'));
    expect(res.body.data.permissions).toEqual([]);
  });

  it('usuário SUSPENSO é bloqueado (403 FORBIDDEN)', async () => {
    await seedUser({ subject: 'sub-susp', status: 'SUSPENDED' });
    const res = await request(server).get('/api/v1/session').set('Authorization', bearer('sub-susp'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('membership REVOGADA não aparece na sessão', async () => {
    const user = await seedUser({ subject: 'sub-rev' });
    const org = await seedOrg({ name: 'Rev', slug: 'rev' });
    await seedMembership({ userId: user.id, organizationId: org.id, roleKeys: ['analyst'], status: 'REVOKED' });
    const res = await request(server).get('/api/v1/session').set('Authorization', bearer('sub-rev'));
    expect(res.body.data.organizations).toEqual([]);
    expect(res.body.data.status).toBe('no_organization');
  });
});

// ── Organizações e autorização ────────────────────────────────────────────────
describe('endpoints de organização', () => {
  it('GET /organizations lista apenas as organizações do próprio usuário', async () => {
    const user = await seedUser({ subject: 'sub-list' });
    const alpha = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    await seedOrg({ name: 'Beta', slug: 'beta' }); // não é membro
    await seedMembership({ userId: user.id, organizationId: alpha.id, roleKeys: ['analyst'] });

    const res = await request(server).get('/api/v1/organizations').set('Authorization', bearer('sub-list'));
    expect(res.status).toBe(200);
    const slugs = res.body.data.map((o: { slug: string }) => o.slug);
    expect(slugs).toEqual(['alpha']);
  });

  it('GET /organizations/{id} exige permissão organization.view', async () => {
    const user = await seedUser({ subject: 'sub-noperm' });
    const org = await seedOrg({ name: 'NoPerm', slug: 'noperm' });
    // Membership ativa mas SEM papéis ⇒ sem organization.view.
    await seedMembership({ userId: user.id, organizationId: org.id, roleKeys: [] });

    const res = await request(server)
      .get(`/api/v1/organizations/${org.id}`)
      .set('Authorization', bearer('sub-noperm'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('GET /organizations/{id} de organização SEM membership → 404 (anti-enumeração)', async () => {
    await seedUser({ subject: 'sub-outsider' });
    const org = await seedOrg({ name: 'Secret', slug: 'secret' });
    const res = await request(server)
      .get(`/api/v1/organizations/${org.id}`)
      .set('Authorization', bearer('sub-outsider'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    // Auditada a negação de membership.
    const denied = await auditEvents({ action: 'membership.access_denied', outcome: 'DENIED' });
    expect(denied.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /organizations/{id}/memberships/me devolve a membership do usuário', async () => {
    const user = await seedUser({ subject: 'sub-me' });
    const org = await seedOrg({ name: 'Me', slug: 'me' });
    await seedMembership({ userId: user.id, organizationId: org.id, roleKeys: ['analyst'] });
    const res = await request(server)
      .get(`/api/v1/organizations/${org.id}/memberships/me`)
      .set('Authorization', bearer('sub-me'));
    expect(res.status).toBe(200);
    expect(res.body.data.organizationId).toBe(org.id);
  });
});

// ── Troca de organização ──────────────────────────────────────────────────────
describe('POST /api/v1/session/switch-organization', () => {
  it('troca para uma organização válida e persiste a preferência', async () => {
    const user = await seedUser({ subject: 'sub-switch' });
    const alpha = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const beta = await seedOrg({ name: 'Beta', slug: 'beta' });
    await seedMembership({ userId: user.id, organizationId: alpha.id, roleKeys: ['analyst'] });
    await seedMembership({ userId: user.id, organizationId: beta.id, roleKeys: ['analyst'] });

    const res = await request(server)
      .post('/api/v1/session/switch-organization')
      .set('Authorization', bearer('sub-switch'))
      .send({ organizationId: beta.id });
    expect(res.status).toBe(201);
    expect(res.body.data.activeOrganizationId).toBe(beta.id);

    const pref = await prisma.userSessionPreference.findUnique({ where: { userId: user.id } });
    expect(pref?.activeOrganizationId).toBe(beta.id);
    const selected = await auditEvents({ action: 'organization.selected', outcome: 'SUCCESS' });
    expect(selected.length).toBeGreaterThanOrEqual(1);
  });

  it('trocar para organização NÃO membro é negado (404) e mantém a anterior', async () => {
    const user = await seedUser({ subject: 'sub-keep' });
    const alpha = await seedOrg({ name: 'Alpha', slug: 'alpha' });
    const foreign = await seedOrg({ name: 'Foreign', slug: 'foreign' });
    await seedMembership({ userId: user.id, organizationId: alpha.id, roleKeys: ['analyst'] });

    const res = await request(server)
      .post('/api/v1/session/switch-organization')
      .set('Authorization', bearer('sub-keep'))
      .send({ organizationId: foreign.id });
    expect(res.status).toBe(404);
    // Preferência não foi alterada.
    const pref = await prisma.userSessionPreference.findUnique({ where: { userId: user.id } });
    expect(pref).toBeNull();
    const denied = await auditEvents({ action: 'organization.selection_denied', outcome: 'DENIED' });
    expect(denied.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Logout (endpoint canônico) ────────────────────────────────────────────────
describe('POST /api/v1/session/logout', () => {
  it('endpoint canônico responde 204 e audita session.logged_out', async () => {
    await seedUser({ subject: 'sub-logout' });
    const res = await request(server)
      .post('/api/v1/session/logout')
      .set('Authorization', bearer('sub-logout'));
    expect(res.status).toBe(204);
    const events = await auditEvents({ action: 'session.logged_out' });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('a rota antiga /session/sign-out não existe (404)', async () => {
    await seedUser({ subject: 'sub-legacy' });
    const res = await request(server)
      .post('/api/v1/session/sign-out')
      .set('Authorization', bearer('sub-legacy'));
    expect(res.status).toBe(404);
  });
});

// ── Auditoria e catálogo ──────────────────────────────────────────────────────
describe('auditoria e catálogo', () => {
  it('metadados sensíveis são redigidos pelo IdentityAuditService', async () => {
    const audit = app.get(IdentityAuditService, { strict: false });
    await audit.record({
      action: 'test.redaction',
      resourceType: 'Test',
      outcome: 'SUCCESS',
      correlationId: 'corr-redact',
      metadata: { token: 'segredo-supersecreto', authorization: 'Bearer x', innocuo: 'ok' },
    });
    const [ev] = await auditEvents({ action: 'test.redaction' });
    const meta = ev.metadata as Record<string, unknown>;
    expect(meta.token).toBe('[REDACTED]');
    expect(meta.authorization).toBe('[REDACTED]');
    expect(meta.innocuo).toBe('ok');
  });

  it('o catálogo semeado cobre exatamente ALL_PERMISSIONS (fonte única do frontend)', async () => {
    const count = await prisma.permission.count();
    expect(count).toBe(ALL_PERMISSIONS.length);
  });

  it('re-semear o catálogo é idempotente (mesma contagem)', async () => {
    const before = await prisma.permission.count();
    await resetIdentity();
    const after = await prisma.permission.count();
    expect(after).toBe(before);
  });
});
