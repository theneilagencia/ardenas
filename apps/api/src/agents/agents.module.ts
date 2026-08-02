/**
 * Arden.AS API — módulo do runtime de agentes (ARDEN-BE-007.2).
 *
 * APENAS persistência e lifecycle administrativo. SEM runtime de LLM, SDK,
 * AgentStepExecutor, worker ou execução direta. Reutiliza Authz/Audit/Idempotency.
 */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../modules/idempotency/idempotency.module';

import { ModelProviderDefinitionsRepository } from './providers/model-providers.repository';
import { ModelProvidersService } from './providers/model-providers.service';
import { ModelProvidersController } from './providers/model-providers.controller';
import { ModelProviderCatalogProjector } from './providers/model-provider-catalog.projector';

import { ModelConfigurationsRepository } from './model-configurations/model-configurations.repository';
import { ModelConfigurationsService } from './model-configurations/model-configurations.service';
import { ModelConfigurationsController } from './model-configurations/model-configurations.controller';

import { AgentDefinitionsRepository } from './agents/agent-definitions.repository';
import { AgentsService } from './agents/agents.service';
import { AgentsController } from './agents/agents.controller';

import { AgentVersionsRepository } from './versions/agent-versions.repository';
import { AgentVersionsService } from './versions/agent-versions.service';
import { AgentVersionsController } from './versions/agent-versions.controller';

@Module({
  imports: [AuthzModule, AuditModule, IdempotencyModule],
  controllers: [
    ModelProvidersController,
    ModelConfigurationsController,
    AgentsController,
    AgentVersionsController,
  ],
  providers: [
    ModelProviderDefinitionsRepository,
    ModelProvidersService,
    ModelProviderCatalogProjector,
    ModelConfigurationsRepository,
    ModelConfigurationsService,
    AgentDefinitionsRepository,
    AgentsService,
    AgentVersionsRepository,
    AgentVersionsService,
  ],
  exports: [ModelProviderCatalogProjector],
})
export class AgentsModule {}
