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

// ARDEN-BE-008.3: o SDK oficial passa a ser PERMITIDO, mas APENAS na versão fixada
// exata 0.115.0 (verificada no 008.1). Qualquer outra versão/SDK comercial → falha.
const ANTHROPIC_SDK = '@anthropic-ai/sdk';
const ANTHROPIC_SDK_PINNED = '0.115.0';
const FORBIDDEN_SDKS = ['anthropic', 'openai', '@aws-sdk/client-bedrock-runtime', '@google-cloud/vertexai', 'langchain', 'llamaindex'];
const PKG_FILES = ['package.json', 'apps/api/package.json', 'src/contracts/package.json'];

/** Lê apenas os fontes de PRODUÇÃO (.ts, exclui specs de teste). */
function readDirTs(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && !f.endsWith('.test.ts'))
    .map((f) => readFileSync(resolve(dir, f), 'utf8'));
}

describe('Anthropic — guard de dependências (só o SDK oficial fixado é permitido)', () => {
  it('nenhum package.json declara outro SDK comercial', () => {
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
  it('apenas apps/api declara o SDK oficial, fixado na versão exata 0.115.0', () => {
    const api = JSON.parse(readFileSync(resolve(REPO_ROOT, 'apps/api/package.json'), 'utf8'));
    const apiDeps = { ...(api.dependencies ?? {}), ...(api.devDependencies ?? {}) };
    expect(apiDeps[ANTHROPIC_SDK]).toBe(ANTHROPIC_SDK_PINNED); // sem ^, ~, *, latest.
    // Os pacotes raiz e de contratos NÃO declaram o SDK (isolamento).
    for (const rel of ['package.json', 'src/contracts/package.json']) {
      const p = resolve(REPO_ROOT, rel);
      if (!existsSync(p)) continue;
      const pkg = JSON.parse(readFileSync(p, 'utf8'));
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      expect(deps[ANTHROPIC_SDK], `${rel} não deve declarar o SDK`).toBeUndefined();
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
