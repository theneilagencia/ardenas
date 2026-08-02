/**
 * Arden.AS API — módulo de execução (ARDEN-BE-005).
 * Expõe os endpoints de criação/comando/consulta e provê o worker (processo
 * lógico separado) que processa os jobs da fila durável.
 */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../modules/idempotency/idempotency.module';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { ExecutionsRepository } from './executions.repository';
import { ExecutionRecorder } from './execution.recorder';
import { ExecutionQueue } from './execution.queue';
import { ExecutionProcessor } from './execution.processor';
import { ExecutionWorker } from './execution.worker';
import { ExternalToolStepExecutor } from './external-tool-step.executor';
import { StepExecutorRegistry } from './step-executor-registry';

@Module({
  // ConnectorsModule fornece o ExternalToolExecutor/resolvers (ARDEN-BE-006.6). O
  // worker roteia por action key registrada — nunca por classe vinda do banco.
  imports: [AuthzModule, AuditModule, IdempotencyModule, EnforcementModule, ConnectorsModule],
  controllers: [ExecutionsController],
  providers: [
    ExecutionsService, ExecutionsRepository, ExecutionRecorder, ExecutionQueue, ExecutionProcessor, ExecutionWorker,
    ExternalToolStepExecutor, StepExecutorRegistry,
  ],
  exports: [ExecutionWorker, ExecutionQueue, ExecutionsRepository],
})
export class ExecutionsModule {}
