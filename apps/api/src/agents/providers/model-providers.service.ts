/**
 * Arden.AS API — leitura do catálogo de providers (ARDEN-BE-007.2).
 * System-scoped, somente leitura. Nenhuma mutação tenant. Sem segredo.
 */

import { Injectable } from '@nestjs/common';
import type { ModelProviderDefinition } from '@arden/contracts';
import { modelProviderNotAvailable } from '../../common/errors/api-error';
import { ModelProviderDefinitionsRepository } from './model-providers.repository';
import { toModelProviderContract } from '../agents.serializers';

@Injectable()
export class ModelProvidersService {
  constructor(private readonly repo: ModelProviderDefinitionsRepository) {}

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
}
