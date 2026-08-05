/**
 * Arden.AS API — OrganizationGuard (ARDEN-BE-002).
 *
 * Resolve a organização ativa a partir do PATH (`:organizationId`), valida
 * organização/membership e calcula as permissões. O path identifica o tenant, mas
 * NÃO autoriza. Sem membership/organização inexistente → 404 (anti-enumeração);
 * suspensões → erro específico. Audita as negações.
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../../common/errors/api-error';
import { AuthorizationService } from '../authorization.service';
import { IdentityAuditService } from '../../identity/identity-audit.service';
import { attachContext, getContext } from '../../identity/request-context';
import { IS_PUBLIC_KEY, REQUIRE_ORG_KEY } from '../decorators';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthorizationService,
    private readonly audit: IdentityAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const params = (req.params ?? {}) as Record<string, string | undefined>;
    // Tenant do PATH ou, para rotas system-managed sem :organizationId (ex.: catálogo),
    // do header `X-Arden-Organization` (a org ATIVA da sessão; nunca digitada pelo user).
    const headerOrg = (req.headers['x-arden-organization'] as string | undefined) || undefined;
    const organizationId = params.organizationId ?? headerOrg;
    const requireOrg = this.reflector.getAllAndOverride<boolean>(REQUIRE_ORG_KEY, targets);

    // Rota não organizacional e sem tenant informado: nada a resolver.
    if (!organizationId && !requireOrg) return true;

    const ctx = getContext(req);
    if (!ctx) throw new ApiException('UNAUTHENTICATED', { message: 'Sessão ausente.' });
    if (!organizationId) throw new ApiException('ORGANIZATION_REQUIRED', { message: 'Organização requerida.' });

    const access = await this.authz.authorizeOrganizationAccess(ctx.userId, organizationId);

    const deny = async (action: string, reasonCode: string) =>
      this.audit.record({
        actorUserId: ctx.userId,
        organizationId,
        action,
        resourceType: 'Organization',
        resourceId: organizationId,
        outcome: 'DENIED',
        reasonCode,
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

    switch (access.kind) {
      case 'org_not_found':
        await deny('organization.access_denied', 'ORG_NOT_FOUND');
        throw new ApiException('RESOURCE_NOT_FOUND', { message: 'Organização não encontrada.' });
      case 'no_membership':
        // Anti-enumeração: não revela a existência da organização.
        await deny('membership.access_denied', 'MEMBERSHIP_REQUIRED');
        throw new ApiException('RESOURCE_NOT_FOUND', { message: 'Organização não encontrada.' });
      case 'user_suspended':
        await deny('access.denied', 'USER_SUSPENDED');
        throw new ApiException('FORBIDDEN', { message: 'Usuário suspenso.' });
      case 'org_suspended':
        await deny('organization.access_denied', 'ORGANIZATION_SUSPENDED');
        throw new ApiException('ORGANIZATION_SUSPENDED', { message: 'Organização suspensa.' });
      case 'membership_suspended':
        await deny('membership.access_denied', 'MEMBERSHIP_SUSPENDED');
        throw new ApiException('MEMBERSHIP_SUSPENDED', { message: 'Membership suspensa.' });
      case 'ok':
        attachContext(req, {
          ...ctx,
          organizationId,
          membershipId: access.membershipId,
          permissions: access.permissions,
        });
        return true;
    }
  }
}
