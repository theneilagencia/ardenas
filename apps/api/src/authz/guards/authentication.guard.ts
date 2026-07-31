/**
 * Arden.AS API — AuthenticationGuard (ARDEN-BE-002).
 * Verifica o Bearer token pelo IdentityProvider, provisiona o usuário (JIT) e
 * inicia o contexto de requisição. Audita autenticação/falha.
 */

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../../common/errors/api-error';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../../identity/identity.types';
import { UserProvisioningService } from '../../identity/user-provisioning.service';
import { IdentityAuditService } from '../../identity/identity-audit.service';
import { attachContext } from '../../identity/request-context';
import { IS_PUBLIC_KEY } from '../decorators';
import {
  extractBearerToken,
  requestCorrelationId,
  requestIp,
  requestUserAgent,
} from '../request-info';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProvider,
    private readonly provisioning: UserProvisioningService,
    private readonly audit: IdentityAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const correlationId = requestCorrelationId(req);
    const ipAddress = requestIp(req);
    const userAgent = requestUserAgent(req);

    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      await this.audit.record({
        action: 'identity.authentication_failed',
        resourceType: 'Session',
        outcome: 'FAILURE',
        reasonCode: 'MISSING_TOKEN',
        correlationId,
        ipAddress,
        userAgent,
      });
      throw new ApiException('UNAUTHENTICATED', { message: 'Token ausente.' });
    }

    let identity;
    try {
      identity = await this.provider.verifyAccessToken(token);
    } catch (err) {
      const reasonCode =
        err instanceof ApiException && err.code === 'SESSION_EXPIRED' ? 'EXPIRED' : 'INVALID';
      await this.audit.record({
        action: 'identity.authentication_failed',
        resourceType: 'Session',
        outcome: 'FAILURE',
        reasonCode,
        correlationId,
        ipAddress,
        userAgent,
      });
      throw err;
    }

    const { user } = await this.provisioning.findOrProvision(identity, {
      correlationId,
      ipAddress,
      userAgent,
    });

    attachContext(req, {
      correlationId,
      userId: user.id,
      externalSubject: identity.subject,
      organizationId: null,
      membershipId: null,
      permissions: new Set<string>(),
      ipAddress,
      userAgent,
      identityExpiresAt: identity.expiresAt,
    });

    await this.audit.record({
      actorUserId: user.id,
      action: 'identity.authenticated',
      resourceType: 'Session',
      resourceId: user.id,
      outcome: 'SUCCESS',
      correlationId,
      ipAddress,
      userAgent,
    });

    return true;
  }
}
