/**
 * Arden.AS API — organizações (ARDEN-BE-002).
 * Lista SOMENTE organizações acessíveis pelo usuário (membership não revogada,
 * organização não arquivada). Mapeia para os contratos compartilhados.
 */

import { Injectable } from '@nestjs/common';
import type { Membership as DbMembership, Organization as DbOrg } from '@prisma/client';
import type { Membership as ContractMembership, OrganizationSummary } from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { ApiException } from '../common/errors/api-error';

export function toOrganizationSummary(org: DbOrg): OrganizationSummary {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status === 'ACTIVE' ? 'active' : 'suspended',
  };
}

export function toMembershipStatus(status: DbMembership['status']): ContractMembership['status'] {
  if (status === 'ACTIVE') return 'active';
  if (status === 'INVITED') return 'invited';
  return 'suspended';
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: { not: 'REVOKED' } },
      include: { organization: true },
    });
    return memberships
      .filter((m) => m.organization.status !== 'ARCHIVED')
      .map((m) => toOrganizationSummary(m.organization));
  }

  async getSummary(organizationId: string): Promise<OrganizationSummary> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new ApiException('RESOURCE_NOT_FOUND', { message: 'Organização não encontrada.' });
    return toOrganizationSummary(org);
  }

  async myMembership(userId: string, organizationId: string): Promise<ContractMembership> {
    const membership = await this.prisma.membership.findUnique({
      where: { uniq_membership: { userId, organizationId } },
      include: { roles: { include: { role: true } } },
    });
    if (!membership) {
      throw new ApiException('RESOURCE_NOT_FOUND', { message: 'Membership não encontrada.' });
    }
    return {
      id: membership.id,
      userId,
      organizationId,
      roleIds: membership.roles.map((r) => r.role.key),
      status: toMembershipStatus(membership.status),
    };
  }
}
