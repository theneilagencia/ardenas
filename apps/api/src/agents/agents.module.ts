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

// Runtime determinístico (ARDEN-BE-007.3): sem SDK, sem internet, sem execução direta.
import { AGENT_RUNTIME } from '@arden/contracts';
import { InternalTestModelProvider } from './runtime/internal-test-model.provider';
import { InMemoryModelProviderRegistry } from './runtime/model-provider-registry';
import { AgentOutputValidatorV1 } from './runtime/agent-output-validator';
import { AgentEvaluatorV1 } from './runtime/agent-evaluator';
import { AgentRuntimeResolverService } from './runtime/agent-runtime-resolver';
import { AgentRuntimeService } from './runtime/agent-runtime';

// Pipeline de contexto v2 (ARDEN-BE-007.4): fontes tenant-scoped, guardrails, orçamento.
import { AGENT_CONTEXT_SOURCE_RESOLVER } from './runtime/context/agent-context.types';
import { AgentContextSourceResolverService } from './runtime/context/agent-context-source-resolver';
import { AgentContextNormalizer } from './runtime/context/agent-context-normalizer';
import { AgentContextTrustClassifier } from './runtime/context/agent-context-trust-classifier';
import { PromptInjectionGuard } from './runtime/context/prompt-injection-guard';
import { AgentContextBudgetAllocator } from './runtime/context/agent-context-budget-allocator';
import { AgentContextAssemblerV2 } from './runtime/context/agent-context-assembler-v2';

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
    // Runtime determinístico + provider interno + registry + validador/avaliador/resolver.
    InternalTestModelProvider,
    InMemoryModelProviderRegistry,
    AgentOutputValidatorV1,
    AgentEvaluatorV1,
    AgentRuntimeResolverService,
    // Pipeline de contexto v2 (007.4).
    AgentContextNormalizer,
    AgentContextTrustClassifier,
    PromptInjectionGuard,
    AgentContextBudgetAllocator,
    AgentContextSourceResolverService,
    { provide: AGENT_CONTEXT_SOURCE_RESOLVER, useExisting: AgentContextSourceResolverService },
    AgentContextAssemblerV2,
    AgentRuntimeService,
    { provide: AGENT_RUNTIME, useExisting: AgentRuntimeService },
  ],
  exports: [
    ModelProviderCatalogProjector,
    // Expostos ao motor de execução (ExecutionsModule) — sem ciclo (AgentsModule não
    // importa ExecutionsModule).
    AGENT_RUNTIME,
    AgentDefinitionsRepository,
  ],
})
export class AgentsModule {}
