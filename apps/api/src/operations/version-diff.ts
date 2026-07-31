/**
 * Arden.AS API — diff estruturado entre versões (ARDEN-BE-003).
 * Compara `{ definition, authorityProfile }` de duas versões e devolve diferenças
 * por caminho (path). Arrays e objetos aninhados são tratados como folhas quando
 * mudam por completo, mantendo o diff legível e determinístico.
 */

import type { VersionFieldDiff } from '@arden/contracts';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function flatten(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    // Arrays e escalares são folhas (comparados por valor serializado).
    out.set(prefix, value);
  }
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Diferenças estruturadas entre dois snapshots comparáveis de versão. */
export function diffVersionSnapshots(base: unknown, other: unknown): VersionFieldDiff[] {
  const a = new Map<string, unknown>();
  const b = new Map<string, unknown>();
  flatten(base, '', a);
  flatten(other, '', b);

  const paths = new Set<string>([...a.keys(), ...b.keys()]);
  const diffs: VersionFieldDiff[] = [];
  for (const path of [...paths].sort()) {
    const before = a.has(path) ? a.get(path) : null;
    const after = b.has(path) ? b.get(path) : null;
    if (!equal(before, after)) {
      diffs.push({ path, before: (before ?? null) as VersionFieldDiff['before'], after: (after ?? null) as VersionFieldDiff['after'] });
    }
  }
  return diffs;
}
