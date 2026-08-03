/**
 * Arden.AS API — guarda de AUSÊNCIA DE EXECUÇÃO do provider Anthropic (ARDEN-BE-008.2 §47).
 *
 * Comprova que nada torna o Anthropic executável nesta fase: nenhum SDK, nenhuma chamada
 * `messages.create`, nenhum `fetch` para o domínio Anthropic, nenhum provider executável
 * registrado no runtime, nenhum endpoint de geração, provider/modelos DISABLED.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MODEL_PROVIDER_DEFINITIONS,
  ANTHROPIC_MODEL_CATALOG,
  ANTHROPIC_PROVIDER_KEY,
} from '@arden/contracts';

const API_SRC = resolve(__dirname, '../../..', 'src');
const REPO_ROOT = resolve(__dirname, '../../../../..');
// ARDEN-BE-008.3: o SDK oficial é permitido, mas SOMENTE dentro da borda de transporte.
const SDK_BOUNDARY = resolve(__dirname, 'anthropic', 'sdk');
const FORBIDDEN_SDKS = ['openai', '@aws-sdk/client-bedrock-runtime', '@google-cloud/vertexai', 'langchain'];

/** Varre recursivamente os fontes de PRODUÇÃO (.ts, exclui specs), pulando a borda do SDK. */
function readProductionTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (full === SDK_BOUNDARY) continue; // a borda do SDK é a ÚNICA que pode importar o SDK.
    if (statSync(full).isDirectory()) {
      out.push(...readProductionTs(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.test.ts')) {
      out.push(readFileSync(full, 'utf8'));
    }
  }
  return out;
}

/** Varre TODOS os fontes de produção, INCLUINDO a borda do SDK. */
function readAllProductionTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...readAllProductionTs(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.test.ts')) {
      out.push(readFileSync(full, 'utf8'));
    }
  }
  return out;
}

describe('Anthropic — ausência de dependência de SDK', () => {
  it('nenhum package.json declara SDK comercial', () => {
    for (const rel of ['package.json', 'apps/api/package.json', 'packages/contracts/package.json']) {
      const p = resolve(REPO_ROOT, rel);
      if (!existsSync(p)) continue;
      const pkg = JSON.parse(readFileSync(p, 'utf8'));
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      for (const sdk of FORBIDDEN_SDKS) expect(deps[sdk], `${rel} não deve declarar ${sdk}`).toBeUndefined();
    }
  });
});

describe('Anthropic — SDK e chamada real confinados à borda de transporte', () => {
  const outsideBoundary = readProductionTs(API_SRC).join('\n');
  it('FORA da borda sdk/: nenhum import do SDK nem messages.create', () => {
    expect(/@anthropic-ai\/sdk/.test(outsideBoundary)).toBe(false);
    expect(/messages\.create\s*\(/.test(outsideBoundary)).toBe(false);
  });
  it('nenhum fonte (nem a borda) faz fetch/axios manual para o domínio Anthropic', () => {
    const all = readAllProductionTs(API_SRC).join('\n');
    expect(/fetch\s*\(\s*[`'"]https?:\/\/api\.anthropic/.test(all)).toBe(false);
    expect(/from ['"]axios['"]/.test(all)).toBe(false);
  });
});

describe('Anthropic — provider/modelos persistidos não executáveis (catálogo)', () => {
  it('provider anthropic.direct permanece DISABLED / productionAllowed=false no catálogo canônico', () => {
    const p = MODEL_PROVIDER_DEFINITIONS.find((m) => m.key === ANTHROPIC_PROVIDER_KEY);
    expect(p?.status).toBe('DISABLED');
    expect(p?.productionAllowed).toBe(false);
  });
  it('todos os modelos Anthropic permanecem DISABLED', () => {
    for (const m of ANTHROPIC_MODEL_CATALOG) expect(m.status).toBe('DISABLED');
  });
});
