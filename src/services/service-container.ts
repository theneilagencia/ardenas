/**
 * Arden.AS — container de serviços.
 * Resolve a implementação a partir da configuração. Se a troca exigir alterar
 * componente, o contrato está vazando — corrige-se o contrato, não o componente.
 */

import type { DataProvider } from './contracts';
import { ApiDataProvider, IndexedDbDataProvider, MockDataProvider } from './providers';

type ProviderKind = 'mock' | 'indexeddb' | 'api';

function resolveKind(): ProviderKind {
  const raw = import.meta.env.VITE_DATA_PROVIDER as string | undefined;
  if (raw === 'api' || raw === 'mock' || raw === 'indexeddb') return raw;
  return 'indexeddb';
}

let provider: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (provider) return provider;
  const kind = resolveKind();
  if (kind === 'api') {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? '';
    provider = new ApiDataProvider(baseUrl);
  } else if (kind === 'mock') {
    provider = new MockDataProvider();
  } else {
    provider = new IndexedDbDataProvider();
  }
  return provider;
}

/** Usado por testes para injetar um provider determinístico. */
export function setDataProvider(next: DataProvider): void {
  provider = next;
}
