/**
 * Arden.AS API — módulo de aprovações (ARDEN-BE-004).
 * Fluxos, solicitações/decisões e delegações. Depende do EnforcementModule para
 * reavaliar a ação na criação e emitir a autorização na aprovação.
 */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { IdempotencyModule } from '../modules/idempotency/idempotency.module';
import { AuditModule } from '../audit/audit.module';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { ApprovalsRepository } from './approvals.repository';
import { ApprovalFlowsService } from './flows.service';
import { ApprovalFlowsController } from './flows.controller';
import { ApprovalRequestsService } from './requests.service';
import { ApprovalRequestsController } from './requests.controller';
import { ApprovalDelegationsService } from './delegations.service';
import { ApprovalDelegationsController } from './delegations.controller';

@Module({
  imports: [AuthzModule, IdempotencyModule, AuditModule, EnforcementModule],
  controllers: [ApprovalFlowsController, ApprovalRequestsController, ApprovalDelegationsController],
  providers: [ApprovalsRepository, ApprovalFlowsService, ApprovalRequestsService, ApprovalDelegationsService],
  exports: [ApprovalsRepository],
})
export class ApprovalsModule {}
