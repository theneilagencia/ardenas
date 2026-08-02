-- CreateEnum
CREATE TYPE "ModelProviderStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ModelConfigurationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AgentVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateTable
CREATE TABLE "model_provider_definitions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ModelProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "production_allowed" BOOLEAN NOT NULL DEFAULT false,
    "system_managed" BOOLEAN NOT NULL DEFAULT true,
    "catalog_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_provider_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider_definition_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model_id" TEXT NOT NULL,
    "credential_connection_id" UUID,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "status" "ModelConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'DRAFT',
    "current_published_version_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_definition_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "AgentVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "objective" TEXT NOT NULL,
    "system_instructions" TEXT NOT NULL,
    "model_configuration_id" UUID NOT NULL,
    "input_schema" JSONB NOT NULL DEFAULT '{}',
    "output_schema" JSONB NOT NULL DEFAULT '{}',
    "context_policy" JSONB NOT NULL DEFAULT '{}',
    "execution_policy" JSONB NOT NULL DEFAULT '{}',
    "tool_policy" JSONB NOT NULL DEFAULT '{}',
    "evaluation_policy" JSONB NOT NULL DEFAULT '{}',
    "cost_policy" JSONB NOT NULL DEFAULT '{}',
    "content_hash" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),
    "retired_at" TIMESTAMPTZ(6),

    CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_provider_definitions_status_production_allowed_idx" ON "model_provider_definitions"("status", "production_allowed");

-- CreateIndex
CREATE UNIQUE INDEX "model_provider_definitions_key_version_key" ON "model_provider_definitions"("key", "version");

-- CreateIndex
CREATE INDEX "model_configurations_organization_id_status_idx" ON "model_configurations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "model_configurations_organization_id_provider_definition_id_idx" ON "model_configurations"("organization_id", "provider_definition_id");

-- CreateIndex
CREATE INDEX "model_configurations_organization_id_model_id_idx" ON "model_configurations"("organization_id", "model_id");

-- CreateIndex
CREATE INDEX "model_configurations_organization_id_updated_at_idx" ON "model_configurations"("organization_id", "updated_at");

-- CreateIndex
CREATE INDEX "agent_definitions_organization_id_status_idx" ON "agent_definitions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "agent_definitions_organization_id_updated_at_idx" ON "agent_definitions"("organization_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_definitions_organization_id_key_key" ON "agent_definitions"("organization_id", "key");

-- CreateIndex
CREATE INDEX "agent_versions_organization_id_status_idx" ON "agent_versions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "agent_versions_model_configuration_id_idx" ON "agent_versions"("model_configuration_id");

-- CreateIndex
CREATE INDEX "agent_versions_agent_definition_id_status_idx" ON "agent_versions"("agent_definition_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_versions_agent_definition_id_version_number_key" ON "agent_versions"("agent_definition_id", "version_number");

-- AddForeignKey
ALTER TABLE "model_configurations" ADD CONSTRAINT "model_configurations_provider_definition_id_fkey" FOREIGN KEY ("provider_definition_id") REFERENCES "model_provider_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_definition_id_fkey" FOREIGN KEY ("agent_definition_id") REFERENCES "agent_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_model_configuration_id_fkey" FOREIGN KEY ("model_configuration_id") REFERENCES "model_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

