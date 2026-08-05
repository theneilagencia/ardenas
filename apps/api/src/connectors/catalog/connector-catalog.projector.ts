/**
 * Arden.AS API — projector Nest do catálogo (ARDEN-BE-006.3 §8).
 * Executa a projeção PURA (`runCatalogProjection`) dentro de UMA transação. É uma
 * operação de SISTEMA (não escreve no audit tenant-scoped); registra por log.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { runCatalogProjection, type CatalogDbClient, type ConnectorCatalogProjectionResult } from './project-catalog';

@Injectable()
export class ConnectorCatalogProjector {
  private readonly logger = new Logger(ConnectorCatalogProjector.name);

  constructor(private readonly prisma: PrismaService) {}

  async project(): Promise<ConnectorCatalogProjectionResult> {
    const result = await this.prisma.$transaction((tx) => runCatalogProjection(tx as unknown as CatalogDbClient));
    this.logger.log(`Catálogo projetado: ${JSON.stringify(result)}`);
    return result;
  }
}

export type { ConnectorCatalogProjectionResult } from './project-catalog';
