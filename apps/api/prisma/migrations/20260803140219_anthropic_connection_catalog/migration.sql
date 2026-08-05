-- ARDEN-BE-008.2 — migração ADITIVA: categoria de conector MODEL_PROVIDER + catálogo
-- persistido de modelos. Nenhuma tabela/coluna/constraint existente é alterada ou
-- removida. Nenhum cascade destrutivo. Migrações anteriores permanecem intactas.

-- AlterEnum: nova categoria para conectores de provider de modelo (ex.: system.anthropic).
ALTER TYPE "ConnectorCategory" ADD VALUE 'MODEL_PROVIDER';

-- CreateTable: catálogo persistido de modelos (system-managed, projetado do canônico).
CREATE TABLE "model_catalog_entries" (
    "id" UUID NOT NULL,
    "provider_key" TEXT NOT NULL,
    "provider_version" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "ModelProviderStatus" NOT NULL DEFAULT 'DISABLED',
    "production_allowed" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "maximum_input_tokens" INTEGER,
    "maximum_output_tokens" INTEGER,
    "supports_structured_output" BOOLEAN NOT NULL DEFAULT false,
    "supports_tool_calling" BOOLEAN NOT NULL DEFAULT false,
    "supports_prompt_caching" BOOLEAN NOT NULL DEFAULT false,
    "supports_vision" BOOLEAN NOT NULL DEFAULT false,
    "supports_streaming" BOOLEAN NOT NULL DEFAULT false,
    "rate_card_key" TEXT,
    "source_references" JSONB NOT NULL DEFAULT '[]',
    "system_managed" BOOLEAN NOT NULL DEFAULT true,
    "catalog_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_catalog_entries_provider_key_provider_version_status_idx" ON "model_catalog_entries"("provider_key", "provider_version", "status");

-- CreateIndex
CREATE UNIQUE INDEX "model_catalog_entries_provider_key_provider_version_model_i_key" ON "model_catalog_entries"("provider_key", "provider_version", "model_id");
