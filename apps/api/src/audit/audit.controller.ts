/**
 * Arden.AS API — endpoints de auditoria (ARDEN-BE-003). SOMENTE LEITURA.
 * `GET /organizations/{organizationId}/audit-events` (lista, cursor + filtros) e
 * `GET .../audit-events/{eventId}` (detalhe). Exige `audit.view` e tenant válido.
 */

import { Controller, Get, Param, Query } from '@nestjs/common';
import { listAuditEventsQuery, type AuditEvent } from '@arden/contracts';
import { RequireOrganization, RequirePermission } from '../authz/decorators';
import { CurrentContext } from '../identity/request-context';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AuditService, type AuditListResult } from './audit.service';

@Controller('organizations/:organizationId/audit-events')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequireOrganization()
  @RequirePermission('audit.view')
  async list(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Query(new ZodValidationPipe(listAuditEventsQuery)) query: ReturnType<typeof listAuditEventsQuery.parse>,
  ): Promise<AuditListResult> {
    return this.audit.list(ctx, query);
  }

  @Get(':eventId')
  @RequireOrganization()
  @RequirePermission('audit.view')
  async get(
    @Param('eventId') eventId: string,
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ): Promise<{ data: AuditEvent }> {
    return { data: await this.audit.get(ctx, eventId) };
  }
}
