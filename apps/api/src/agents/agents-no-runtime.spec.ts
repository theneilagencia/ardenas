/**
 * Arden.AS API — guarda de escopo do ARDEN-BE-007.2: APENAS persistência/admin.
 * Falha se aparecer runtime de LLM, executor de agente, SDK de provider ou rota de
 * execução direta no módulo de agentes.
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

const files = walk(ROOT).filter((f) => !f.endsWith('.spec.ts'));

/** Remove comentários (linha e bloco) para não casar com prosa explicativa. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('escopo 007.2 — sem runtime, SDK ou execução', () => {
  it('nenhum arquivo importa SDK de LLM', () => {
    const forbidden = ['@anthropic-ai', "'openai'", 'bedrock', 'vertexai', 'langchain', 'llamaindex'];
    for (const f of files) {
      const src = readFileSync(f, 'utf8').toLowerCase();
      for (const dep of forbidden) expect(src.includes(dep.toLowerCase()), `${f} → ${dep}`).toBe(false);
    }
  });

  it('nenhuma classe de execução/runtime de agente é definida', () => {
    const forbidden = ['ExecuteAgentService', 'AgentStepExecutor', 'class AgentRuntime', 'ModelProviderRuntime', 'callModel', 'generateCompletion'];
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
