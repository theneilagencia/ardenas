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
import { ConnectorsModule } from '../connectors/connectors.module';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ExecutionRecorder } from '../executions/execution.recorder';

import { ModelProviderDefinitionsRepository } from './providers/model-providers.repository';
import { ModelProvidersService } from './providers/model-providers.service';
import { ModelProvidersController } from './providers/model-providers.controller';
import { ModelProviderCatalogProjector } from './providers/model-provider-catalog.projector';
import { ModelCatalogProjector, ModelCatalogRepository } from './providers/project-model-catalog';

import { ModelConfigurationsRepository } from './model-configurations/model-configurations.repository';
import { ModelConfigurationsService } from './model-configurations/model-configurations.service';
import { AnthropicConfigurationValidationService } from './model-configurations/anthropic-configuration-validation.service';
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

// Tool calling funcional (ARDEN-BE-007.5): reutiliza BE-006 (executor/binding) + BE-004
// (autoridade/aprovação/ActionAuthorization). Sem provider comercial, sem internet.
import { AgentToolBindingResolver } from './runtime/tools/agent-tool-binding-resolver';
import { AgentToolCallValidator } from './runtime/tools/agent-tool-call-validator';
import { AgentToolAuthorityEvaluator } from './runtime/tools/agent-tool-authority-evaluator';
import { AgentToolExecutor } from './runtime/tools/agent-tool-executor';
import { AgentToolApprovalService } from './runtime/tools/agent-tool-approval.service';
import { AgentRuntimeCheckpointRepository } from './runtime/tools/agent-runtime-checkpoint.repository';

// Avaliação final, usage, custo, governança e observabilidade (ARDEN-BE-007.6).
import { AgentUsageAggregator } from './governance/agent-usage-aggregator';
import { AgentCostEstimator } from './governance/agent-cost-estimator';
import { AgentEvaluationEngine } from './governance/agent-evaluation-engine';
import { AgentGovernanceEvaluator } from './governance/agent-governance-evaluator';
import { AgentMetrics } from './governance/agent-metrics';
import { RateCardCatalogProjector, ModelRateCardsRepository } from './governance/rate-card.projector';
import { AgentOperationalResultRecorder } from './governance/agent-operational-result.recorder';
import { AgentResultsService } from './governance/agent-results.service';
import { AgentResultsController } from './governance/agent-results.controller';

@Module({
  imports: [AuthzModule, AuditModule, IdempotencyModule, ConnectorsModule, EnforcementModule, ApprovalsModule],
  controllers: [
    ModelProvidersController,
    ModelConfigurationsController,
    AgentsController,
    AgentVersionsController,
    AgentResultsController,
  ],
  providers: [
    ModelProviderDefinitionsRepository,
    ModelProvidersService,
    ModelProviderCatalogProjector,
    ModelCatalogProjector,
    ModelCatalogRepository,
    ModelConfigurationsRepository,
    ModelConfigurationsService,
    AnthropicConfigurationValidationService,
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
    // Tool calling funcional (007.5).
    ExecutionRecorder,
    AgentToolBindingResolver,
    AgentToolCallValidator,
    AgentToolAuthorityEvaluator,
    AgentToolExecutor,
    AgentToolApprovalService,
    AgentRuntimeCheckpointRepository,
    AgentRuntimeService,
    { provide: AGENT_RUNTIME, useExisting: AgentRuntimeService },
    // Avaliação/usage/custo/governança/observabilidade (007.6).
    AgentUsageAggregator,
    AgentCostEstimator,
    AgentEvaluationEngine,
    AgentGovernanceEvaluator,
    AgentMetrics,
    RateCardCatalogProjector,
    ModelRateCardsRepository,
    AgentOperationalResultRecorder,
    AgentResultsService,
  ],
  exports: [
    ModelProviderCatalogProjector,
    ModelCatalogProjector,
    RateCardCatalogProjector,
    // Expostos ao motor de execução (ExecutionsModule) — sem ciclo (AgentsModule não
    // importa ExecutionsModule).
    AGENT_RUNTIME,
    AgentDefinitionsRepository,
    AgentOperationalResultRecorder,
  ],
})
export class AgentsModule {}
