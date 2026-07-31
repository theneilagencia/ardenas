/**
 * Arden.AS API — ActiveUserGuard (ARDEN-BE-002).
 * Bloqueia usuários suspensos/desativados (revalidado a cada requisição).
 */

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../../common/errors/api-error';
import { PrismaService } from '../../database/prisma.service';
import { IdentityAuditService } from '../../identity/identity-audit.service';
import { getContext } from '../../identity/request-context';
import { IS_PUBLIC_KEY } from '../decorators';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly audit: IdentityAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const ctx = getContext(req);
    if (!ctx) throw new ApiException('UNAUTHENTICATED', { message: 'Sessão ausente.' });

    const user = await this.prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!user || user.status !== 'ACTIVE') {
      await this.audit.record({
        actorUserId: ctx.userId,
        action: 'access.denied',
        resourceType: 'User',
        resourceId: ctx.userId,
        outcome: 'DENIED',
        reasonCode: user ? `USER_${user.status}` : 'USER_NOT_FOUND',
        correlationId: ctx.correlationId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
      throw new ApiException('FORBIDDEN', { message: 'Usuário suspenso.' });
    }
    return true;
  }
}
