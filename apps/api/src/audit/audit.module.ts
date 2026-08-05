/**
 * Arden.AS API — módulo de auditoria de operações (ARDEN-BE-003).
 * Exporta `AuditRecorder` (gravação transacional interna) e serve os endpoints de
 * leitura. Importa `AuthzModule` (guards + contexto).
 */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRecorder } from './audit.recorder';

@Module({
  imports: [AuthzModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRecorder],
  exports: [AuditRecorder],
})
export class AuditModule {}
