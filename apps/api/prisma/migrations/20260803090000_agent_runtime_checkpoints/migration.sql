-- ARDEN-BE-007.5 — Checkpoint mínimo do loop de tool calling do agente.
-- Migration CORRETIVA e aditiva: cria apenas o novo enum e a nova tabela. Não altera
-- migrations anteriores nem tabelas existentes.

-- CreateEnum
CREATE TYPE "AgentRuntimeCheckpointStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'COMPLETED');

-- CreateTable
CREATE TABLE "agent_runtime_checkpoints" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_run_id" UUID NOT NULL,
    "execution_step_id" UUID NOT NULL,
    "agent_definition_id" UUID NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "status" "AgentRuntimeCheckpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "model_call_count" INTEGER NOT NULL DEFAULT 0,
    "tool_call_count" INTEGER NOT NULL DEFAULT 0,
    "pending_tool_call" JSONB,
    "completed_tool_calls" JSONB NOT NULL DEFAULT '{}',
    "approval_request_id" UUID,
    "context_hash" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runtime_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_runtime_checkpoints_execution_step_id_key" ON "agent_runtime_checkpoints"("execution_step_id");

-- CreateIndex
CREATE INDEX "agent_runtime_checkpoints_organization_id_execution_run_id_idx" ON "agent_runtime_checkpoints"("organization_id", "execution_run_id");

-- CreateIndex
CREATE INDEX "agent_runtime_checkpoints_approval_request_id_idx" ON "agent_runtime_checkpoints"("approval_request_id");
