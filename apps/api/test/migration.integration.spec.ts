/**
 * Arden.AS API — testes de migração (ARDEN-BE-001).
 * Valida que a migração inicial aplica em banco migrado (status up-to-date),
 * que reaplicar (deploy) é idempotente e que as tabelas técnicas existem.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const apiDir = resolve(__dirname, '..');
const env = { ...process.env };
const prisma = new PrismaClient();

function prismaCli(args: string[]): string {
  return execFileSync('npx', ['prisma', ...args], { cwd: apiDir, env, encoding: 'utf8' });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migrations', () => {
  it('status reporta o banco em dia (migração aplicada)', () => {
    const out = prismaCli(['migrate', 'status']);
    expect(out).toMatch(/up to date|Database schema is up to date/i);
  });

  it('deploy é idempotente (não falha quando já aplicada)', () => {
    const out = prismaCli(['migrate', 'deploy']);
    expect(out).toMatch(/No pending migrations|already been applied|successfully applied/i);
  });

  it('as tabelas técnicas existem', async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('idempotency_records', 'application_metadata', '_prisma_migrations')
      ORDER BY table_name`;
    const names = rows.map((r) => r.table_name);
    expect(names).toContain('idempotency_records');
    expect(names).toContain('application_metadata');
    expect(names).toContain('_prisma_migrations');
  });
});
