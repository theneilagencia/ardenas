/**
 * Arden.AS API — registry de providers de modelo (ARDEN-BE-007.3 §8).
 *
 * Seleção por `key/version` canônicas. Provider desconhecido → `MODEL_PROVIDER_NOT_AVAILABLE`.
 * NENHUMA classe vem do banco; nenhum import dinâmico por nome; nenhuma execução arbitrária.
 * Registra APENAS o provider determinístico interno nesta fase (sem provider comercial).
 */

import { Injectable } from '@nestjs/common';
import type { ModelProvider, ModelProviderRegistry } from '@arden/contracts';
import { modelProviderNotAvailable } from '../../common/errors/api-error';
import {
  InternalTestModelProvider,
  INTERNAL_TEST_PROVIDER_KEY,
  INTERNAL_TEST_PROVIDER_VERSION,
} from './internal-test-model.provider';

interface RegisteredProvider extends ModelProvider {
  key: string;
  version: string;
}

@Injectable()
export class InMemoryModelProviderRegistry implements ModelProviderRegistry {
  private readonly providers = new Map<string, ModelProvider>();

  constructor(internalTest: InternalTestModelProvider) {
    this.register(internalTest);
  }

  register(provider: RegisteredProvider): void {
    this.providers.set(`${provider.key}@${provider.version}`, provider);
  }

  get(providerKey: string, providerVersion: string): ModelProvider {
    const provider = this.providers.get(`${providerKey}@${providerVersion}`);
    if (!provider) throw modelProviderNotAvailable(`Provider não registrado: ${providerKey}@${providerVersion}.`);
    return provider;
  }

  /** Somente para testes: conhece a chave sem instanciar execução. */
  has(providerKey: string, providerVersion: string): boolean {
    return this.providers.has(`${providerKey}@${providerVersion}`);
  }
}

export const INTERNAL_TEST_PROVIDER_REF = {
  key: INTERNAL_TEST_PROVIDER_KEY,
  version: INTERNAL_TEST_PROVIDER_VERSION,
} as const;
