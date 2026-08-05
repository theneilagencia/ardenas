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

  /**
   * Monta o snapshot a partir dos endpoints do contrato (docs/handoff/API_CONTRACTS.md).
   * Cada coleção vem do seu GET; o envelope { data } é desembrulhado. Coleções sem
   * endpoint no contrato (derivadas ou ainda não expostas) chegam vazias.
   * Erros HTTP passam pelo mapa de tratamento do ApiClient (ArdenApiError).
   */
  async load(signal?: AbortSignal): Promise<DomainSnapshot> {
    const list = async <T>(path: string): Promise<T[]> => {
      const res = await this.client.get<T[] | { items: T[] }>(path, signal);
      const data = res.data as T[] | { items: T[] } | undefined;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray((data as { items: T[] }).items)) {
        return (data as { items: T[] }).items;
      }
      return [];
    };

    const [
      organizations,
      companies,
      people,
      roles,
      operations,
      executions,
      approvals,
      exceptions,
      evidence,
      policies,
      risks,
      integrations,
      contextSources,
      files,
      workUnits,
      budgets,
      auditEvents,
      notifications,
    ] = await Promise.all([
      list<DomainSnapshot['organizations'][number]>('/organizations'),
      list<DomainSnapshot['companies'][number]>('/companies'),
      list<DomainSnapshot['people'][number]>('/people'),
      list<DomainSnapshot['roles'][number]>('/roles'),
      list<DomainSnapshot['operations'][number]>('/operations'),
      list<DomainSnapshot['executions'][number]>('/executions'),
      list<DomainSnapshot['approvals'][number]>('/approvals'),
      list<DomainSnapshot['exceptions'][number]>('/exceptions'),
      list<DomainSnapshot['evidence'][number]>('/evidence'),
      list<DomainSnapshot['policies'][number]>('/policies'),
      list<DomainSnapshot['risks'][number]>('/risks'),
      list<DomainSnapshot['integrations'][number]>('/integrations'),
      list<DomainSnapshot['contextSources'][number]>('/context-sources'),
      list<DomainSnapshot['files'][number]>('/files/candidates'),
      list<DomainSnapshot['workUnits'][number]>('/work-units'),
      list<DomainSnapshot['budgets'][number]>('/budgets'),
      list<DomainSnapshot['auditEvents'][number]>('/audit-events'),
      list<DomainSnapshot['notifications'][number]>('/notifications'),
    ]);

    return {
      organizations,
      companies,
      people,
      roles,
      operations,
      executions,
      approvals,
      exceptions,
      evidence,
      policies,
      risks,
      integrations,
      contextSources,
      files,
      workUnits,
      budgets,
      auditEvents,
      notifications,
      // Coleções sem endpoint dedicado no contrato: preenchidas pela integração
      // quando expostas, vazias por padrão.
      units: [],
      areas: [],
      teams: [],
      costCenters: [],
      workUnitRequests: [],
      deployments: [],
      resultIndicators: [],
      authorityMatrix: [],
      assessments: [],
    };
  }

  async persist(): Promise<void> {
    // No modo api, mutações vão por endpoint específico, não por snapshot.
    throw new Error('ApiDataProvider.persist não se aplica: use os endpoints do domínio.');
  }

  async clear(): Promise<void> {
    throw new Error('ApiDataProvider.clear não se aplica em produção.');
  }
}
