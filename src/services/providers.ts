/**
 * Arden.AS — providers de dados intercambiáveis.
 * Mock (memória), IndexedDb (Dexie) e Api (HTTP) implementam DataProvider.
 * A troca é por VITE_DATA_PROVIDER — nenhum componente sabe qual está ativo.
 */

import type { DataProvider, DomainSnapshot } from './contracts';
import { buildSeed } from '@/domain/seed';
import { db } from './db';
import { ApiClient } from './api-client';

/** Provider de memória — usado em testes e como fallback. */
export class MockDataProvider implements DataProvider {
  readonly kind = 'mock' as const;
  private snapshot: DomainSnapshot;

  constructor(seed?: DomainSnapshot) {
    this.snapshot = seed ?? buildSeed();
  }

  async load(): Promise<DomainSnapshot> {
    return structuredClone(this.snapshot);
  }

  async persist(snapshot: DomainSnapshot): Promise<void> {
    this.snapshot = structuredClone(snapshot);
  }

  async clear(): Promise<void> {
    this.snapshot = buildSeed();
  }
}

/** Provider de demonstração — persiste em IndexedDB. Semeia no primeiro uso. */
export class IndexedDbDataProvider implements DataProvider {
  readonly kind = 'indexeddb' as const;

  async load(): Promise<DomainSnapshot> {
    const row = await db.snapshots.get('current');
    if (row) return row.snapshot;
    const seed = buildSeed();
    await this.persist(seed);
    return seed;
  }

  async persist(snapshot: DomainSnapshot): Promise<void> {
    await db.snapshots.put({
      id: 'current',
      snapshot,
      savedAt: new Date().toISOString(),
    });
  }

  async clear(): Promise<void> {
    await db.snapshots.delete('current');
  }
}

/**
 * Provider de produção. A fonte da verdade é o backend; o snapshot é montado
 * a partir dos endpoints do contrato. Aqui deixamos o esqueleto conectado —
 * a implementação por domínio é responsabilidade da integração.
 */
export class ApiDataProvider implements DataProvider {
  readonly kind = 'api' as const;
  private client: ApiClient;

  constructor(baseUrl: string, organizationId?: string) {
    this.client = new ApiClient({ baseUrl, organizationId });
  }

  /** Cliente HTTP configurado, para os repositórios por domínio da integração. */
  raw(): ApiClient {
    return this.client;
  }

  async load(): Promise<DomainSnapshot> {
    // Em produção cada domínio é carregado por seu endpoint sob demanda.
    // O bootstrap completo é opcional e fica a cargo da integração.
    throw new Error(
      'ApiDataProvider.load: conectar aos endpoints do contrato (ver docs/handoff/API_CONTRACTS.md).',
    );
  }

  async persist(): Promise<void> {
    // No modo api, mutações vão por endpoint específico, não por snapshot.
    throw new Error('ApiDataProvider.persist não se aplica: use os endpoints do domínio.');
  }

  async clear(): Promise<void> {
    throw new Error('ApiDataProvider.clear não se aplica em produção.');
  }
}
