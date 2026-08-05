/**
 * Arden.AS API — endpoints do catálogo de providers de modelo (ARDEN-BE-007.2).
 *
 * System-managed (não tenant-scoped), exige `model_provider.view`. O provider de teste
 * `internal.test-model` PERMANECE catalogado em produção (§36) — a proibição em produção
 * é aplicada na ATIVAÇÃO da configuração e na PUBLICAÇÃO, nunca ocultando o catálogo.
 * Sem segredo; leitura pura.
 */

import { Controller, Get, Param } from '@nestjs/common';
import { RequirePermission } from '../../authz/decorators';
import { ModelProvidersService } from './model-providers.service';

@Controller('model-providers')
export class ModelProvidersController {
  constructor(private readonly providers: ModelProvidersService) {}

  @Get()
  @RequirePermission('model_provider.view')
  async list() {
    return { data: await this.providers.list() };
  }

  @Get(':providerKey')
  @RequirePermission('model_provider.view')
  async get(@Param('providerKey') providerKey: string) {
    return { data: await this.providers.getByKey(providerKey) };
  }

  // Catálogo persistido de modelos (008.2). Modelos comerciais permanecem DISABLED.
  @Get(':providerKey/versions/:providerVersion/models')
  @RequirePermission('model_provider.view')
  async listModels(@Param('providerKey') providerKey: string, @Param('providerVersion') providerVersion: string) {
    return { data: await this.providers.listModels(providerKey, providerVersion) };
  }
}
