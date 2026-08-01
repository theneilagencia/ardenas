/**
 * Arden.AS API — módulo de enforcement de autoridade (ARDEN-BE-004).
 * Exporta o EnforcementService para o módulo de aprovações (avaliar + emitir
 * autorização na transação de aprovação).
 */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { AuditModule } from '../audit/audit.module';
import { EnforcementController } from './enforcement.controller';
import { EnforcementService } from './enforcement.service';
import { EnforcementRepository } from './enforcement.repository';

@Module({
  imports: [AuthzModule, AuditModule],
  controllers: [EnforcementController],
  providers: [EnforcementService, EnforcementRepository],
  exports: [EnforcementService, EnforcementRepository],
})
export class EnforcementModule {}
