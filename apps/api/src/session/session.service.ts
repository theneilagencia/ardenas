/**
 * Arden.AS API — serviço de sessão (ARDEN-BE-002).
 *
 * Monta o `SessionContext` do CONTRATO compartilhado a partir do estado do
 * servidor: usuário, memberships, organizações acessíveis, organização ativa
 * (validada) e permissões efetivas. NUNCA expõe token/segredo. A organização
 * ativa e as permissões são recalculadas server-side a cada chamada.
 */

import { Injectable } from '@nestjs/common';
import type { Membership as DbMembership, Organization as DbOrg } from '@prisma/client';
import {
  sessionContext as sessionContractSchema,
  type SessionContext,
  type Membership as ContractMembership,
  type OrganizationSummary,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { AuthorizationService } from '../authz/authorization.service';
import { IdentityAuditService } from '../identity/identity-audit.service';
import { ApiException } from '../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../identity/request-context';

type MembershipWithOrgAndRoles = DbMembership & {
  organization: DbOrg;
  roles: { role: { key: string } }[];
};

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly audit: IdentityAuditService,
  ) {}

  /** Monta o SessionContext (contrato) para o usuário do contexto. */
  async assemble(ctx: AuthenticatedRequestContext): Promise<SessionContext> {
    const user = await this.prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user) throw new ApiException('UNAUTHENTICATED', { message: 'Usuário não encontrado.' });

    const memberships = (await this.prisma.membership.findMany({
      where: { userId: user.id, status: { not: 'REVOKED' } },
      include: { organization: true, roles: { include: { role: true } } },
    })) as unknown as MembershipWithOrgAndRoles[];

    const visible = memberships.filter((m) => m.organization.status !== 'ARCHIVED');

    const contractMemberships: ContractMembership[] = visible.map((m) => ({
      id: m.id,
      userId: user.id,
      organizationId: m.organizationId,
      roleIds: m.roles.map((r) => r.role.key),
      status: membershipStatus(m.status),
    }));

    const organizations: OrganizationSummary[] = visible.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      status: m.organization.status === 'ACTIVE' ? 'active' : 'suspended',
    }));

    const activeOrganizationId = await this.resolveActiveOrganization(user.id, visible);
    const permissions = activeOrganizationId
      ? [...(await this.authz.getEffectivePermissions(user.id, activeOrganizationId))]
      : [];

    const session: SessionContext = {
      user: {
        id: user.id,
        email: user.email ?? '',
        displayName: user.displayName ?? user.email ?? 'Usuário',
        avatarUrl: user.avatarUrl ?? undefined,
        status: user.status === 'ACTIVE' ? 'active' : 'suspended',
      },
      organizations,
      memberships: contractMemberships,
      activeOrganizationId,
      permissions,
      expiresAt: ctx.identityExpiresAt,
      status: activeOrganizationId ? 'authenticated' : 'no_organization',
    };

    // Garante conformidade com o contrato compartilhado.
    return sessionContractSchema.parse(session);
  }

  async getSession(ctx: AuthenticatedRequestContext): Promise<SessionContext> {
    const session = await this.assemble(ctx);
    await this.audit.record({
      actorUserId: ctx.userId,
      organizationId: session.activeOrganizationId,
      action: 'session.loaded',
      resourceType: 'Session',
      resourceId: ctx.userId,
      outcome: 'SUCCESS',
      correlationId: ctx.correlationId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return session;
  }

  async refresh(ctx: AuthenticatedRequestContext): Promise<SessionContext> {
    // Recalcula a sessão interna; NÃO renova o token do provedor (fluxo do cliente).
    const session = await this.assemble(ctx);
    await this.audit.record({
      actorUserId: ctx.userId,
      organizationId: session.activeOrganizationId,
      action: 'session.refreshed',
      resourceType: 'Session',
      resourceId: ctx.userId,
      outcome: 'SUCCESS',
      correlationId: ctx.correlationId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return session;
  }

  async switchOrganization(
    ctx: AuthenticatedRequestContext,
    organizationId: string,
  ): Promise<SessionContext> {
    const access = await this.authz.authorizeOrganizationAccess(ctx.userId, organizationId);
    if (access.kind !== 'ok') {
      await this.audit.record({
        actorUserId: ctx.userId,
        organizationId,
        action: 'organization.selection_denied',
        resourceType: 'Organization',
        resourceId: organizationId,
        outcome: 'DENIED',
        reasonCode: access.kind.toUpperCase(),
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      // Mantém a organização anterior; não altera a preferência.
      throw this.accessError(access.kind);
    }

    await this.prisma.userSessionPreference.upsert({
      where: { userId: ctx.userId },
      create: { userId: ctx.userId, activeOrganizationId: organizationId },
      update: { activeOrganizationId: organizationId },
    });

    await this.audit.record({
      actorUserId: ctx.userId,
      organizationId,
      action: 'organization.selected',
      resourceType: 'Organization',
      resourceId: organizationId,
      outcome: 'SUCCESS',
      correlationId: ctx.correlationId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return this.assemble(ctx);
  }

  async logout(ctx: AuthenticatedRequestContext): Promise<void> {
    // A invalidação do access/refresh token é do provedor (Supabase). Aqui só
    // registramos o logout de forma idempotente.
    await this.audit.record({
      actorUserId: ctx.userId,
      action: 'session.logged_out',
      resourceType: 'Session',
      resourceId: ctx.userId,
      outcome: 'SUCCESS',
      correlationId: ctx.correlationId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  private async resolveActiveOrganization(
    userId: string,
    visible: MembershipWithOrgAndRoles[],
  ): Promise<string | null> {
    const activeOrgIds = visible
      .filter((m) => m.status === 'ACTIVE' && m.organization.status === 'ACTIVE')
      .map((m) => m.organizationId);
    if (activeOrgIds.length === 0) return null;

    const pref = await this.prisma.userSessionPreference.findUnique({ where: { userId } });
    if (pref?.activeOrganizationId && activeOrgIds.includes(pref.activeOrganizationId)) {
      return pref.activeOrganizationId;
    }
    return activeOrgIds[0];
  }

  private accessError(kind: string): ApiException {
    switch (kind) {
      case 'org_not_found':
      case 'no_membership':
        return new ApiException('RESOURCE_NOT_FOUND', { message: 'Organização não encontrada.' });
      case 'org_suspended':
        return new ApiException('ORGANIZATION_SUSPENDED', { message: 'Organização suspensa.' });
      case 'membership_suspended':
        return new ApiException('MEMBERSHIP_SUSPENDED', { message: 'Membership suspensa.' });
      default:
        return new ApiException('FORBIDDEN', { message: 'Acesso negado.' });
    }
  }
}

function membershipStatus(status: DbMembership['status']): ContractMembership['status'] {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'INVITED':
      return 'invited';
    default:
      return 'suspended';
  }
}
