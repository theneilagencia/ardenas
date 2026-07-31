/**
 * Arden.AS API — autorização server-side (ARDEN-BE-002).
 *
 * Permissões EFETIVAS = usuário ativo + organização ativa + membership ativa +
 * papéis ativos + permissões dos papéis. Se qualquer condição falhar → conjunto
 * vazio (negar). NUNCA confia em permissões enviadas pelo frontend.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ApiException } from '../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../identity/request-context';

export interface MembershipResolution {
  membershipId: string;
  permissions: Set<string>;
}

/**
 * Resultado detalhado de acesso organizacional (para decisões de erro/auditoria
 * seguras contra enumeração). `no_membership`/`org_not_found` → 404; suspensões →
 * 403 específico (o usuário já tem relação com a organização).
 */
export type OrgAccess =
  | { kind: 'ok'; membershipId: string; permissions: Set<string> }
  | { kind: 'org_not_found' }
  | { kind: 'user_suspended' }
  | { kind: 'no_membership' }
  | { kind: 'org_suspended' }
  | { kind: 'membership_suspended' };

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a membership ATIVA e as permissões efetivas para (usuário, organização).
   * Retorna `null` quando não há acesso (usuário/org/membership inativos ou
   * inexistentes) — o chamador decide a negação/auditoria.
   */
  async resolveMembership(
    userId: string,
    organizationId: string,
  ): Promise<MembershipResolution | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { uniq_membership: { userId, organizationId } },
      include: {
        user: true,
        organization: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!membership) return null;
    if (membership.status !== 'ACTIVE') return null;
    if (membership.user.status !== 'ACTIVE') return null;
    if (membership.organization.status !== 'ACTIVE') return null;

    const permissions = new Set<string>();
    for (const link of membership.roles) {
      if (link.role.status !== 'ACTIVE') continue;
      for (const rp of link.role.permissions) permissions.add(rp.permission.key);
    }
    return { membershipId: membership.id, permissions };
  }

  /** Decisão detalhada de acesso a uma organização (para guards). */
  async authorizeOrganizationAccess(userId: string, organizationId: string): Promise<OrgAccess> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return { kind: 'org_not_found' };

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') return { kind: 'user_suspended' };

    const membership = await this.prisma.membership.findUnique({
      where: { uniq_membership: { userId, organizationId } },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    // Sem relação: não revela a existência da organização (anti-enumeração).
    if (!membership) return { kind: 'no_membership' };
    if (org.status !== 'ACTIVE') return { kind: 'org_suspended' };
    if (membership.status !== 'ACTIVE') return { kind: 'membership_suspended' };

    const permissions = new Set<string>();
    for (const link of membership.roles) {
      if (link.role.status !== 'ACTIVE') continue;
      for (const rp of link.role.permissions) permissions.add(rp.permission.key);
    }
    return { kind: 'ok', membershipId: membership.id, permissions };
  }

  async getEffectivePermissions(userId: string, organizationId: string): Promise<Set<string>> {
    const resolved = await this.resolveMembership(userId, organizationId);
    return resolved?.permissions ?? new Set<string>();
  }

  hasPermission(context: AuthenticatedRequestContext, permission: string): boolean {
    return context.permissions.has(permission);
  }

  requirePermission(context: AuthenticatedRequestContext, permission: string): void {
    if (!this.hasPermission(context, permission)) {
      throw new ApiException('FORBIDDEN', { message: 'Permissão insuficiente.' });
    }
  }
}
