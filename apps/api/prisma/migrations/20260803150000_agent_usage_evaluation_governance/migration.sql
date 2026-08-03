-- ARDEN-BE-007.6 — resultado operacional, usage, custo estimado, rollups e rate cards.
-- Migration CORRETIVA e aditiva: só cria novos enums e tabelas. Não altera migrations
-- anteriores nem tabelas existentes. Sem cascade destrutivo.

-- CreateEnum
CREATE TYPE "AgentResultStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'SUSPENDED', 'REQUIRES_APPROVAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AgentOutputValidationStatus" AS ENUM ('VALID', 'INVALID', 'NOT_AVAILABLE');

-- CreateEnum
CREATE TYPE "AgentEvaluationStatus" AS ENUM ('PASSED', 'FAILED', 'PARTIAL', 'NOT_RUN');

-- CreateEnum
CREATE TYPE "AgentGovernanceStatus" AS ENUM ('WITHIN_LIMITS', 'LIMIT_WARNING', 'LIMIT_EXCEEDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AgentModelCallPurpose" AS ENUM ('PRIMARY', 'OUTPUT_REPAIR', 'TOOL_CONTINUATION', 'EVALUATION');

-- CreateEnum
CREATE TYPE "ModelRateCardStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AgentUsageRollupDimension" AS ENUM ('ORGANIZATION', 'OPERATION', 'OPERATION_VERSION', 'AGENT_DEFINITION', 'AGENT_VERSION', 'MODEL_CONFIGURATION', 'PROVIDER', 'MODEL');















-- CreateTable
CREATE TABLE "agent_execution_results" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_run_id" UUID NOT NULL,
    "execution_step_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "operation_version_id" UUID NOT NULL,
    "agent_definition_id" UUID NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "status" "AgentResultStatus" NOT NULL,
    "output_validation_status" "AgentOutputValidationStatus" NOT NULL DEFAULT 'NOT_AVAILABLE',
    "evaluation_status" "AgentEvaluationStatus" NOT NULL DEFAULT 'NOT_RUN',
    "governance_status" "AgentGovernanceStatus" NOT NULL DEFAULT 'WITHIN_LIMITS',
    "output_hash" TEXT,
    "context_hash" TEXT,
    "model_call_count" INTEGER NOT NULL DEFAULT 0,
    "tool_call_count" INTEGER NOT NULL DEFAULT 0,
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "repair_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "approval_count" INTEGER NOT NULL DEFAULT 0,
    "security_signal_count" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_minor" BIGINT,
    "currency" TEXT,
    "rate_card_id" UUID,
    "provider_key" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "evaluation_summary" JSONB NOT NULL DEFAULT '{}',
    "governance_summary" JSONB NOT NULL DEFAULT '{}',
    "evidence_reference_ids" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_execution_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_model_call_usage" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_run_id" UUID NOT NULL,
    "execution_step_id" UUID NOT NULL,
    "agent_definition_id" UUID NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "model_configuration_id" UUID NOT NULL,
    "provider_key" TEXT NOT NULL,
    "provider_version" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "call_index" INTEGER NOT NULL,
    "purpose" "AgentModelCallPurpose" NOT NULL DEFAULT 'PRIMARY',
    "status" TEXT NOT NULL,
    "finish_reason" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_minor" BIGINT,
    "currency" TEXT,
    "rate_card_id" UUID,
    "request_hash" TEXT,
    "response_hash" TEXT,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_model_call_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tool_call_usage" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_run_id" UUID NOT NULL,
    "execution_step_id" UUID NOT NULL,
    "agent_definition_id" UUID NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "tool_call_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "authorization_id" UUID,
    "approval_request_id" UUID,
    "input_hash" TEXT,
    "output_hash" TEXT,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "agent_tool_call_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_usage_rollups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dimension_type" "AgentUsageRollupDimension" NOT NULL,
    "dimension_id" TEXT NOT NULL,
    "period_date" DATE NOT NULL,
    "provider_key" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "execution_count" INTEGER NOT NULL DEFAULT 0,
    "succeeded_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "suspended_count" INTEGER NOT NULL DEFAULT 0,
    "unknown_count" INTEGER NOT NULL DEFAULT 0,
    "model_call_count" INTEGER NOT NULL DEFAULT 0,
    "tool_call_count" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" BIGINT NOT NULL DEFAULT 0,
    "output_tokens" BIGINT NOT NULL DEFAULT 0,
    "estimated_cost_minor" BIGINT NOT NULL DEFAULT 0,
    "duration_ms" BIGINT NOT NULL DEFAULT 0,
    "approval_count" INTEGER NOT NULL DEFAULT 0,
    "critical_signal_count" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_usage_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_rate_cards" (
    "id" UUID NOT NULL,
    "provider_key" TEXT NOT NULL,
    "provider_version" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "input_cost_per_million_tokens_minor" BIGINT NOT NULL DEFAULT 0,
    "output_cost_per_million_tokens_minor" BIGINT NOT NULL DEFAULT 0,
    "cached_input_cost_per_million_tokens_minor" BIGINT NOT NULL DEFAULT 0,
    "cached_output_cost_per_million_tokens_minor" BIGINT NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMPTZ(6),
    "status" "ModelRateCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "catalog_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_execution_results_execution_step_id_key" ON "agent_execution_results"("execution_step_id");

-- CreateIndex
CREATE INDEX "agent_execution_results_organization_id_status_created_at_idx" ON "agent_execution_results"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "agent_execution_results_organization_id_agent_definition_id_idx" ON "agent_execution_results"("organization_id", "agent_definition_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_execution_results_organization_id_operation_id_create_idx" ON "agent_execution_results"("organization_id", "operation_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_execution_results_execution_run_id_idx" ON "agent_execution_results"("execution_run_id");

-- CreateIndex
CREATE INDEX "agent_model_call_usage_organization_id_created_at_idx" ON "agent_model_call_usage"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_model_call_usage_execution_run_id_idx" ON "agent_model_call_usage"("execution_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_model_call_usage_execution_step_id_call_index_key" ON "agent_model_call_usage"("execution_step_id", "call_index");

-- CreateIndex
CREATE INDEX "agent_tool_call_usage_organization_id_created_at_idx" ON "agent_tool_call_usage"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_tool_call_usage_execution_run_id_idx" ON "agent_tool_call_usage"("execution_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_tool_call_usage_execution_step_id_tool_call_id_key" ON "agent_tool_call_usage"("execution_step_id", "tool_call_id");

-- CreateIndex
CREATE INDEX "agent_usage_rollups_organization_id_dimension_type_period_d_idx" ON "agent_usage_rollups"("organization_id", "dimension_type", "period_date");

-- CreateIndex
CREATE UNIQUE INDEX "agent_usage_rollups_organization_id_dimension_type_dimensio_key" ON "agent_usage_rollups"("organization_id", "dimension_type", "dimension_id", "period_date", "provider_key", "model_id", "currency");

-- CreateIndex
CREATE INDEX "model_rate_cards_provider_key_model_id_status_idx" ON "model_rate_cards"("provider_key", "model_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "model_rate_cards_provider_key_provider_version_model_id_sta_key" ON "model_rate_cards"("provider_key", "provider_version", "model_id", "status");

