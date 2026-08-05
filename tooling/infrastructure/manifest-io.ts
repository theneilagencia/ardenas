/**
 * ARDEN-PRD-001.2A.2 — Carregamento e avaliação do manifesto de decisão (OFFLINE).
 *
 * Lê YAML do disco, valida a forma e avalia a prontidão. Fail-closed: manifesto ausente
 * ou inválido → não-pronto. Usado por todas as ferramentas de produção (deploy, migrate,
 * backup, restore) como GUARD comum. Nenhum recurso externo é tocado.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import {
  evaluateDecisionReadiness,
  parseDecisionManifest,
  type DecisionReadiness,
  type ProductionDecisionManifest,
} from './decision-manifest';

export const DEFAULT_MANIFEST_PATH = 'config/infrastructure/production-decision.yaml';
export const EXAMPLE_MANIFEST_PATH = 'config/infrastructure/production-decision.example.yaml';

export interface LoadedManifest {
  readonly path: string;
  readonly usedExampleFallback: boolean;
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly manifest?: ProductionDecisionManifest;
  readonly readiness?: DecisionReadiness;
}

/**
 * Resolve o caminho do manifesto. Se o real não existir, cai para o EXEMPLO (que é sempre
 * não-pronto por conter sentinelas) — nunca inventa valores.
 */
export function resolveManifestPath(explicit?: string): { path: string; usedExampleFallback: boolean } {
  if (explicit) return { path: resolve(process.cwd(), explicit), usedExampleFallback: false };
  const real = resolve(process.cwd(), DEFAULT_MANIFEST_PATH);
  if (existsSync(real)) return { path: real, usedExampleFallback: false };
  return { path: resolve(process.cwd(), EXAMPLE_MANIFEST_PATH), usedExampleFallback: true };
}

export function loadManifest(explicit?: string): LoadedManifest {
  const { path, usedExampleFallback } = resolveManifestPath(explicit);
  if (!existsSync(path)) {
    return { path, usedExampleFallback, ok: false, errors: [`manifesto não encontrado: ${path}`] };
  }
  let doc: unknown;
  try {
    doc = yaml.load(readFileSync(path, 'utf8'));
  } catch {
    return { path, usedExampleFallback, ok: false, errors: ['YAML inválido no manifesto'] };
  }
  const parsed = parseDecisionManifest(doc);
  if (!parsed.ok || !parsed.manifest) {
    return { path, usedExampleFallback, ok: false, errors: parsed.errors };
  }
  const readiness = evaluateDecisionReadiness(parsed.manifest);
  return { path, usedExampleFallback, ok: true, errors: [], manifest: parsed.manifest, readiness };
}

/**
 * GUARD comum fail-closed para comandos de produção. Retorna o manifesto apenas quando ele
 * está estruturalmente válido E pronto (readiness PASS). Caso contrário lança com motivo
 * sanitizado. Nunca faz bypass.
 */
export function requireApprovedDecision(explicit?: string): ProductionDecisionManifest {
  const loaded = loadManifest(explicit);
  if (!loaded.ok) {
    throw new ProductionGuardError('MANIFEST_INVALID', loaded.errors);
  }
  if (!loaded.readiness || loaded.readiness.result !== 'PASS') {
    throw new ProductionGuardError('DECISION_NOT_APPROVED', loaded.readiness?.reasons ?? ['não-pronto']);
  }
  return loaded.manifest!;
}

export class ProductionGuardError extends Error {
  constructor(
    readonly code: 'MANIFEST_INVALID' | 'DECISION_NOT_APPROVED',
    readonly reasons: readonly string[],
  ) {
    super(`${code}: ${reasons.join('; ')}`);
    this.name = 'ProductionGuardError';
  }
}
