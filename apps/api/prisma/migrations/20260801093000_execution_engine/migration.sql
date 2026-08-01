-- CreateEnum
CREATE TYPE "ExecutionTriggerType" AS ENUM ('MANUAL', 'API', 'SCHEDULED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ExecutionRunStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', 'RESUME_REQUESTED', 'CANCEL_REQUESTED', 'CANCELLED', 'SUCCEEDED', 'FAILED', 'COMPENSATING', 'COMPENSATED', 'COMPENSATION_FAILED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "ExecutionStepStatus" AS ENUM ('PENDING', 'READY', 'RUNNING', 'RETRY_WAIT', 'PAUSED', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED', 'COMPENSATING', 'COMPENSATED', 'COMPENSATION_FAILED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "ExecutionAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ExecutionActorType" AS ENUM ('USER', 'SYSTEM', 'WORKER');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('INPUT', 'OUTPUT', 'DECISION', 'AUTHORIZATION', 'ERROR', 'STATE_TRANSITION', 'COMPENSATION');

-- CreateEnum
CREATE TYPE "ExecutionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'RETRY_WAIT', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "execution_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "operation_version_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "action_authorization_id" UUID,
    "action_key" TEXT NOT NULL,
    "trigger_type" "ExecutionTriggerType" NOT NULL DEFAULT 'MANUAL',
    "trigger_reference" TEXT,
    "status" "ExecutionRunStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL DEFAULT '{}',
    "input_hash" TEXT NOT NULL,
    "output" JSONB,
    "error_code" TEXT,
    "error_summary" TEXT,
    "current_step_id" UUID,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "paused_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "timeout_at" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "correlation_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_steps" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_run_id" UUID NOT NULL,
    "definition_step_key" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "status" "ExecutionStepStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL DEFAULT '{}',
    "input_hash" TEXT NOT NULL,
    "output" JSONB,
    "error_code" TEXT,
    "error_summary" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "next_attempt_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "timeout_at" TIMESTAMPTZ(6),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_attempts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_run_id" UUID NOT NULL,
    "execution_step_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "worker_id" TEXT NOT NULL,
    "status" "ExecutionAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "error_code" TEXT,
    "error_summary" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "execution_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_run_id" UUID NOT NULL,
    "execution_step_id" UUID,
    "sequence" BIGINT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_type" "ExecutionActorType" NOT NULL,
    "actor_id" UUID,
    "correlation_id" TEXT NOT NULL,
    "causation_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_run_id" UUID NOT NULL,
    "execution_step_id" UUID,
    "evidence_type" "EvidenceType" NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "content_hash" TEXT NOT NULL,
    "storage_reference" TEXT,
    "mime_type" TEXT,
    "created_by_type" "ExecutionActorType" NOT NULL,
    "created_by_id" UUID,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_run_id" UUID NOT NULL,
    "status" "ExecutionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 20,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" TEXT,
    "lease_expires_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "deduplication_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execution_runs_organization_id_status_created_at_idx" ON "execution_runs"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "execution_runs_operation_id_created_at_idx" ON "execution_runs"("operation_id", "created_at");

-- CreateIndex
CREATE INDEX "execution_runs_operation_version_id_created_at_idx" ON "execution_runs"("operation_version_id", "created_at");

-- CreateIndex
CREATE INDEX "execution_steps_execution_run_id_sequence_idx" ON "execution_steps"("execution_run_id", "sequence");

-- CreateIndex
CREATE INDEX "execution_steps_organization_id_status_next_attempt_at_idx" ON "execution_steps"("organization_id", "status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "execution_steps_execution_run_id_sequence_key" ON "execution_steps"("execution_run_id", "sequence");

-- CreateIndex
CREATE INDEX "execution_attempts_execution_step_id_attempt_number_idx" ON "execution_attempts"("execution_step_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "execution_attempts_execution_step_id_attempt_number_key" ON "execution_attempts"("execution_step_id", "attempt_number");

-- CreateIndex
CREATE INDEX "execution_events_execution_run_id_sequence_idx" ON "execution_events"("execution_run_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "execution_events_execution_run_id_sequence_key" ON "execution_events"("execution_run_id", "sequence");

-- CreateIndex
CREATE INDEX "evidence_records_execution_run_id_created_at_idx" ON "evidence_records"("execution_run_id", "created_at");

-- CreateIndex
CREATE INDEX "evidence_records_execution_step_id_created_at_idx" ON "evidence_records"("execution_step_id", "created_at");

-- CreateIndex
CREATE INDEX "execution_jobs_status_available_at_idx" ON "execution_jobs"("status", "available_at");

-- CreateIndex
CREATE INDEX "execution_jobs_organization_id_status_idx" ON "execution_jobs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "execution_jobs_lease_expires_at_idx" ON "execution_jobs"("lease_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "execution_jobs_deduplication_key_key" ON "execution_jobs"("deduplication_key");

-- AddForeignKey
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_operation_version_id_fkey" FOREIGN KEY ("operation_version_id") REFERENCES "operation_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_action_authorization_id_fkey" FOREIGN KEY ("action_authorization_id") REFERENCES "action_authorizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_steps" ADD CONSTRAINT "execution_steps_execution_run_id_fkey" FOREIGN KEY ("execution_run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_attempts" ADD CONSTRAINT "execution_attempts_execution_run_id_fkey" FOREIGN KEY ("execution_run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_attempts" ADD CONSTRAINT "execution_attempts_execution_step_id_fkey" FOREIGN KEY ("execution_step_id") REFERENCES "execution_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_execution_run_id_fkey" FOREIGN KEY ("execution_run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_events" ADD CONSTRAINT "execution_events_execution_step_id_fkey" FOREIGN KEY ("execution_step_id") REFERENCES "execution_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_execution_run_id_fkey" FOREIGN KEY ("execution_run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_execution_step_id_fkey" FOREIGN KEY ("execution_step_id") REFERENCES "execution_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_jobs" ADD CONSTRAINT "execution_jobs_execution_run_id_fkey" FOREIGN KEY ("execution_run_id") REFERENCES "execution_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

