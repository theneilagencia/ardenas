/**
 * Arden.AS API — projeção idempotente do catálogo de rate cards (ARDEN-BE-007.6 §11/§38).
 *
 * SYSTEM-MANAGED, sem internet. Mirror do projector de providers: upsert por
 * `catalogHash`. `internal.test-model` = custo 0 USD (conhecido). Não é preço comercial.
 */

import { Injectable, Logger } from '@nestjs/common';
import { projectRateCards } from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { stableHash } from '../hashing/stable-hash';

export interface RateCardProjectionResult {
  created: number;
  updated: number;
  unchanged: number;
}

export interface RateCardDbClient {
  modelRateCard: {
    findFirst(args: unknown): Promise<{ id: string; catalogHash: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<{ id: string }>;
  };
}

export async function runRateCardProjection(db: RateCardDbClient): Promise<RateCardProjectionResult> {
  const result: RateCardProjectionResult = { created: 0, updated: 0, unchanged: 0 };
  for (const card of projectRateCards()) {
    const catalogHash = stableHash(card);
    const data = {
      providerKey: card.providerKey,
      providerVersion: card.providerVersion,
      modelId: card.modelId,
      currency: card.currency,
      inputCostPerMillionTokensMinor: BigInt(card.inputCostPerMillionTokensMinor),
      outputCostPerMillionTokensMinor: BigInt(card.outputCostPerMillionTokensMinor),
      cachedInputCostPerMillionTokensMinor: BigInt(card.cachedInputCostPerMillionTokensMinor),
      cachedOutputCostPerMillionTokensMinor: BigInt(card.cachedOutputCostPerMillionTokensMinor),
      status: 'ACTIVE' as const,
      source: card.source,
      catalogHash,
    };
    const existing = await db.modelRateCard.findFirst({
      where: { providerKey: card.providerKey, providerVersion: card.providerVersion, modelId: card.modelId, status: 'ACTIVE' },
    });
    if (!existing) {
      await db.modelRateCard.create({ data });
      result.created++;
    } else if (existing.catalogHash === catalogHash) {
      result.unchanged++;
    } else {
      await db.modelRateCard.update({ where: { id: existing.id }, data });
      result.updated++;
    }
  }
  return result;
}

@Injectable()
export class RateCardCatalogProjector {
  private readonly logger = new Logger(RateCardCatalogProjector.name);
  constructor(private readonly prisma: PrismaService) {}

  async project(): Promise<RateCardProjectionResult> {
    const result = await this.prisma.$transaction((tx) => runRateCardProjection(tx as unknown as RateCardDbClient));
    this.logger.log(`Rate cards projetados: ${JSON.stringify(result)}`);
    return result;
  }
}

@Injectable()
export class ModelRateCardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Rate card ATIVA para (provider, versão, modelId); null quando ausente. */
  async findActive(providerKey: string, providerVersion: string, modelId: string) {
    return this.prisma.modelRateCard.findFirst({
      where: { providerKey, providerVersion, modelId, status: 'ACTIVE' },
    });
  }
}
