/**
 * Arden.AS API — guardas de segurança do provider Anthropic (ARDEN-BE-008.1).
 * Canário de segredo, guard de dependências (nenhum SDK comercial), guard de rede
 * (adapter puro), credencial write-only, base URL travada, provider NÃO executável.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  anthropicCredentialMetadata,
  anthropicConnectionConfiguration,
  ANTHROPIC_PROVIDER_DEFINITION_CONTRACT,
} from '@arden/contracts';

const HERE = __dirname;
const REPO_ROOT = resolve(HERE, '../../../../../..');
const CANARY = 'ARDEN_BE008_ANTHROPIC_CONTRACT_SECRET_CANARY';
const CONTRACTS_DIR = resolve(REPO_ROOT, 'src/contracts/model-providers/anthropic');

const FORBIDDEN_SDKS = ['@anthropic-ai/sdk', 'anthropic', 'openai', '@aws-sdk/client-bedrock-runtime', '@google-cloud/vertexai', 'langchain', 'llamaindex'];
const PKG_FILES = ['package.json', 'apps/api/package.json', 'src/contracts/package.json'];

/** Lê apenas os fontes de PRODUÇÃO (.ts, exclui specs de teste). */
function readDirTs(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && !f.endsWith('.test.ts'))
    .map((f) => readFileSync(resolve(dir, f), 'utf8'));
}

describe('Anthropic — guard de dependências (nenhum SDK comercial instalado)', () => {
  it('nenhum package.json declara SDK comercial', () => {
    for (const rel of PKG_FILES) {
      const p = resolve(REPO_ROOT, rel);
      if (!existsSync(p)) continue;
      const pkg = JSON.parse(readFileSync(p, 'utf8'));
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      for (const sdk of FORBIDDEN_SDKS) expect(deps[sdk], `${rel} não deve declarar ${sdk}`).toBeUndefined();
      // 'ai' (Vercel AI SDK) proibido como dependência exata.
      expect(deps['ai']).toBeUndefined();
    }
  });
});

describe('Anthropic — guard de rede (adapter puro, sem chamada real)', () => {
  it('nenhum arquivo do adapter faz fetch/http/axios nem importa SDK', () => {
    const files = readDirTs(HERE);
    const joined = files.join('\n');
    expect(/\bfetch\s*\(/.test(joined)).toBe(false);
    expect(/from ['"](node:)?https?['"]/.test(joined)).toBe(false);
    expect(/require\(['"](node:)?https?['"]\)/.test(joined)).toBe(false);
    expect(/from ['"]axios['"]/.test(joined)).toBe(false);
    expect(/@anthropic-ai\/sdk/.test(joined)).toBe(false);
  });
  it('adapter NÃO expõe um provider executável (sem client HTTP/SDK)', () => {
    const names = readdirSync(HERE);
    expect(names).not.toContain('anthropic-model-provider.ts');
    expect(names).not.toContain('anthropic-http-client.ts');
    expect(names).not.toContain('anthropic-sdk-client.ts');
    expect(ANTHROPIC_PROVIDER_DEFINITION_CONTRACT.status).toBe('DISABLED');
  });
});

describe('Anthropic — canário de segredo ausente do código/contratos', () => {
  it('canário não aparece nos fontes do adapter nem dos contratos', () => {
    const read = (dir: string, skipSafety: boolean) =>
      readdirSync(dir)
        .filter((f) => f.endsWith('.ts') && !(skipSafety && f.includes('anthropic-safety')))
        .map((f) => readFileSync(resolve(dir, f), 'utf8'));
    const joined = [...read(HERE, true), ...read(CONTRACTS_DIR, false)].join('\n');
    expect(joined.includes(CANARY)).toBe(false);
  });
});

describe('Anthropic — credencial write-only e base URL travada', () => {
  it('metadados de credencial NÃO têm apiKey (write-only)', () => {
    const parsed = anthropicCredentialMetadata.safeParse({ fingerprint: 'fp', status: 'ACTIVE', createdAt: 'now' });
    expect(parsed.success).toBe(true);
    expect(Object.keys(anthropicCredentialMetadata.shape)).not.toContain('apiKey');
  });
  it('baseUrlMode só aceita OFFICIAL (sem override arbitrário)', () => {
    expect(anthropicConnectionConfiguration.safeParse({ baseUrlMode: 'CUSTOM', timeoutMs: 1000, maximumRetries: 1 }).success).toBe(false);
    expect(anthropicConnectionConfiguration.safeParse({ baseUrlMode: 'OFFICIAL', timeoutMs: 1000, maximumRetries: 1 }).success).toBe(true);
  });
});
