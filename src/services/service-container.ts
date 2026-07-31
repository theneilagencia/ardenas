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
import type { SessionRepository } from './session/session-contracts';
import { SnapshotSessionRepository } from './session/snapshot-session-repository';
import { ApiSessionRepository } from './session/api-session-repository';
import {
  IndexedDbSessionSelectionStore,
  MemorySessionSelectionStore,
} from './session/session-selection-store';
import { getActiveOrganizationId } from './session/active-context';
import { getAccessToken } from './session/access-token';
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

function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) ?? '';
}

function apiClient(): ApiClient {
  // O tenant vai no header X-Arden-Organization, derivado da sessão ativa; o token
  // Bearer vem do portador único de access token (BE-002).
  return new ApiClient({
    baseUrl: apiBaseUrl(),
    getOrganizationId: getActiveOrganizationId,
    getToken: getAccessToken,
  });
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
  sessionRepository = null;
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

// ── Sessão / tenant (ARDEN-FE-002) ────────────────────────────────────────────

let sessionRepository: SessionRepository | null = null;

/**
 * Repositório de sessão. Selecionado por VITE_DATA_PROVIDER, no MESMO ponto único
 * dos demais serviços. Modo `api` sem base URL lança erro tipado — nunca cai para
 * mock silenciosamente.
 */
export function getSessionRepository(): SessionRepository {
  if (sessionRepository) return sessionRepository;
  const kind = resolveProviderKind();
  if (kind === 'api') {
    sessionRepository = new ApiSessionRepository(apiClient(), apiBaseUrl());
  } else {
    const selection =
      kind === 'mock'
        ? new MemorySessionSelectionStore()
        : new IndexedDbSessionSelectionStore();
    sessionRepository = new SnapshotSessionRepository(getSnapshotStore(), selection);
  }
  return sessionRepository;
}

/** Injeta um repositório de sessão (testes). */
export function setSessionRepository(next: SessionRepository | null): void {
  sessionRepository = next;
}
