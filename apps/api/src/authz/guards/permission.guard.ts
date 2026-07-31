/**
 * Arden.AS API — PermissionGuard (ARDEN-BE-002).
 * Exige a permissão declarada por `@RequirePermission`, contra as permissões
 * EFETIVAS calculadas pelo backend. Audita a negação.
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../../common/errors/api-error';
import { IdentityAuditService } from '../../identity/identity-audit.service';
import { getContext } from '../../identity/request-context';
import { IS_PUBLIC_KEY, REQUIRE_PERMISSION_KEY } from '../decorators';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: IdentityAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const permission = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, targets);
    if (!permission) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const ctx = getContext(req);
    if (!ctx) throw new ApiException('UNAUTHENTICATED', { message: 'Sessão ausente.' });

    if (!ctx.permissions.has(permission)) {
      await this.audit.record({
        actorUserId: ctx.userId,
        organizationId: ctx.organizationId,
        action: 'permission.access_denied',
        resourceType: 'Permission',
        resourceId: permission,
        outcome: 'DENIED',
        reasonCode: permission,
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      throw new ApiException('FORBIDDEN', { message: 'Permissão insuficiente.' });
    }
    return true;
  }
}
