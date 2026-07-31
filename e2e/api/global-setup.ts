/**
 * Arden.AS — preparação do backend para o E2E de modo `api` (ARDEN-BE-002).
 *
 * Aplica migrações, semeia o catálogo e faz o bootstrap de UMA organização para o
 * subject de teste `e2e-user` (provider fake). Determinístico e idempotente. Usa o
 * banco de TESTE. NÃO usa Supabase real.
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const E2E_SUBJECT = 'e2e-user';
export const E2E_ORG_NAME = 'Alpha E2E';
export const E2E_ORG_SLUG = 'alpha-e2e';

export default async function globalSetup(): Promise<void> {
  const apiDir = resolve(here, '../../apps/api');
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:5432/arden_test?schema=public',
    AUTH_PROVIDER: 'fake',
  };
  const run = (cmd: string, args: string[]) =>
    execFileSync(cmd, args, { cwd: apiDir, env, stdio: 'inherit' });

  run('npx', ['prisma', 'migrate', 'deploy']);
  run('npm', ['run', 'db:seed']);
  run('npm', [
    'run',
    'bootstrap:organization',
    '--',
    '--name',
    E2E_ORG_NAME,
    '--slug',
    E2E_ORG_SLUG,
    '--user-subject',
    E2E_SUBJECT,
    '--provider',
    'fake',
    '--yes',
  ]);
}
