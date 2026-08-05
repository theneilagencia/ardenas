/**
 * ARDEN-PRD-001.2A.2 — Suíte de smoke provider-neutra para staging futuro (OFFLINE-safe).
 *
 * A suíte só executa contra uma URL passada EXPLICITAMENTE. Sem URL → NÃO executa (não
 * assume localhost). Nunca exercita Anthropic nem chamadas externas não aprovadas.
 */

export const SMOKE_CHECKS = [
  'live',
  'ready',
  'authentication',
  'tenant-isolation',
  'simple-resource-crud',
  'worker-job-lifecycle',
  'connector-vault-canary',
  'migration-status',
  'openapi',
  'no-anthropic',
  'no-unapproved-external-calls',
] as const;
export type SmokeCheck = (typeof SMOKE_CHECKS)[number];

export interface SmokePlan {
  readonly willExecute: boolean;
  readonly reason?: string;
  readonly targetUrl?: string;
  readonly checks: readonly SmokeCheck[];
}

/**
 * Resolve o plano de smoke. `targetUrl` deve ser fornecido explicitamente. Rejeita ausência
 * de URL e rejeita alvo Anthropic. Nunca aponta implicitamente para localhost.
 */
export function planSmoke(targetUrl: string | undefined): SmokePlan {
  if (!targetUrl || targetUrl.trim() === '') {
    return { willExecute: false, reason: 'URL de smoke ausente — não executa', checks: SMOKE_CHECKS };
  }
  if (/anthropic|claude\.ai/i.test(targetUrl)) {
    return { willExecute: false, reason: 'alvo Anthropic proibido', checks: SMOKE_CHECKS };
  }
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return { willExecute: false, reason: 'URL inválida', checks: SMOKE_CHECKS };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { willExecute: false, reason: 'protocolo não suportado', checks: SMOKE_CHECKS };
  }
  return { willExecute: true, targetUrl, checks: SMOKE_CHECKS };
}
