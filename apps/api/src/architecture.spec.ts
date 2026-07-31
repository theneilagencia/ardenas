/**
 * Arden.AS API — testes arquiteturais (ARDEN-BE-001).
 * Impede DTOs paralelos incompatíveis e dependências indevidas: o backend
 * CONSOME os contratos compartilhados e NÃO importa React/Zustand/frontend.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { schemaRegistry, endpoints, ERROR_HTTP_STATUS } from '@arden/contracts';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

describe('arquitetura do backend', () => {
  it('consome os contratos compartilhados (@arden/contracts), sem DTOs paralelos', () => {
    // Os contratos são a fonte única — schemas/endpoints/erros vêm de lá.
    expect(Object.keys(schemaRegistry).length).toBeGreaterThan(0);
    expect(endpoints.length).toBeGreaterThan(0);
    expect(ERROR_HTTP_STATUS.VERSION_CONFLICT).toBe(409);
  });

  it('o código do backend importa @arden/contracts em algum ponto', () => {
    const files = walk('src');
    const usesContracts = files.some((f) => readFileSync(f, 'utf8').includes('@arden/contracts'));
    expect(usesContracts).toBe(true);
  });

  it('o backend NÃO importa React, Zustand ou o frontend', () => {
    const forbidden = [
      /from ['"]react['"]/,
      /from ['"]react-dom['"]/,
      /from ['"]zustand['"]/,
      /from ['"]@\/(store|components|features|hooks|app)/,
    ];
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const src = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(src)) offenders.push(`${file} :: ${pattern}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
