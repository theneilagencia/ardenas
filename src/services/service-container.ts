/**
 * Arden.AS — composição de dependências de dados (ponto único).
 * A seleção da implementação por VITE_DATA_PROVIDER ocorre SÓ aqui. Componentes
 * consomem `ArdenServices` (via camada de aplicação/hooks) e nunca conhecem
 * implementações concretas, tabelas, HTTP, IndexedDB ou mocks.
 */

import type { ArdenServices } from './contracts';
import type { SnapshotStore } from './data/snapshot-store';
import { IndexedDbSnapshotStore, MemorySnapshotStore } from './data/snapshot-store';
import { ApiClient } from './api-client';
import { SnapshotOperationsRepository } from './repositories/operations-snapshot';
import { ApiOperationsRepository } from './repositories/operations-api';
import { SnapshotAuditRepository } from './repositories/audit-snapshot';
import { ApiAuditRepository } from './repositories/audit-api';
import { SnapshotApprovalsRepository } from './repositories/approvals-snapshot';
import { ApiApprovalsRepository } from './repositories/approvals-api';
import { SnapshotFilesRepository } from './repositories/files-snapshot';
import { ApiFilesRepository } from './repositories/files-api';

export type ProviderKind = 'mock' | 'indexeddb' | 'api';

export function resolveProviderKind(): ProviderKind {
  const raw = import.meta.env.VITE_DATA_PROVIDER as string | undefined;
  if (raw === 'api' || raw === 'mock' || raw === 'indexeddb') return raw;
  return 'indexeddb';
}

function apiClient(): ApiClient {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? '';
  return new ApiClient({ baseUrl });
}

// ── Gateway físico (modos mock/indexeddb) ────────────────────────────────────

let snapshotStore: SnapshotStore | null = null;

/**
 * Gateway de snapshot local. Só existe nos modos mock/indexeddb; no modo api os
 * dados vêm dos repositórios HTTP e não há snapshot local.
 */
export function getSnapshotStore(): SnapshotStore {
  if (snapshotStore) return snapshotStore;
  snapshotStore =
    resolveProviderKind() === 'mock' ? new MemorySnapshotStore() : new IndexedDbSnapshotStore();
  return snapshotStore;
}

/** Injeta um gateway determinístico (testes). Reseta os serviços derivados. */
export function setSnapshotStore(next: SnapshotStore): void {
  snapshotStore = next;
  services = null;
}

// ── Serviços de domínio ───────────────────────────────────────────────────────

let services: ArdenServices | null = null;

export function getServices(): ArdenServices {
  if (services) return services;
  const kind = resolveProviderKind();
  if (kind === 'api') {
    const client = apiClient();
    services = {
      operations: new ApiOperationsRepository(client),
      audit: new ApiAuditRepository(client),
      approvals: new ApiApprovalsRepository(client),
      files: new ApiFilesRepository(client),
    };
  } else {
    const store = getSnapshotStore();
    services = {
      operations: new SnapshotOperationsRepository(store),
      audit: new SnapshotAuditRepository(store),
      approvals: new SnapshotApprovalsRepository(store),
      files: new SnapshotFilesRepository(store),
    };
  }
  return services;
}

/** Injeta serviços (testes). */
export function setServices(next: ArdenServices | null): void {
  services = next;
}
