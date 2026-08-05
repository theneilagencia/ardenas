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
import { AgentsModule } from '../agents/agents.module';
import { SecurityModule } from '../security/security.module';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { ExecutionsRepository } from './executions.repository';
import { ExecutionRecorder } from './execution.recorder';
import { ExecutionQueue } from './execution.queue';
import { ExecutionProcessor } from './execution.processor';
import { ExecutionWorker } from './execution.worker';
import { ExternalToolStepExecutor } from './external-tool-step.executor';
import { AgentStepExecutor } from './agent-step.executor';
import { StepExecutorRegistry } from './step-executor-registry';

@Module({
  // ConnectorsModule fornece o ExternalToolExecutor (ARDEN-BE-006.6); AgentsModule fornece
  // o AGENT_RUNTIME (ARDEN-BE-007.3). O worker roteia por action key registrada — nunca por
  // classe vinda do banco. AgentsModule NÃO importa ExecutionsModule (sem ciclo).
  imports: [AuthzModule, AuditModule, IdempotencyModule, EnforcementModule, ConnectorsModule, AgentsModule, SecurityModule],
  controllers: [ExecutionsController],
  providers: [
    ExecutionsService, ExecutionsRepository, ExecutionRecorder, ExecutionQueue, ExecutionProcessor, ExecutionWorker,
    ExternalToolStepExecutor, AgentStepExecutor, StepExecutorRegistry,
  ],
  exports: [ExecutionWorker, ExecutionQueue, ExecutionsRepository, ExecutionsService],
})
export class ExecutionsModule {}
