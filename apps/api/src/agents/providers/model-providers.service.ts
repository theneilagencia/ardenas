/**
 * Arden.AS API — leitura do catálogo de providers (ARDEN-BE-007.2).
 * System-scoped, somente leitura. Nenhuma mutação tenant. Sem segredo.
 */

import { Injectable } from '@nestjs/common';
import type { ModelProviderDefinition, ModelCatalogEntry } from '@arden/contracts';
import { modelProviderNotAvailable } from '../../common/errors/api-error';
import { ModelProviderDefinitionsRepository } from './model-providers.repository';
import { ModelCatalogRepository } from './project-model-catalog';
import { toModelProviderContract, toModelCatalogEntryContract } from '../agents.serializers';

@Injectable()
export class ModelProvidersService {
  constructor(
    private readonly repo: ModelProviderDefinitionsRepository,
    private readonly catalog: ModelCatalogRepository,
  ) {}

  async list(): Promise<ModelProviderDefinition[]> {
    const rows = await this.repo.list();
    return rows.map(toModelProviderContract);
  }

  /** Consulta pela `key` a versão mais recente projetada. */
  async getByKey(providerKey: string): Promise<ModelProviderDefinition> {
    const row = await this.repo.findByKeyLatest(providerKey);
    if (!row) throw modelProviderNotAvailable();
    return toModelProviderContract(row);
  }

  /** Catálogo persistido de modelos de um provider (system-scoped; sem segredo/preço). */
  async listModels(providerKey: string, providerVersion: string): Promise<ModelCatalogEntry[]> {
    const rows = await this.catalog.listByProvider(providerKey, providerVersion);
    return rows.map(toModelCatalogEntryContract);
  }
}
