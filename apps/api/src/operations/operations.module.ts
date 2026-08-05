/**
 * Arden.AS API — módulo de operações, versões e Gradiente de Autoridade
 * (ARDEN-BE-003). Importa AuthzModule (guards + contexto), IdempotencyModule
 * (comandos idempotentes) e AuditModule (gravação transacional de auditoria).
 */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { IdempotencyModule } from '../modules/idempotency/idempotency.module';
import { AuditModule } from '../audit/audit.module';
import { OperationsController } from './operations.controller';
import { OperationVersionsController } from './operation-versions.controller';
import { AuthorityController } from './authority.controller';
import { OperationsService } from './operations.service';
import { OperationVersionsService } from './operation-versions.service';
import { OperationsRepository } from './operations.repository';
import { OperationVersionsRepository } from './operation-versions.repository';
import { OperationPublicationValidator } from './publication.validator';

@Module({
  imports: [AuthzModule, IdempotencyModule, AuditModule],
  controllers: [OperationsController, OperationVersionsController, AuthorityController],
  providers: [
    OperationsService,
    OperationVersionsService,
    OperationsRepository,
    OperationVersionsRepository,
    OperationPublicationValidator,
  ],
})
export class OperationsModule {}
