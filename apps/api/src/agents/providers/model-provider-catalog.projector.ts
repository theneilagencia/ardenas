/**
 * Arden.AS API — projector Nest do catálogo de providers (ARDEN-BE-007.2).
 * Envolve a projeção PURA em uma transação. Idempotente; usado no bootstrap/teste.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  runModelProviderCatalogProjection,
  type ModelProviderDbClient,
  type ModelProviderProjectionResult,
} from './project-model-providers';

@Injectable()
export class ModelProviderCatalogProjector {
  constructor(private readonly prisma: PrismaService) {}

  project(): Promise<ModelProviderProjectionResult> {
    return this.prisma.$transaction((tx) =>
      runModelProviderCatalogProjection(tx as unknown as ModelProviderDbClient),
    );
  }
}
