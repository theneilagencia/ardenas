/**
 * Arden.AS API — testes do diff estruturado de versões (ARDEN-BE-003).
 */

import { describe, expect, it } from 'vitest';
import { diffVersionSnapshots } from './version-diff';

describe('diffVersionSnapshots', () => {
  it('versões idênticas não têm diferenças', () => {
    const snap = { definition: { objective: 'x' }, authorityProfile: { level: 1 } };
    expect(diffVersionSnapshots(snap, snap)).toEqual([]);
  });

  it('detecta mudança em um campo escalar aninhado', () => {
    const diffs = diffVersionSnapshots(
      { definition: { objective: 'antes' } },
      { definition: { objective: 'depois' } },
    );
    expect(diffs).toContainEqual({ path: 'definition.objective', before: 'antes', after: 'depois' });
  });

  it('detecta mudança de nível de autoridade', () => {
    const diffs = diffVersionSnapshots({ authorityProfile: { level: 1 } }, { authorityProfile: { level: 3 } });
    expect(diffs).toContainEqual({ path: 'authorityProfile.level', before: 1, after: 3 });
  });

  it('trata arrays como folhas (uma diferença no caminho do array)', () => {
    const diffs = diffVersionSnapshots(
      { definition: { triggers: ['a'] } },
      { definition: { triggers: ['a', 'b'] } },
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('definition.triggers');
  });

  it('reporta campos adicionados/removidos com null do lado ausente', () => {
    const diffs = diffVersionSnapshots({ definition: {} }, { definition: { evidencePolicy: 'x' } });
    expect(diffs).toContainEqual({ path: 'definition.evidencePolicy', before: null, after: 'x' });
  });
});
