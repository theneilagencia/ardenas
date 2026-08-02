/**
 * Arden.AS API — testes do hash e da projeção do catálogo (ARDEN-BE-006.3).
 * Projeção testada em memória (sem banco): idempotência, deprecação e desabilitação.
 */

import { describe, expect, it } from 'vitest';
import { stableHash } from './connector-catalog.hash';
import { runCatalogProjection, type CatalogDbClient } from './project-catalog';

describe('hash determinístico', () => {
  it('mesmo conteúdo, ordem de chaves diferente → mesmo hash', () => {
    const a = { key: 'system.http', version: '1', capabilityKeys: ['a', 'b'], nested: { x: 1, y: 2 } };
    const b = { nested: { y: 2, x: 1 }, capabilityKeys: ['a', 'b'], version: '1', key: 'system.http' };
    expect(stableHash(a)).toBe(stableHash(b));
  });
  it('conteúdo diferente → hash diferente', () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });
});

/** Banco de catálogo em MEMÓRIA implementando o subconjunto necessário. */
function memoryDb() {
  let seq = 0;
  const defs: Record<string, Record<string, unknown>> = {};
  const tools: Record<string, Record<string, unknown>> = {};
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  const client: CatalogDbClient & { _defs: typeof defs; _tools: typeof tools } = {
    _defs: defs,
    _tools: tools,
    connectorDefinition: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return (Object.values(defs).find((r) => match(r, where)) as never) ?? null;
      },
      async findMany() {
        return Object.values(defs) as never;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const id = `def_${++seq}`;
        defs[id] = { id, ...data };
        return { id };
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        defs[where.id] = { ...defs[where.id], ...data };
        return { id: where.id };
      },
    },
    connectorToolDefinition: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return (Object.values(tools).find((r) => match(r, where)) as never) ?? null;
      },
      async findMany({ where }: { where?: Record<string, unknown> } = {}) {
        return Object.values(tools).filter((r) => (where ? match(r, where) : true)) as never;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const id = `tool_${++seq}`;
        tools[id] = { id, ...data };
        return { id };
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        tools[where.id] = { ...tools[where.id], ...data };
        return { id: where.id };
      },
    },
  };
  return client;
}

describe('projeção do catálogo (em memória)', () => {
  it('primeira execução cria; segunda deixa tudo unchanged', async () => {
    const db = memoryDb();
    const first = await runCatalogProjection(db);
    expect(first.connectorsCreated).toBeGreaterThanOrEqual(3);
    expect(first.toolsCreated).toBeGreaterThanOrEqual(5);

    const second = await runCatalogProjection(db);
    expect(second.connectorsCreated).toBe(0);
    expect(second.toolsCreated).toBe(0);
    expect(second.connectorsUnchanged).toBe(first.connectorsCreated + first.connectorsUpdated + first.connectorsUnchanged);
    expect(second.toolsUnchanged).toBe(first.toolsCreated + first.toolsUpdated + first.toolsUnchanged);
  });

  it('conector removido do canônico → DEPRECATED (não apagado); tool → disabled', async () => {
    const db = memoryDb();
    await runCatalogProjection(db);
    // Injeta um conector system-managed "fantasma" ausente do canônico + uma tool.
    await db.connectorDefinition.create({ data: { key: 'system.ghost', version: '1', status: 'ACTIVE', systemManaged: true } });
    const ghost = Object.values(db._defs).find((d) => d.key === 'system.ghost')! as { id: string };
    await db.connectorToolDefinition.create({ data: { connectorDefinitionId: ghost.id, key: 'ghost.tool', version: '1', active: true, catalogHash: 'x' } });
    // E uma tool fantasma sob um conector REAL (system.http) para exercitar disable.
    const httpDef = Object.values(db._defs).find((d) => d.key === 'system.http')! as { id: string };
    await db.connectorToolDefinition.create({ data: { connectorDefinitionId: httpDef.id, key: 'http.ghost', version: '1', active: true, catalogHash: 'y' } });

    const res = await runCatalogProjection(db);
    expect(res.connectorsDeprecated).toBeGreaterThanOrEqual(1);
    expect(res.toolsDisabled).toBeGreaterThanOrEqual(1);
    // Nada foi apagado.
    expect(Object.values(db._defs).some((d) => d.key === 'system.ghost' && d.status === 'DEPRECATED')).toBe(true);
    expect(Object.values(db._tools).some((t) => t.key === 'http.ghost' && t.active === false)).toBe(true);
  });
});
