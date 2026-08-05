/**
 * Arden.AS API — teste ARQUITETURAL da borda do SDK (ARDEN-BE-008.3 §8).
 *
 * O SDK `@anthropic-ai/sdk` só pode aparecer dentro de providers/anthropic/sdk/. Nenhum
 * outro fonte de produção (contratos, runtime, registry, controllers, repositórios, worker,
 * OpenAPI) pode importá-lo, e nenhum tipo do SDK pode escapar da borda.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const API_SRC = resolve(__dirname, '../../../..', 'src');
const SDK_BOUNDARY = resolve(__dirname, 'sdk');

interface Src { path: string; text: string }

function readAll(dir: string): Src[] {
  const out: Src[] = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...readAll(full));
    else if (name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.test.ts')) out.push({ path: full, text: readFileSync(full, 'utf8') });
  }
  return out;
}

describe('Anthropic — borda do SDK', () => {
  const all = readAll(API_SRC);

  it('somente arquivos sob providers/anthropic/sdk/ importam o SDK', () => {
    const importers = all.filter((s) => /@anthropic-ai\/sdk/.test(s.text)).map((s) => s.path);
    expect(importers.length).toBeGreaterThan(0); // a borda existe.
    for (const p of importers) expect(p.startsWith(SDK_BOUNDARY), `${p} não deveria importar o SDK`).toBe(true);
  });

  it('nenhum tipo `Anthropic.` (namespace do SDK) escapa da borda', () => {
    const leaks = all.filter((s) => !s.path.startsWith(SDK_BOUNDARY) && /\bAnthropic\.[A-Z]/.test(s.text)).map((s) => s.path);
    expect(leaks).toEqual([]);
  });

  it('contratos, runtime, registry, controllers e repositórios NÃO importam o SDK', () => {
    const forbidden = all.filter(
      (s) =>
        !s.path.startsWith(SDK_BOUNDARY) &&
        /(runtime\/|model-provider-registry|\.controller\.ts|\.repository\.ts|contracts\/)/.test(s.path) &&
        /@anthropic-ai\/sdk/.test(s.text),
    );
    expect(forbidden).toEqual([]);
  });
});
