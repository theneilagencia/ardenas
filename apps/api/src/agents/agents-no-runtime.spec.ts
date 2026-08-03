/**
 * Arden.AS API — guarda de escopo do runtime de agentes (ARDEN-BE-007.3).
 * O runtime determinístico é permitido; falha se aparecer SDK COMERCIAL de LLM,
 * chamada real de rede a modelo ou rota de execução direta no módulo de agentes.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

// A borda do SDK (ARDEN-BE-008.3) é o ÚNICO lugar autorizado a importar o SDK comercial;
// é coberta por seu próprio teste arquitetural (anthropic-sdk-boundary.spec.ts). Excluída aqui.
const SDK_BOUNDARY = join('providers', 'anthropic', 'sdk');
const files = walk(ROOT).filter((f) => !f.endsWith('.spec.ts') && !f.includes(SDK_BOUNDARY));

/** Remove comentários (linha e bloco) para não casar com prosa explicativa. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('escopo 007.3 — runtime determinístico, sem SDK comercial nem execução direta', () => {
  it('nenhum arquivo importa SDK COMERCIAL de LLM', () => {
    const forbidden = ['@anthropic-ai', "'openai'", 'bedrock', 'vertexai', 'langchain', 'llamaindex', '@aws-sdk/client-bedrock', '@google-cloud/vertexai'];
    for (const f of files) {
      const src = readFileSync(f, 'utf8').toLowerCase();
      for (const dep of forbidden) expect(src.includes(dep.toLowerCase()), `${f} → ${dep}`).toBe(false);
    }
  });

  it('nenhum arquivo faz chamada de rede real (fetch/http/https/undici)', () => {
    const forbidden = ["from 'node:http'", "from 'node:https'", "from 'undici'", 'globalThis.fetch(', 'await fetch('];
    for (const f of files) {
      const src = stripComments(readFileSync(f, 'utf8'));
      for (const token of forbidden) expect(src.includes(token), `${f} → ${token}`).toBe(false);
    }
  });

  it('nenhum controller declara rota de execução direta (run/execute/chat/generate)', () => {
    for (const f of files.filter((x) => x.endsWith('.controller.ts'))) {
      const src = stripComments(readFileSync(f, 'utf8'));
      for (const bad of ["'run'", "':agentId/run'", "'execute'", "'chat'", "'generate'", '/models/generate']) {
        expect(src.includes(bad), `${f} → ${bad}`).toBe(false);
      }
    }
  });
});
