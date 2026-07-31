/**
 * Arden.AS API — utilitários de teste de identidade/tenancy (ARDEN-BE-002).
 *
 * Constrói cenários reais no banco de TESTE (usuários, organizações, memberships,
 * papéis) e emite tokens do provider FAKE para requisições autenticadas. Não usa
 * Supabase real. Reusa o catálogo semeado (`seedIdentityCatalog`).
 */

import { PrismaClient } from '@prisma/client';
import { FakeIdentityProvider } from '../src/identity/fake-identity.provider';
import { seedIdentityCatalog } from '../prisma/seed';

export const prisma = new PrismaClient();

/** Emite um Bearer fake para um subject (provider = fake). */
export function bearer(subject: string, opts: { email?: string; ttlSeconds?: number } = {}): string {
  const token = FakeIdentityProvider.issueToken({
    subject,
    email: opts.email ?? `${subject}@arden.test`,
    ttlSeconds: opts.ttlSeconds,
  });
  return `Bearer ${token}`;
}

/**
 * Limpa TODAS as tabelas de identidade/tenancy (ordem segura para FKs) e re-semeia
 * o catálogo. Mantém o teste isolado e determinístico.
 */
export async function resetIdentity(): Promise<void> {
  await prisma.$transaction([
    prisma.identityAuditEvent.deleteMany(),
    // Operações/versões/auditoria de operações e idempotência (ARDEN-BE-003):
    // limpar ANTES das organizações (FK operations.organization_id).
    prisma.auditEvent.deleteMany(),
    prisma.operationVersion.deleteMany(),
    prisma.operation.deleteMany(),
    prisma.idempotencyRecord.deleteMany(),
    prisma.userSessionPreference.deleteMany(),
    prisma.membershipRole.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.permission.deleteMany(),
  ]);
  await seedIdentityCatalog(prisma);
}

export interface SeedUserInput {
  subject: string;
  email?: string;
  displayName?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  provider?: string;
}

export async function seedUser(input: SeedUserInput): Promise<{ id: string }> {
  return prisma.user.create({
    data: {
      externalProvider: input.provider ?? 'fake',
      externalSubject: input.subject,
      email: input.email ?? `${input.subject}@arden.test`,
      displayName: input.displayName ?? input.subject,
      status: input.status ?? 'ACTIVE',
    },
    select: { id: true },
  });
}

export interface SeedOrgInput {
  name: string;
  slug: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
}

export async function seedOrg(input: SeedOrgInput): Promise<{ id: string }> {
  return prisma.organization.create({
    data: { name: input.name, slug: input.slug, status: input.status ?? 'ACTIVE' },
    select: { id: true },
  });
}

/** Retorna o papel de sistema (organizationId null) pela chave. */
export async function systemRole(key: string): Promise<{ id: string }> {
  const role = await prisma.role.findFirstOrThrow({ where: { organizationId: null, key } });
  return { id: role.id };
}

export interface SeedMembershipInput {
  userId: string;
  organizationId: string;
  roleKeys?: string[];
  status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';
}

/** Cria uma membership e atribui papéis de sistema por chave. */
export async function seedMembership(input: SeedMembershipInput): Promise<{ id: string }> {
  const membership = await prisma.membership.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      status: input.status ?? 'ACTIVE',
    },
    select: { id: true },
  });
  for (const key of input.roleKeys ?? []) {
    const role = await systemRole(key);
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: role.id },
    });
  }
  return membership;
}

export async function auditEvents(where: {
  action?: string;
  actorUserId?: string;
  organizationId?: string;
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILURE';
}): Promise<Array<{ action: string; outcome: string; reasonCode: string | null; metadata: unknown }>> {
  return prisma.identityAuditEvent.findMany({
    where,
    select: { action: true, outcome: true, reasonCode: true, metadata: true },
    orderBy: { occurredAt: 'asc' },
  });
}
