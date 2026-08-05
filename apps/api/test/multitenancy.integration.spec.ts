/**
 * Arden.AS API — teste CRÍTICO de isolamento multitenant (ARDEN-BE-002).
 *
 * Cenário exigido pela especificação:
 *   - Usuário A pertence apenas à organização Alpha.
 *   - Usuário B pertence apenas à organização Beta.
 *   - Usuário C pertence a AMBAS, com PAPÉIS/PERMISSÕES DIFERENTES por organização
 *     (admin em Alpha, auditor em Beta).
 *
 * Prova que: cada usuário vê apenas suas organizações; um usuário não acessa a
 * organização de outro (404 anti-enumeração, mesmo existindo); o `organizationId`
 * do path NÃO autoriza; e as permissões efetivas de C mudam conforme a
 * organização ativa (recalculadas no servidor, nunca vindas do cliente).
 */

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { bearer, prisma, resetIdentity, seedMembership, seedOrg, seedUser } from './identity-helpers';

let app: NestFastifyApplication;
let server: ReturnType<NestFastifyApplication['getHttpServer']>;

let alphaId: string;
let betaId: string;

beforeAll(async () => {
  app = await startTestApp();
  server = app.getHttpServer();

  await resetIdentity();

  const alpha = await seedOrg({ name: 'Alpha', slug: 'alpha' });
  const beta = await seedOrg({ name: 'Beta', slug: 'beta' });
  alphaId = alpha.id;
  betaId = beta.id;

  const userA = await seedUser({ subject: 'user-a', email: 'a@arden.test' });
  const userB = await seedUser({ subject: 'user-b', email: 'b@arden.test' });
  const userC = await seedUser({ subject: 'user-c', email: 'c@arden.test' });

  await seedMembership({ userId: userA.id, organizationId: alphaId, roleKeys: ['analyst'] });
  await seedMembership({ userId: userB.id, organizationId: betaId, roleKeys: ['analyst'] });
  // C: admin (todas as permissões) em Alpha; auditor (leitura) em Beta.
  await seedMembership({ userId: userC.id, organizationId: alphaId, roleKeys: ['corporate_admin'] });
  await seedMembership({ userId: userC.id, organizationId: betaId, roleKeys: ['auditor'] });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function switchTo(subject: string, organizationId: string) {
  return request(server)
    .post('/api/v1/session/switch-organization')
    .set('Authorization', bearer(subject))
    .send({ organizationId });
}

describe('isolamento multitenant', () => {
  it('A vê apenas Alpha; B vê apenas Beta', async () => {
    const a = await request(server).get('/api/v1/organizations').set('Authorization', bearer('user-a'));
    const b = await request(server).get('/api/v1/organizations').set('Authorization', bearer('user-b'));
    expect(a.body.data.map((o: { slug: string }) => o.slug)).toEqual(['alpha']);
    expect(b.body.data.map((o: { slug: string }) => o.slug)).toEqual(['beta']);
  });

  it('C vê ambas as organizações', async () => {
    const c = await request(server).get('/api/v1/organizations').set('Authorization', bearer('user-c'));
    const slugs = c.body.data.map((o: { slug: string }) => o.slug).sort();
    expect(slugs).toEqual(['alpha', 'beta']);
  });

  it('A NÃO acessa Beta (404), embora Beta exista — o path não autoriza', async () => {
    const res = await request(server)
      .get(`/api/v1/organizations/${betaId}`)
      .set('Authorization', bearer('user-a'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('B NÃO acessa Alpha (404)', async () => {
    const res = await request(server)
      .get(`/api/v1/organizations/${alphaId}`)
      .set('Authorization', bearer('user-b'));
    expect(res.status).toBe(404);
  });

  it('A não pode trocar para Beta (404) — sem membership', async () => {
    const res = await switchTo('user-a', betaId);
    expect(res.status).toBe(404);
  });

  it('C possui permissões DIFERENTES conforme a organização ativa', async () => {
    // Ativa Alpha → admin: possui organization.manage.
    const toAlpha = await switchTo('user-c', alphaId);
    expect(toAlpha.status).toBe(201);
    expect(toAlpha.body.data.activeOrganizationId).toBe(alphaId);
    expect(toAlpha.body.data.permissions).toContain('organization.manage');

    // Ativa Beta → auditor: NÃO possui organization.manage.
    const toBeta = await switchTo('user-c', betaId);
    expect(toBeta.status).toBe(201);
    expect(toBeta.body.data.activeOrganizationId).toBe(betaId);
    expect(toBeta.body.data.permissions).not.toContain('organization.manage');
    expect(toBeta.body.data.permissions).toContain('organization.view');
  });

  it('C acessa o detalhe de cada organização a que pertence', async () => {
    const alpha = await request(server)
      .get(`/api/v1/organizations/${alphaId}`)
      .set('Authorization', bearer('user-c'));
    const beta = await request(server)
      .get(`/api/v1/organizations/${betaId}`)
      .set('Authorization', bearer('user-c'));
    expect(alpha.status).toBe(200);
    expect(beta.status).toBe(200);
    expect(alpha.body.data.slug).toBe('alpha');
    expect(beta.body.data.slug).toBe('beta');
  });

  it('a membership de C em cada organização reflete o papel correto', async () => {
    const alpha = await request(server)
      .get(`/api/v1/organizations/${alphaId}/memberships/me`)
      .set('Authorization', bearer('user-c'));
    const beta = await request(server)
      .get(`/api/v1/organizations/${betaId}/memberships/me`)
      .set('Authorization', bearer('user-c'));
    expect(alpha.body.data.roleIds).toContain('corporate_admin');
    expect(beta.body.data.roleIds).toContain('auditor');
    // Isolamento: o papel de uma org não vaza para a outra.
    expect(alpha.body.data.roleIds).not.toContain('auditor');
    expect(beta.body.data.roleIds).not.toContain('corporate_admin');
  });
});
