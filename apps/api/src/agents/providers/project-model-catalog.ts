/**
 * Arden.AS API — projeção idempotente do catálogo persistido de modelos (ARDEN-BE-008.2 §21).
 *
 * SYSTEM-MANAGED, sem internet, sem SDK. Mirror do projector de providers: upsert por
 * `catalogHash`; entradas removidas do canônico → DEPRECATED (nunca apagadas). Modelos
 * comerciais (Anthropic) entram DISABLED / productionAllowed=false enquanto a verificação
 * oficial e a execução estão pendentes. Nunca projeta preço (custo vive nos rate cards).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ANTHROPIC_MODEL_CATALOG, type CommercialModelCatalogEntry } from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { stableHash } from '../hashing/stable-hash';

/** Catálogo canônico de modelos comerciais persistidos (só Anthropic nesta fase). */
export function projectCommercialModelCatalog(): readonly CommercialModelCatalogEntry[] {
  return ANTHROPIC_MODEL_CATALOG;
}

export interface ModelCatalogProjectionResult {
  created: number;
  updated: number;
  unchanged: number;
  deprecated: number;
}

export interface ModelCatalogDbClient {
  modelCatalogEntry: {
    findFirst(args: unknown): Promise<{ id: string; catalogHash: string; status: string } | null>;
    findMany(args: unknown): Promise<Array<{ id: string; providerKey: string; providerVersion: string; modelId: string; status: string; systemManaged: boolean }>>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<{ id: string }>;
  };
}

function entryData(entry: CommercialModelCatalogEntry) {
  return {
    providerKey: entry.providerKey,
    providerVersion: entry.providerVersion,
    modelId: entry.modelId,
    displayName: entry.displayName,
    status: entry.status,
    productionAllowed: entry.productionAllowed,
    capabilities: entry.capabilities,
    maximumInputTokens: entry.maximumInputTokens,
    maximumOutputTokens: entry.maximumOutputTokens,
    supportsStructuredOutput: entry.supportsStructuredOutput,
    supportsToolCalling: entry.supportsToolCalling,
    supportsPromptCaching: entry.supportsPromptCaching,
    supportsVision: entry.supportsVision,
    supportsStreaming: entry.supportsStreaming,
    rateCardKey: entry.rateCardKey,
    sourceReferences: entry.sourceReferences,
    systemManaged: true,
    catalogHash: stableHash(entry),
  };
}

export async function runModelCatalogProjection(db: ModelCatalogDbClient): Promise<ModelCatalogProjectionResult> {
  const entries = projectCommercialModelCatalog();
  const result: ModelCatalogProjectionResult = { created: 0, updated: 0, unchanged: 0, deprecated: 0 };
  const canonicalKeys = new Set(entries.map((e) => `${e.providerKey}@${e.providerVersion}::${e.modelId}`));

  for (const entry of entries) {
    const data = entryData(entry);
    const existing = await db.modelCatalogEntry.findFirst({
      where: { providerKey: entry.providerKey, providerVersion: entry.providerVersion, modelId: entry.modelId },
    });
    if (!existing) {
      await db.modelCatalogEntry.create({ data });
      result.created++;
    } else if (existing.catalogHash === data.catalogHash && existing.status === data.status) {
      result.unchanged++;
    } else {
      await db.modelCatalogEntry.update({ where: { id: existing.id }, data });
      result.updated++;
    }
  }

  // Entradas system-managed removidas do canônico → DEPRECATED (nunca apagadas).
  for (const existing of await db.modelCatalogEntry.findMany({ orderBy: { modelId: 'asc' } })) {
    const key = `${existing.providerKey}@${existing.providerVersion}::${existing.modelId}`;
    if (existing.systemManaged && !canonicalKeys.has(key) && existing.status !== 'DEPRECATED') {
      await db.modelCatalogEntry.update({ where: { id: existing.id }, data: { status: 'DEPRECATED' } });
      result.deprecated++;
    }
  }

  return result;
}

@Injectable()
export class ModelCatalogProjector {
  private readonly logger = new Logger(ModelCatalogProjector.name);
  constructor(private readonly prisma: PrismaService) {}

  async project(): Promise<ModelCatalogProjectionResult> {
    const result = await this.prisma.$transaction((tx) => runModelCatalogProjection(tx as unknown as ModelCatalogDbClient));
    this.logger.log(`Catálogo de modelos projetado: ${JSON.stringify(result)}`);
    return result;
  }
}

@Injectable()
export class ModelCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista pública (não tenant-scoped) de modelos de um provider. */
  async listByProvider(providerKey: string, providerVersion: string) {
    return this.prisma.modelCatalogEntry.findMany({
      where: { providerKey, providerVersion },
      orderBy: { modelId: 'asc' },
    });
  }

  async findEntry(providerKey: string, providerVersion: string, modelId: string) {
    return this.prisma.modelCatalogEntry.findFirst({ where: { providerKey, providerVersion, modelId } });
  }
}
