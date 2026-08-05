/**
 * ARDEN-PRD-001.2A.2 — Manifesto de artefato imutável (OFFLINE, provider-neutro).
 *
 * Gera/valida um manifesto identificando o artefato por commit SHA e hashes de conteúdo.
 * NUNCA inclui secret. O mesmo manifesto é promovido de staging → produção. Sem tag
 * `latest`: a identidade é sempre o commit SHA.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ArtifactManifest {
  readonly commitSha: string;
  readonly buildTimestamp: string;
  readonly applicationVersion: string;
  readonly frontendArtifactHash: string;
  readonly apiArtifactHash: string;
  readonly openApiHash: string;
  readonly migrationCount: number;
  readonly runtimeDependenciesHash: string;
}

/** Padrões proibidos que denunciariam vazamento de secret no manifesto. */
const FORBIDDEN_KEYS = /(secret|password|token|key|credential|private)/i;

function sha256OfFile(path: string): string {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) return 'MISSING';
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

export interface BuildManifestInput {
  readonly commitSha: string;
  readonly buildTimestamp: string;
  readonly applicationVersion: string;
  readonly migrationCount: number;
  /** Caminhos usados para computar hashes (todos não sensíveis). */
  readonly openApiPath?: string;
  readonly lockfilePath?: string;
}

export function buildArtifactManifest(input: BuildManifestInput): ArtifactManifest {
  return {
    commitSha: input.commitSha,
    buildTimestamp: input.buildTimestamp,
    applicationVersion: input.applicationVersion,
    // Hashes de artefatos de build; 'MISSING' quando não presentes localmente (fase pré-deploy).
    frontendArtifactHash: sha256OfFile('dist/index.html'),
    apiArtifactHash: sha256OfFile('apps/api/dist/main.js'),
    openApiHash: sha256OfFile(input.openApiPath ?? 'docs/api/openapi-v1.yaml'),
    migrationCount: input.migrationCount,
    runtimeDependenciesHash: sha256OfFile(input.lockfilePath ?? 'package-lock.json'),
  };
}

export interface ArtifactVerifyResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

/** Verifica invariantes do manifesto: SHA presente, sem `latest`, sem chaves de secret. */
export function verifyArtifactManifest(manifest: unknown): ArtifactVerifyResult {
  const errors: string[] = [];
  if (typeof manifest !== 'object' || manifest === null) {
    return { ok: false, errors: ['manifesto de artefato ausente/ inválido'] };
  }
  const m = manifest as Record<string, unknown>;
  if (typeof m.commitSha !== 'string' || m.commitSha.length < 7) {
    errors.push('commitSha ausente ou curto (identidade por SHA obrigatória)');
  }
  if (typeof m.commitSha === 'string' && m.commitSha.toLowerCase() === 'latest') {
    errors.push('tag `latest` proibida como identidade de artefato');
  }
  if (typeof m.migrationCount !== 'number') errors.push('migrationCount ausente');
  // Canário: nenhuma chave denota secret; nenhum valor parece secret embutido.
  for (const [k, v] of Object.entries(m)) {
    if (FORBIDDEN_KEYS.test(k)) errors.push(`chave proibida no manifesto: ${k}`);
    if (typeof v === 'string' && /BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}/.test(v)) {
      errors.push(`valor com aparência de secret em: ${k}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
