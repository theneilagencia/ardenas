/**
 * ARDEN-PRD-001.2A.2 — Catálogo de destinos de rede/egress (OFFLINE, provider-neutro).
 *
 * Egress padrão DENY. Anthropic e internet genérica são BLOCKED. Nenhum domínio Anthropic
 * jamais entra na allowlist — invariante do produto (provider Anthropic DISABLED).
 */

export type DestinationStatus = 'REQUIRED' | 'OPTIONAL' | 'BLOCKED' | 'UNVERIFIED';

export interface NetworkDestination {
  readonly id: string;
  readonly description: string;
  readonly status: DestinationStatus;
}

export const NETWORK_DESTINATION_CATALOG: readonly NetworkDestination[] = [
  { id: 'postgresql', description: 'Banco PostgreSQL gerenciado (rede privada)', status: 'REQUIRED' },
  { id: 'secret-manager', description: 'Secret manager (endpoint privado)', status: 'UNVERIFIED' }, // REQUIRED após seleção
  { id: 'observability', description: 'Exportador de logs/métricas/traces', status: 'UNVERIFIED' }, // REQUIRED após seleção
  { id: 'container-registry', description: 'Pull de imagem no deploy', status: 'UNVERIFIED' }, // REQUIRED após seleção
  { id: 'anthropic', description: 'Anthropic API — BLOQUEADO (provider DISABLED)', status: 'BLOCKED' },
  { id: 'generic-internet', description: 'Internet genérica — BLOQUEADO', status: 'BLOCKED' },
] as const;

/** Padrões que NUNCA podem aparecer numa allowlist de egress. */
const ANTHROPIC_PATTERNS = [/anthropic/i, /claude\.ai/i];

export interface EgressPolicyCheck {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

/**
 * Valida uma allowlist candidata de egress. Falha se contiver qualquer destino Anthropic ou
 * um curinga total, ou se o default não for DENY.
 */
export function validateEgressAllowlist(allowlist: readonly string[], defaultPolicy: 'DENY' | 'ALLOW'): EgressPolicyCheck {
  const errors: string[] = [];
  if (defaultPolicy !== 'DENY') errors.push('egress default deve ser DENY');
  for (const entry of allowlist) {
    if (entry === '*' || entry === '0.0.0.0/0' || entry === '::/0') {
      errors.push(`curinga total proibido na allowlist: ${entry}`);
    }
    if (ANTHROPIC_PATTERNS.some((p) => p.test(entry))) {
      errors.push(`destino Anthropic proibido na allowlist: ${entry}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function catalogHasAnthropicAllowed(): boolean {
  return NETWORK_DESTINATION_CATALOG.some(
    (d) => ANTHROPIC_PATTERNS.some((p) => p.test(d.id) || p.test(d.description)) && d.status !== 'BLOCKED',
  );
}
