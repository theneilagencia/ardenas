/**
 * Arden.AS — container de serviços.
 * Resolve a implementação a partir da configuração. Se a troca exigir alterar
 * componente, o contrato está vazando — corrige-se o contrato, não o componente.
 */

import type { ApprovalsRepository, DataProvider, FilesRepository, OperationsRepository } from './contracts';
import { ApiDataProvider, IndexedDbDataProvider, MockDataProvider } from './providers';
import { ApiClient } from './api-client';
import { ApiOperationsRepository } from './repositories/operations-api';
import { StoreOperationsRepository } from './repositories/operations-store';
import { ApiApprovalsRepository } from './repositories/approvals-api';
import { ApiFilesRepository } from './repositories/files-api';

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

/** Cliente HTTP para o modo api. Base URL vem de VITE_API_BASE_URL. */
function apiClient(): ApiClient {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? '';
  return new ApiClient({ baseUrl });
}

/**
 * Repositórios de domínio resolvidos por configuração. Componentes consomem o
 * contrato; a troca mock/indexeddb ↔ api não altera nenhum componente.
 */
export function getOperationsRepository(): OperationsRepository {
  return resolveKind() === 'api'
    ? new ApiOperationsRepository(apiClient())
    : new StoreOperationsRepository();
}

export function getApprovalsRepository(): ApprovalsRepository {
  if (resolveKind() === 'api') return new ApiApprovalsRepository(apiClient());
  throw new Error(
    'ApprovalsRepository: em demonstração use a store (useAppStore). Repo HTTP só no modo api.',
  );
}

export function getFilesRepository(): FilesRepository {
  if (resolveKind() === 'api') return new ApiFilesRepository(apiClient());
  throw new Error(
    'FilesRepository: em demonstração use a store (useAppStore). Repo HTTP só no modo api.',
  );
}
