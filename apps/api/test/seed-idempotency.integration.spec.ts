/**
 * ARDEN-SCOPE-002 GAP-008 — o seed do catálogo de identidade é idempotente E
 * concorrência-seguro. Antes, `permission.upsert` em laço (SELECT-then-write) sofria
 * corrida de unique-constraint sob re-seed simultâneo. Este teste executa o seed em
 * PARALELO várias vezes e comprova: sem erro, contagens estáveis, sem duplicatas.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { seedIdentityCatalog } from '../prisma/seed';
import { ALL_PERMISSIONS } from '../../../src/domain/permissions';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Garante o catálogo aplicado (migrations já rodaram no ambiente de teste).
  await seedIdentityCatalog(prisma);
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('ARDEN-SCOPE-002 — seed idempotente e concorrência-seguro', () => {
  it('executa 6 seeds em PARALELO sem erro de constraint', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => seedIdentityCatalog(prisma)),
    );
    for (const r of results) {
      expect(r.permissions).toBe(ALL_PERMISSIONS.length);
      expect(r.roles).toBeGreaterThan(0);
    }
  });

  it('não cria permissões duplicadas (contagem == catálogo canônico)', async () => {
    const distinct = await prisma.permission.findMany({ select: { key: true } });
    const keys = distinct.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length); // sem duplicatas
    // Todas as permissões canônicas presentes.
    for (const k of ALL_PERMISSIONS) expect(keys).toContain(k);
  });

  it('não cria system-roles duplicados sob re-seed', async () => {
    const rows = await prisma.role.findMany({ where: { organizationId: null, system: true }, select: { key: true } });
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length); // um por key, sem duplicata
  });

  it('segunda execução sequencial não altera contagens (idempotência)', async () => {
    const before = await prisma.permission.count();
    await seedIdentityCatalog(prisma);
    const after = await prisma.permission.count();
    expect(after).toBe(before);
  });
});
