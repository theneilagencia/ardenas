/**
 * Arden.AS API — testes de bootstrap seguro e invariantes do modelo (ARDEN-BE-002).
 *
 * Exercita `bootstrapOrganization` (dry-run, real, repetição idempotente e
 * conflito material) e as restrições do banco (unicidade de identidade externa,
 * de membership por usuário/organização e de chave de papel por organização).
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapOrganization } from '../prisma/bootstrap-organization';
import { prisma, resetIdentity, seedOrg, seedUser } from './identity-helpers';

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetIdentity();
});

const input = {
  name: 'TheNeil',
  slug: 'theneil',
  userSubject: 'boot-subject',
  userEmail: 'boot@arden.test',
  provider: 'fake',
  roleKey: 'corporate_admin',
};

describe('bootstrapOrganization', () => {
  it('dry-run não escreve nada', async () => {
    const res = await bootstrapOrganization(prisma, input, { dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.organizationId).toBeNull();
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('execução real cria usuário, organização, membership e atribui o papel admin', async () => {
    const res = await bootstrapOrganization(prisma, input, { dryRun: false });
    expect(res.created).toMatchObject({ user: true, organization: true, membership: true, roleAssignment: true });

    const membership = await prisma.membership.findFirstOrThrow({
      where: { id: res.membershipId! },
      include: { roles: { include: { role: true } } },
    });
    expect(membership.status).toBe('ACTIVE');
    expect(membership.roles.map((r) => r.role.key)).toContain('corporate_admin');

    // Auditoria de bootstrap registrada.
    const audit = await prisma.identityAuditEvent.findMany({ where: { action: 'identity.bootstrap' } });
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  it('repetir o bootstrap é idempotente (não duplica)', async () => {
    const first = await bootstrapOrganization(prisma, input, { dryRun: false });
    const second = await bootstrapOrganization(prisma, input, { dryRun: false });
    expect(second.userId).toBe(first.userId);
    expect(second.organizationId).toBe(first.organizationId);
    expect(second.created).toMatchObject({ user: false, organization: false, membership: false });
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.membership.count()).toBe(1);
  });

  it('falha em conflito material (mesmo slug, outro nome)', async () => {
    await bootstrapOrganization(prisma, input, { dryRun: false });
    await expect(
      bootstrapOrganization(prisma, { ...input, name: 'OutroNome' }, { dryRun: false }),
    ).rejects.toThrow(/[Cc]onflito material/);
  });
});

describe('invariantes do modelo (constraints)', () => {
  it('identidade externa (provider, subject) é única', async () => {
    await seedUser({ subject: 'dup', provider: 'fake' });
    await expect(seedUser({ subject: 'dup', provider: 'fake' })).rejects.toThrow();
  });

  it('membership é única por (usuário, organização)', async () => {
    const user = await seedUser({ subject: 'u-uniq' });
    const org = await seedOrg({ name: 'U', slug: 'u-uniq' });
    await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, status: 'ACTIVE' } });
    await expect(
      prisma.membership.create({ data: { userId: user.id, organizationId: org.id, status: 'ACTIVE' } }),
    ).rejects.toThrow();
  });

  it('a chave do papel de sistema é única (organizationId null)', async () => {
    await expect(
      prisma.role.create({ data: { organizationId: null, key: 'analyst', name: 'dup', system: true, status: 'ACTIVE' } }),
    ).rejects.toThrow();
  });

  it('a auditoria é append-only por uso (sem update/delete no serviço público)', async () => {
    const before = await prisma.identityAuditEvent.count();
    await prisma.identityAuditEvent.create({
      data: { action: 'x', resourceType: 'Y', outcome: 'SUCCESS', correlationId: 'c-append' },
    });
    expect(await prisma.identityAuditEvent.count()).toBe(before + 1);
  });
});
