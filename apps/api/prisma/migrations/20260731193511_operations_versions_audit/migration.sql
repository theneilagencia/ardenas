-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "OperationVersionStatus" AS ENUM ('draft', 'published', 'superseded');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('user', 'system', 'integration');

-- CreateTable
CREATE TABLE "operations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "OperationStatus" NOT NULL DEFAULT 'draft',
    "owner_id" UUID,
    "current_draft_version_id" UUID,
    "published_version_id" UUID,
    "created_by" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "OperationVersionStatus" NOT NULL DEFAULT 'draft',
    "definition" JSONB NOT NULL DEFAULT '{}',
    "authority_profile" JSONB NOT NULL DEFAULT '{}',
    "change_summary" TEXT,
    "created_by" UUID NOT NULL,
    "published_by" UUID,
    "published_at" TIMESTAMPTZ(6),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_type" "AuditSource" NOT NULL DEFAULT 'user',
    "actor_role" TEXT,
    "actor_display_name" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "correlation_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operations_organization_id_status_idx" ON "operations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "operations_organization_id_updated_at_idx" ON "operations"("organization_id", "updated_at");

-- CreateIndex
CREATE INDEX "operation_versions_organization_id_status_idx" ON "operation_versions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "operation_versions_operation_id_version_number_key" ON "operation_versions"("operation_id", "version_number");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_occurred_at_idx" ON "audit_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_resource_type_resource_id_idx" ON "audit_events"("organization_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_events_correlation_id_idx" ON "audit_events"("correlation_id");

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_versions" ADD CONSTRAINT "operation_versions_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

