/**
 * Arden.AS API — provisionamento JIT de usuário (ARDEN-BE-002).
 *
 * No primeiro acesso válido, cria o usuário interno a partir de
 * (provider, subject) — a IDENTIDADE ESTÁVEL. Mudança de e-mail NÃO cria novo
 * usuário; o subject é imutável. Não cria organização/membership automaticamente;
 * não concede papel de admin; não usa domínio do e-mail para vincular a org.
 */

import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityAuditService } from './identity-audit.service';
import type { VerifiedIdentity } from './identity.types';

@Injectable()
export class UserProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IdentityAuditService,
  ) {}

  /**
   * Localiza o usuário por (provider, subject); cria no primeiro acesso. Atualiza
   * perfil básico (e-mail/nome) e `lastAuthenticatedAt`. Retorna o usuário e se
   * foi recém-provisionado.
   */
  async findOrProvision(
    identity: VerifiedIdentity,
    ctx: { correlationId: string; ipAddress: string | null; userAgent: string | null },
  ): Promise<{ user: User; provisioned: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: {
        uniq_external_identity: {
          externalProvider: identity.provider,
          externalSubject: identity.subject,
        },
      },
    });

    if (existing) {
      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          // Atualiza perfil básico; o subject NUNCA muda.
          email: identity.email ?? existing.email,
          displayName: existing.displayName ?? this.deriveName(identity),
          lastAuthenticatedAt: new Date(),
        },
      });
      return { user, provisioned: false };
    }

    const created = await this.prisma.user.create({
      data: {
        externalProvider: identity.provider,
        externalSubject: identity.subject,
        email: identity.email,
        displayName: this.deriveName(identity),
        status: 'ACTIVE',
        lastAuthenticatedAt: new Date(),
      },
    });

    await this.audit.record({
      actorUserId: created.id,
      action: 'identity.user_provisioned',
      resourceType: 'User',
      resourceId: created.id,
      outcome: 'SUCCESS',
      correlationId: ctx.correlationId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { provider: identity.provider },
    });

    return { user: created, provisioned: true };
  }

  private deriveName(identity: VerifiedIdentity): string | null {
    const claimName = identity.claims['display_name'] ?? identity.claims['name'];
    if (typeof claimName === 'string' && claimName.trim()) return claimName;
    return identity.email ? identity.email.split('@')[0] : null;
  }
}
