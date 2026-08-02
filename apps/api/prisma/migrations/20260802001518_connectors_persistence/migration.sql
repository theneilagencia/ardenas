-- CreateEnum
CREATE TYPE "ConnectorCategory" AS ENUM ('HTTP', 'WEBHOOK', 'DATABASE', 'MESSAGING', 'BUSINESS_SYSTEM', 'INTERNAL_TEST');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ConnectorToolRiskLevel" AS ENUM ('READ', 'WRITE', 'DESTRUCTIVE', 'FINANCIAL', 'SECURITY_CRITICAL');

-- CreateEnum
CREATE TYPE "ToolIdempotencyMode" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED', 'PROVIDER_NATIVE');

-- CreateEnum
CREATE TYPE "ToolRetryMode" AS ENUM ('NEVER', 'SAFE', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ERROR', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConnectionTestStatus" AS ENUM ('SUCCESS', 'FAILURE', 'NOT_TESTED');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUPERSEDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WebhookSignatureScheme" AS ENUM ('HMAC_SHA256', 'STATIC_BEARER', 'NONE');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'REJECTED', 'REPLAYED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "connector_definitions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ConnectorCategory" NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'ACTIVE',
    "system_managed" BOOLEAN NOT NULL DEFAULT true,
    "production_allowed" BOOLEAN NOT NULL DEFAULT true,
    "configuration_schema" JSONB NOT NULL DEFAULT '{}',
    "credential_schema" JSONB NOT NULL DEFAULT '{}',
    "network_policy_template" JSONB NOT NULL DEFAULT '{}',
    "capability_keys" JSONB NOT NULL DEFAULT '[]',
    "catalog_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_tool_definitions" (
    "id" UUID NOT NULL,
    "connector_definition_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "action_key" TEXT NOT NULL,
    "input_schema" JSONB NOT NULL DEFAULT '{}',
    "output_schema" JSONB NOT NULL DEFAULT '{}',
    "risk_level" "ConnectorToolRiskLevel" NOT NULL DEFAULT 'READ',
    "idempotency_mode" "ToolIdempotencyMode" NOT NULL DEFAULT 'NONE',
    "retry_mode" "ToolRetryMode" NOT NULL DEFAULT 'NEVER',
    "default_timeout_ms" INTEGER NOT NULL DEFAULT 15000,
    "maximum_timeout_ms" INTEGER NOT NULL DEFAULT 60000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "catalog_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_tool_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connector_definition_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'DRAFT',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "network_policy" JSONB NOT NULL DEFAULT '{}',
    "current_credential_version_id" UUID,
    "last_tested_at" TIMESTAMPTZ(6),
    "last_test_status" "ConnectionTestStatus" NOT NULL DEFAULT 'NOT_TESTED',
    "last_error_code" TEXT,
    "last_error_summary" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_credential_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'PENDING',
    "encrypted_secret" TEXT,
    "encrypted_data_key" TEXT,
    "algorithm" TEXT,
    "key_version" TEXT,
    "nonce" TEXT,
    "auth_tag" TEXT,
    "fingerprint" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ(6),
    "superseded_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "connection_credential_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_tool_bindings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "connector_tool_definition_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configuration_overrides" JSONB NOT NULL DEFAULT '{}',
    "policy_overrides" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_tool_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_tool_bindings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "operation_version_id" UUID,
    "organization_tool_binding_id" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowed_action_keys" JSONB NOT NULL DEFAULT '[]',
    "input_mapping" JSONB NOT NULL DEFAULT '{}',
    "output_mapping" JSONB NOT NULL DEFAULT '{}',
    "removed_at" TIMESTAMPTZ(6),
    "removed_by_user_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_tool_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
    "path_token_hash" TEXT NOT NULL,
    "signature_scheme" "WebhookSignatureScheme" NOT NULL DEFAULT 'HMAC_SHA256',
    "secret_credential_version_id" UUID,
    "replay_window_seconds" INTEGER NOT NULL DEFAULT 300,
    "allowed_event_types" JSONB NOT NULL DEFAULT '[]',
    "operation_id" UUID,
    "operation_version_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "webhook_endpoint_id" UUID NOT NULL,
    "external_delivery_id" TEXT,
    "payload_hash" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "correlation_id" TEXT NOT NULL,
    "error_code" TEXT,
    "error_summary" TEXT,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connector_definitions_status_idx" ON "connector_definitions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "connector_definitions_key_version_key" ON "connector_definitions"("key", "version");

-- CreateIndex
CREATE INDEX "connector_tool_definitions_action_key_idx" ON "connector_tool_definitions"("action_key");

-- CreateIndex
CREATE UNIQUE INDEX "connector_tool_definitions_connector_definition_id_key_vers_key" ON "connector_tool_definitions"("connector_definition_id", "key", "version");

-- CreateIndex
CREATE INDEX "organization_connections_organization_id_status_idx" ON "organization_connections"("organization_id", "status");

-- CreateIndex
CREATE INDEX "organization_connections_organization_id_connector_definiti_idx" ON "organization_connections"("organization_id", "connector_definition_id");

-- CreateIndex
CREATE INDEX "organization_connections_organization_id_updated_at_idx" ON "organization_connections"("organization_id", "updated_at");

-- CreateIndex
CREATE INDEX "connection_credential_versions_organization_id_status_idx" ON "connection_credential_versions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connection_credential_versions_connection_id_version_number_key" ON "connection_credential_versions"("connection_id", "version_number");

-- CreateIndex
CREATE INDEX "organization_tool_bindings_organization_id_enabled_idx" ON "organization_tool_bindings"("organization_id", "enabled");

-- CreateIndex
CREATE INDEX "organization_tool_bindings_connection_id_idx" ON "organization_tool_bindings"("connection_id");

-- CreateIndex
CREATE INDEX "organization_tool_bindings_connector_tool_definition_id_idx" ON "organization_tool_bindings"("connector_tool_definition_id");

-- CreateIndex
CREATE INDEX "operation_tool_bindings_operation_id_enabled_idx" ON "operation_tool_bindings"("operation_id", "enabled");

-- CreateIndex
CREATE INDEX "operation_tool_bindings_operation_version_id_enabled_idx" ON "operation_tool_bindings"("operation_version_id", "enabled");

-- CreateIndex
CREATE INDEX "operation_tool_bindings_organization_id_alias_idx" ON "operation_tool_bindings"("organization_id", "alias");

-- CreateIndex
CREATE INDEX "webhook_endpoints_organization_id_status_idx" ON "webhook_endpoints"("organization_id", "status");

-- CreateIndex
CREATE INDEX "webhook_endpoints_connection_id_idx" ON "webhook_endpoints"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_endpoints_path_token_hash_key" ON "webhook_endpoints"("path_token_hash");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_endpoint_id_received_at_idx" ON "webhook_deliveries"("webhook_endpoint_id", "received_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_organization_id_received_at_idx" ON "webhook_deliveries"("organization_id", "received_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_organization_id_payload_hash_idx" ON "webhook_deliveries"("organization_id", "payload_hash");

-- AddForeignKey
ALTER TABLE "connector_tool_definitions" ADD CONSTRAINT "connector_tool_definitions_connector_definition_id_fkey" FOREIGN KEY ("connector_definition_id") REFERENCES "connector_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_credential_versions" ADD CONSTRAINT "connection_credential_versions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "organization_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_tool_bindings" ADD CONSTRAINT "organization_tool_bindings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "organization_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_tool_bindings" ADD CONSTRAINT "organization_tool_bindings_connector_tool_definition_id_fkey" FOREIGN KEY ("connector_tool_definition_id") REFERENCES "connector_tool_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_tool_bindings" ADD CONSTRAINT "operation_tool_bindings_organization_tool_binding_id_fkey" FOREIGN KEY ("organization_tool_binding_id") REFERENCES "organization_tool_bindings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "organization_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_endpoint_id_fkey" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── ARDEN-BE-006.3: integridade adicional (índices parciais + FKs cross-entity) ──
-- Escritos à mão: `prisma migrate diff` não modela índices parciais nem FKs para
-- colunas escalares (organization_id, operation_id) do padrão AuditEvent.

-- No máximo UMA versão de credencial ACTIVE por conexão (§7.4 / teste crítico §24).
CREATE UNIQUE INDEX "uniq_active_credential_per_connection"
  ON "connection_credential_versions"("connection_id")
  WHERE "status" = 'ACTIVE';

-- No máximo UMA entrega por endpoint e external_delivery_id quando presente (§7.6).
CREATE UNIQUE INDEX "uniq_webhook_delivery_per_external_id"
  ON "webhook_deliveries"("webhook_endpoint_id", "external_delivery_id")
  WHERE "external_delivery_id" IS NOT NULL;

-- FK do catálogo (conexão → definição de conector). Sem cascade destrutivo.
ALTER TABLE "organization_connections"
  ADD CONSTRAINT "organization_connections_connector_definition_id_fkey"
  FOREIGN KEY ("connector_definition_id") REFERENCES "connector_definitions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- FKs de tenant (organization_id escalar → organizations). RESTRICT: nunca apaga
-- histórico/credenciais por cascade.
ALTER TABLE "organization_connections"
  ADD CONSTRAINT "organization_connections_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "connection_credential_versions"
  ADD CONSTRAINT "connection_credential_versions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "organization_tool_bindings"
  ADD CONSTRAINT "organization_tool_bindings_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operation_tool_bindings"
  ADD CONSTRAINT "operation_tool_bindings_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhook_endpoints"
  ADD CONSTRAINT "webhook_endpoints_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries"
  ADD CONSTRAINT "webhook_deliveries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FKs para operação/versão (colunas escalares). Bindings preservados.
ALTER TABLE "operation_tool_bindings"
  ADD CONSTRAINT "operation_tool_bindings_operation_id_fkey"
  FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operation_tool_bindings"
  ADD CONSTRAINT "operation_tool_bindings_operation_version_id_fkey"
  FOREIGN KEY ("operation_version_id") REFERENCES "operation_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhook_endpoints"
  ADD CONSTRAINT "webhook_endpoints_operation_id_fkey"
  FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "webhook_endpoints"
  ADD CONSTRAINT "webhook_endpoints_operation_version_id_fkey"
  FOREIGN KEY ("operation_version_id") REFERENCES "operation_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ponteiros de credencial (SET NULL: revogação/rotação preservam a conexão/endpoint).
ALTER TABLE "organization_connections"
  ADD CONSTRAINT "organization_connections_current_credential_version_id_fkey"
  FOREIGN KEY ("current_credential_version_id") REFERENCES "connection_credential_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "webhook_endpoints"
  ADD CONSTRAINT "webhook_endpoints_secret_credential_version_id_fkey"
  FOREIGN KEY ("secret_credential_version_id") REFERENCES "connection_credential_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remoção lógica de operation tool binding (§18): binding referenciável por
-- execuções futuras não sofre delete físico.
ALTER TABLE "operation_tool_bindings"
  ADD CONSTRAINT "operation_tool_bindings_removed_by_user_id_fkey"
  FOREIGN KEY ("removed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
