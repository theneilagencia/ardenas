/**
 * ARDEN-PRD-001.2A.2 — Contrato e validador do manifesto de decisão de infraestrutura.
 *
 * Provider-neutro e OFFLINE. Não cria recurso, não seleciona fornecedor, não usa
 * credencial. Todo campo bloqueante começa com um SENTINELA de pendência; o gate de
 * entrada do ARDEN-PRD-001.2B só passa quando TODOS os campos bloqueantes tiverem valor
 * real (não sentinela) e a ADR estiver ACCEPTED. Nenhum valor é logado além de metadata
 * sanitizada.
 */

import { z } from 'zod';

/** Sentinelas de pendência — nunca são um valor de decisão válido. */
export const DECISION_SENTINELS = [
  'TBD',
  'REQUIRES_APPROVAL',
  'REQUIRES_QUOTE',
  'REQUIRES_LEGAL_REVIEW',
] as const;
export type DecisionSentinel = (typeof DECISION_SENTINELS)[number];

export function isSentinel(value: unknown): value is DecisionSentinel {
  return typeof value === 'string' && (DECISION_SENTINELS as readonly string[]).includes(value);
}

/** Um campo bloqueante aceita string não vazia OU um sentinela. */
const blockingString = z.string().min(1, 'campo obrigatório (use um sentinela enquanto pendente)');

/** Provedores permitidos (nenhum é default; deve ser escolhido pelo negócio). */
export const ALLOWED_PROVIDERS = ['GCP', 'AWS', 'SPECIALIZED_PAAS'] as const;

/**
 * Schema ESTRUTURAL do manifesto. Valida forma e tipos; NÃO exige que os campos estejam
 * resolvidos (isso é papel de `evaluateDecisionReadiness`). Assim, o exemplo com
 * sentinelas é estruturalmente válido, porém não-pronto.
 */
export const productionDecisionSchema = z
  .object({
    provider: z.union([z.enum(ALLOWED_PROVIDERS), z.enum(DECISION_SENTINELS)]),
    primaryRegion: blockingString,
    recoveryRegion: z.union([blockingString, z.null()]),

    stagingMonthlyBudgetMinor: blockingString, // string p/ não inventar número e evitar bigint em YAML
    pilotMonthlyBudgetMinor: blockingString,
    productionMonthlyBudgetMinor: blockingString,
    currency: blockingString,

    minimumSlaPercent: blockingString,
    supportPlan: blockingString,

    approvedRpoMinutes: z.union([z.number().int().min(0), z.enum(DECISION_SENTINELS)]),
    approvedRtoMinutes: z.union([z.number().int().min(0), z.enum(DECISION_SENTINELS)]),

    managedPostgresProduct: blockingString,
    platformSecretManagerProduct: blockingString,
    apiComputeProduct: blockingString,
    workerComputeProduct: blockingString,
    containerRegistryProduct: blockingString,
    observabilityProduct: blockingString,

    legalApprovalReference: blockingString,
    dpaApprovalReference: blockingString,
    businessApprovalReference: blockingString,
    technicalApprovalReference: blockingString,
    operationsOwner: blockingString,

    adrStatus: z.enum(['PROPOSED', 'ACCEPTED']),

    decisionDate: blockingString,
    reviewDate: blockingString,
  })
  .strict();

export type ProductionDecisionManifest = z.infer<typeof productionDecisionSchema>;

/** Campos bloqueantes cujo valor não pode ser sentinela para o gate passar. */
export const BLOCKING_FIELDS: readonly (keyof ProductionDecisionManifest)[] = [
  'provider',
  'primaryRegion',
  'stagingMonthlyBudgetMinor',
  'pilotMonthlyBudgetMinor',
  'productionMonthlyBudgetMinor',
  'currency',
  'minimumSlaPercent',
  'supportPlan',
  'approvedRpoMinutes',
  'approvedRtoMinutes',
  'managedPostgresProduct',
  'platformSecretManagerProduct',
  'apiComputeProduct',
  'workerComputeProduct',
  'containerRegistryProduct',
  'observabilityProduct',
  'legalApprovalReference',
  'dpaApprovalReference',
  'businessApprovalReference',
  'technicalApprovalReference',
  'operationsOwner',
  'decisionDate',
  'reviewDate',
];
// Nota: `recoveryRegion` pode ser `null` (aceito) — não é bloqueante por si só.

export interface DecisionReadiness {
  readonly result: 'PASS' | 'FAIL';
  readonly adrAccepted: boolean;
  readonly pendingFields: readonly string[];
  readonly reasons: readonly string[];
}

/**
 * Avalia se o manifesto está PRONTO para destravar o 001.2B. Fail-closed: qualquer campo
 * bloqueante em sentinela/ausente, ou ADR != ACCEPTED, resulta em FAIL. Nunca faz bypass.
 */
export function evaluateDecisionReadiness(manifest: ProductionDecisionManifest): DecisionReadiness {
  const pending: string[] = [];
  for (const field of BLOCKING_FIELDS) {
    const value = manifest[field];
    if (value === undefined || value === null || isSentinel(value) || value === '') {
      pending.push(String(field));
    }
  }
  const adrAccepted = manifest.adrStatus === 'ACCEPTED';
  const reasons: string[] = [];
  if (!adrAccepted) reasons.push('ADR-0001 não está ACCEPTED');
  for (const f of pending) reasons.push(`campo bloqueante pendente: ${f}`);

  return {
    result: adrAccepted && pending.length === 0 ? 'PASS' : 'FAIL',
    adrAccepted,
    pendingFields: pending,
    reasons,
  };
}

export interface ManifestParseResult {
  readonly ok: boolean;
  readonly manifest?: ProductionDecisionManifest;
  readonly errors: readonly string[];
}

/** Valida a forma do manifesto (sanitizado — mensagens sem valores de campo). */
export function parseDecisionManifest(raw: unknown): ManifestParseResult {
  const parsed = productionDecisionSchema.safeParse(raw);
  if (parsed.success) return { ok: true, manifest: parsed.data, errors: [] };
  const errors = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  return { ok: false, errors };
}
