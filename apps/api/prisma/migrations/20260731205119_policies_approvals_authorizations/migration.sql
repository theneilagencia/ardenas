-- CreateEnum
CREATE TYPE "PolicyCategory" AS ENUM ('AUTHORITY', 'APPROVAL', 'FINANCIAL', 'SECURITY', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PolicyBindingScope" AS ENUM ('OPERATION', 'VERSION');

-- CreateEnum
CREATE TYPE "ApprovalFlowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionMode" AS ENUM ('ANY_ONE', 'ALL', 'QUORUM');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "ApprovalDelegationStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ActionAuthorizationStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED', 'INVALIDATED');

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "PolicyCategory" NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "current_draft_version_id" UUID,
    "published_version_id" UUID,
    "created_by" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "definition" JSONB NOT NULL DEFAULT '{}',
    "change_summary" TEXT,
    "created_by" UUID NOT NULL,
    "published_by" UUID,
    "published_at" TIMESTAMPTZ(6),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_policy_bindings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "operation_version_id" UUID,
    "policy_id" UUID NOT NULL,
    "policy_version_id" UUID NOT NULL,
    "scope" "PolicyBindingScope" NOT NULL DEFAULT 'OPERATION',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_policy_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ApprovalFlowStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flow_steps" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "approval_flow_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "decision_mode" "ApprovalDecisionMode" NOT NULL DEFAULT 'ANY_ONE',
    "quorum" INTEGER,
    "required_permission" TEXT,
    "eligible_role_key" TEXT,
    "specific_approver_user_id" UUID,
    "requester_cannot_approve" BOOLEAN NOT NULL DEFAULT true,
    "justification_required" BOOLEAN NOT NULL DEFAULT false,
    "expires_after_minutes" INTEGER,
    "escalation_after_minutes" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_flow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "operation_version_id" UUID NOT NULL,
    "action_key" TEXT NOT NULL,
    "action_payload_hash" TEXT NOT NULL,
    "action_context" JSONB NOT NULL DEFAULT '{}',
    "requested_by" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approval_flow_id" UUID NOT NULL,
    "current_step_sequence" INTEGER NOT NULL DEFAULT 1,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "policy_snapshot" JSONB NOT NULL DEFAULT '{}',
    "authority_snapshot" JSONB NOT NULL DEFAULT '{}',
    "correlation_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "approval_request_id" UUID NOT NULL,
    "approval_flow_step_id" UUID NOT NULL,
    "decided_by" UUID NOT NULL,
    "decision" "ApprovalDecisionType" NOT NULL,
    "justification" TEXT,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" TEXT NOT NULL,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_delegations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "delegator_user_id" UUID NOT NULL,
    "delegate_user_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "scope" JSONB NOT NULL DEFAULT '{}',
    "status" "ApprovalDelegationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_authorizations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "approval_request_id" UUID,
    "operation_id" UUID NOT NULL,
    "operation_version_id" UUID NOT NULL,
    "action_key" TEXT NOT NULL,
    "action_payload_hash" TEXT NOT NULL,
    "granted_to_user_id" UUID,
    "status" "ActionAuthorizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMPTZ(6),
    "authority_snapshot" JSONB NOT NULL DEFAULT '{}',
    "policy_snapshot" JSONB NOT NULL DEFAULT '{}',
    "correlation_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policies_organization_id_status_idx" ON "policies"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "policies_organization_id_key_key" ON "policies"("organization_id", "key");

-- CreateIndex
CREATE INDEX "policy_versions_organization_id_status_idx" ON "policy_versions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "policy_versions_policy_id_version_number_key" ON "policy_versions"("policy_id", "version_number");

-- CreateIndex
CREATE INDEX "operation_policy_bindings_operation_id_enabled_idx" ON "operation_policy_bindings"("operation_id", "enabled");

-- CreateIndex
CREATE INDEX "operation_policy_bindings_organization_id_idx" ON "operation_policy_bindings"("organization_id");

-- CreateIndex
CREATE INDEX "approval_flows_organization_id_status_idx" ON "approval_flows"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flows_organization_id_key_key" ON "approval_flows"("organization_id", "key");

-- CreateIndex
CREATE INDEX "approval_flow_steps_organization_id_idx" ON "approval_flow_steps"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flow_steps_approval_flow_id_sequence_key" ON "approval_flow_steps"("approval_flow_id", "sequence");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_status_requested_at_idx" ON "approval_requests"("organization_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "approval_requests_operation_id_status_idx" ON "approval_requests"("operation_id", "status");

-- CreateIndex
CREATE INDEX "approval_decisions_approval_request_id_decided_at_idx" ON "approval_decisions"("approval_request_id", "decided_at");

-- CreateIndex
CREATE UNIQUE INDEX "approval_decisions_approval_request_id_approval_flow_step_i_key" ON "approval_decisions"("approval_request_id", "approval_flow_step_id", "decided_by");

-- CreateIndex
CREATE INDEX "approval_delegations_organization_id_delegate_user_id_statu_idx" ON "approval_delegations"("organization_id", "delegate_user_id", "status");

-- CreateIndex
CREATE INDEX "action_authorizations_organization_id_operation_id_action_k_idx" ON "action_authorizations"("organization_id", "operation_id", "action_key", "status");

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_policy_bindings" ADD CONSTRAINT "operation_policy_bindings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_policy_bindings" ADD CONSTRAINT "operation_policy_bindings_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_policy_bindings" ADD CONSTRAINT "operation_policy_bindings_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_policy_bindings" ADD CONSTRAINT "operation_policy_bindings_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_steps" ADD CONSTRAINT "approval_flow_steps_approval_flow_id_fkey" FOREIGN KEY ("approval_flow_id") REFERENCES "approval_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approval_flow_id_fkey" FOREIGN KEY ("approval_flow_id") REFERENCES "approval_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_flow_step_id_fkey" FOREIGN KEY ("approval_flow_step_id") REFERENCES "approval_flow_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_authorizations" ADD CONSTRAINT "action_authorizations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_authorizations" ADD CONSTRAINT "action_authorizations_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_authorizations" ADD CONSTRAINT "action_authorizations_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

