/**
 * Arden.AS API — endpoints organizacionais mínimos (ARDEN-BE-002).
 * Sem criação pública, convites, exclusão ou administração completa (fora do
 * escopo). O bootstrap administrativo ocorre por CLI.
 */

import { Controller, Get, Param } from '@nestjs/common';
import type { Membership as ContractMembership, OrganizationSummary } from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  /** Somente organizações acessíveis pelo usuário. */
  @Get()
  async list(
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ): Promise<{ data: OrganizationSummary[] }> {
    return { data: await this.organizations.listForUser(ctx.userId) };
  }

  @Get(':organizationId')
  @RequireOrganization()
  @RequirePermission('organization.view')
  async getOne(
    @Param('organizationId') organizationId: string,
  ): Promise<{ data: OrganizationSummary }> {
    // O OrganizationGuard já validou o acesso e resolveu o contexto.
    return { data: await this.organizations.getSummary(organizationId) };
  }

  @Get(':organizationId/memberships/me')
  @RequireOrganization()
  async myMembership(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Param('organizationId') organizationId: string,
  ): Promise<{ data: ContractMembership }> {
    return { data: await this.organizations.myMembership(ctx.userId, organizationId) };
  }
}
