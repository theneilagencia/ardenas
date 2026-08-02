/**
 * Arden.AS API — testes da projeção do catálogo de providers (ARDEN-BE-007.2).
 * Fake DB in-memory: cria, é idempotente, marca removidos como DEPRECATED e mantém
 * `internal.test-model` com productionAllowed=false.
 */

import { describe, expect, it } from 'vitest';
import { MODEL_PROVIDER_DEFINITIONS } from '@arden/contracts';
import { runModelProviderCatalogProjection, type ModelProviderDbClient } from './project-model-providers';

interface Row {
  id: string; key: string; version: string; status: string; systemManaged: boolean; catalogHash: string; productionAllowed: boolean;
}

function fakeDb(seed: Row[] = []): { client: ModelProviderDbClient; rows: Row[] } {
  const rows = [...seed];
  let seq = seed.length;
  const client: ModelProviderDbClient = {
    modelProviderDefinition: {
      findFirst: async (args: unknown) => {
        const w = (args as { where: { key: string; version: string } }).where;
        return rows.find((r) => r.key === w.key && r.version === w.version) ?? null;
      },
      findMany: async () => [...rows].sort((a, b) => a.key.localeCompare(b.key)),
      create: async (args: unknown) => {
        const data = (args as { data: Omit<Row, 'id'> }).data;
        const row: Row = { id: `p_${++seq}`, ...data };
        rows.push(row);
        return { id: row.id };
      },
      update: async (args: unknown) => {
        const a = args as { where: { id: string }; data: Partial<Row> };
        const row = rows.find((r) => r.id === a.where.id)!;
        Object.assign(row, a.data);
        return { id: row.id };
      },
    },
  };
  return { client, rows };
}

describe('runModelProviderCatalogProjection', () => {
  it('cria o catálogo canônico na primeira projeção', async () => {
    const { client, rows } = fakeDb();
    const res = await runModelProviderCatalogProjection(client);
    expect(res.providersCreated).toBe(MODEL_PROVIDER_DEFINITIONS.length);
    expect(rows.length).toBe(MODEL_PROVIDER_DEFINITIONS.length);
  });

  it('é idempotente: segunda projeção não cria nem atualiza', async () => {
    const { client } = fakeDb();
    await runModelProviderCatalogProjection(client);
    const again = await runModelProviderCatalogProjection(client);
    expect(again.providersCreated).toBe(0);
    expect(again.providersUpdated).toBe(0);
    expect(again.providersUnchanged).toBe(MODEL_PROVIDER_DEFINITIONS.length);
  });

  it('internal.test-model é persistido com productionAllowed=false', async () => {
    const { client, rows } = fakeDb();
    await runModelProviderCatalogProjection(client);
    const test = rows.find((r) => r.key === 'internal.test-model')!;
    expect(test.productionAllowed).toBe(false);
    expect(test.systemManaged).toBe(true);
  });

  it('provider system-managed removido do canônico vira DEPRECATED (não apagado)', async () => {
    const { client, rows } = fakeDb([
      { id: 'p_old', key: 'internal.removed', version: '1', status: 'ACTIVE', systemManaged: true, catalogHash: 'x', productionAllowed: false },
    ]);
    const res = await runModelProviderCatalogProjection(client);
    expect(res.providersDeprecated).toBe(1);
    expect(rows.find((r) => r.key === 'internal.removed')!.status).toBe('DEPRECATED');
  });
});
