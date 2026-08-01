/**
 * Arden.AS API — módulo de políticas de governança (ARDEN-BE-004).
 */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { IdempotencyModule } from '../modules/idempotency/idempotency.module';
import { AuditModule } from '../audit/audit.module';
import { PoliciesController } from './policies.controller';
import { PolicyBindingsController } from './bindings.controller';
import { PoliciesService } from './policies.service';
import { PoliciesRepository } from './policies.repository';

@Module({
  imports: [AuthzModule, IdempotencyModule, AuditModule],
  controllers: [PoliciesController, PolicyBindingsController],
  providers: [PoliciesService, PoliciesRepository],
  exports: [PoliciesService, PoliciesRepository],
})
export class PoliciesModule {}
