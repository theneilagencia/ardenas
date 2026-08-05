/**
 * ARDEN-PRD-001.2A.2 — Schema e validador das definições de alerta (OFFLINE).
 * Sem backend específico. Valida forma, unicidade de id e presença de runbook.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const alertSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id kebab-case'),
    severity: z.enum(['SEV-1', 'SEV-2', 'SEV-3']),
    signal: z.string().min(1),
    condition: z.string().min(1),
    window: z.string().regex(/^\d+[smhd]$/, 'janela ex.: 5m, 1h, 1d'),
    ownerRole: z.string().min(1), // PAPEL (nunca nome pessoal); pode ser "TBD"
    runbook: z.string().min(1),
    notificationPolicy: z.enum(['page', 'ticket', 'silent']),
    productionBlocking: z.boolean(),
  })
  .strict();

export const alertFileSchema = z.object({
  alerts: z.array(alertSchema).min(1),
}).passthrough();

export type AlertDefinition = z.infer<typeof alertSchema>;

export interface AlertValidationResult {
  readonly ok: boolean;
  readonly count: number;
  readonly errors: readonly string[];
}

const PERSONAL_NAME_HINT = /@|\bnome\b/i;

export function validateAlertDefinitions(doc: unknown): AlertValidationResult {
  const parsed = alertFileSchema.safeParse(doc);
  if (!parsed.success) {
    return { ok: false, count: 0, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const a of parsed.data.alerts) {
    if (ids.has(a.id)) errors.push(`id duplicado: ${a.id}`);
    ids.add(a.id);
    // ownerRole nunca deve parecer nome pessoal (email/"nome").
    if (PERSONAL_NAME_HINT.test(a.ownerRole)) errors.push(`ownerRole parece nome pessoal: ${a.id}`);
  }
  return { ok: errors.length === 0, count: parsed.data.alerts.length, errors };
}

export function loadAndValidateAlerts(path = 'config/infrastructure/alert-definitions.json'): AlertValidationResult {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) return { ok: false, count: 0, errors: [`arquivo de alertas ausente: ${path}`] };
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    return { ok: false, count: 0, errors: ['JSON de alertas inválido'] };
  }
  return validateAlertDefinitions(doc);
}
