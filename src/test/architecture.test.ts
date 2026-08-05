/**
 * Regra arquitetural (ARDEN-FE-001): a UI (features/components) não conhece
 * implementações concretas de dados. Só pode tocar domínio via hooks/aplicação.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/features', 'src/components'];

// Imports proibidos na UI: implementações concretas de dados/persistência e de
// sessão. A UI só toca sessão/tenant pelo TenantContext e pelos hooks.
const FORBIDDEN = [
  /@\/services\/repositories\//,
  /@\/services\/providers/,
  /@\/services\/data\//,
  /@\/services\/db/,
  /@\/services\/service-container/,
  // Sessão: nenhuma implementação concreta de SessionRepository na UI.
  /@\/services\/session\/(?!active-context)/,
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('regra arquitetural de acesso a dados', () => {
  it('features/components não importam implementações concretas de dados', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const src = readFileSync(file, 'utf8');
        for (const pattern of FORBIDDEN) {
          if (pattern.test(src)) offenders.push(`${file} :: ${pattern}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('features/components não fixam organização/tenant em código (hardcoded)', () => {
    // A organização ativa vem da sessão (TenantContext) — nunca de um literal.
    const hardcodedOrg = /['"`]org_(arden|horizon)['"`]/;
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        if (hardcodedOrg.test(readFileSync(file, 'utf8'))) offenders.push(file);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('features/components não persistem domínio de operações direto na store', () => {
    const bad = /useAppStore\([^)]*\.(publishOperation|saveDraft|duplicateOperation|pauseOperation|resumeOperation|archiveOperation|createOperationFromAssessment|promoteEnvironment|rollbackEnvironment)/;
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        if (bad.test(readFileSync(file, 'utf8'))) offenders.push(file);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
