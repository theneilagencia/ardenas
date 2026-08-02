/**
 * Arden.AS API — máquinas de estado do runtime de agentes (ARDEN-BE-007.2 §11).
 *
 * Funções PURAS: definem TODAS as transições permitidas. Nenhuma mudança de estado
 * ocorre por PATCH genérico — toda transição passa por aqui, guardada por `revision`
 * no banco. Espelham os enums dos contratos (@arden/contracts).
 *
 * Terminais: AgentDefinition/ModelConfiguration `REVOKED`; AgentVersion `RETIRED`.
 * Proibidos explicitamente: PUBLISHED→DRAFT, RETIRED→PUBLISHED, qualquer saída de um
 * estado terminal.
 */

import type { AgentStatus, AgentVersionStatus, ModelConfigurationStatus } from '@arden/contracts';

// ── AgentDefinition ─────────────────────────────────────────────────────────────
export const AGENT_TERMINAL: ReadonlySet<AgentStatus> = new Set(['REVOKED']);
export const AGENT_TRANSITIONS: Readonly<Record<AgentStatus, readonly AgentStatus[]>> = {
  DRAFT: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['SUSPENDED', 'REVOKED'],
  SUSPENDED: ['ACTIVE', 'REVOKED'],
  REVOKED: [],
};
export function canTransitionAgent(from: AgentStatus, to: AgentStatus): boolean {
  return AGENT_TRANSITIONS[from]?.includes(to) ?? false;
}
export function isAgentTerminal(status: AgentStatus): boolean {
  return AGENT_TERMINAL.has(status);
}

// ── AgentVersion ────────────────────────────────────────────────────────────────
// Publicada é imutável; RETIRED é terminal. PUBLISHED→DRAFT e RETIRED→PUBLISHED nunca.
export const AGENT_VERSION_TERMINAL: ReadonlySet<AgentVersionStatus> = new Set(['RETIRED']);
export const AGENT_VERSION_TRANSITIONS: Readonly<Record<AgentVersionStatus, readonly AgentVersionStatus[]>> = {
  DRAFT: ['PUBLISHED', 'RETIRED'],
  PUBLISHED: ['RETIRED'],
  RETIRED: [],
};
export function canTransitionAgentVersion(from: AgentVersionStatus, to: AgentVersionStatus): boolean {
  return AGENT_VERSION_TRANSITIONS[from]?.includes(to) ?? false;
}
export function isAgentVersionTerminal(status: AgentVersionStatus): boolean {
  return AGENT_VERSION_TERMINAL.has(status);
}
/** Versões PUBLISHED e RETIRED têm conteúdo funcional imutável. */
export function isAgentVersionImmutable(status: AgentVersionStatus): boolean {
  return status === 'PUBLISHED' || status === 'RETIRED';
}

// ── ModelConfiguration ──────────────────────────────────────────────────────────
export const MODEL_CONFIGURATION_TERMINAL: ReadonlySet<ModelConfigurationStatus> = new Set(['REVOKED']);
export const MODEL_CONFIGURATION_TRANSITIONS: Readonly<Record<ModelConfigurationStatus, readonly ModelConfigurationStatus[]>> = {
  DRAFT: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['SUSPENDED', 'REVOKED'],
  SUSPENDED: ['ACTIVE', 'REVOKED'],
  REVOKED: [],
};
export function canTransitionModelConfiguration(from: ModelConfigurationStatus, to: ModelConfigurationStatus): boolean {
  return MODEL_CONFIGURATION_TRANSITIONS[from]?.includes(to) ?? false;
}
export function isModelConfigurationTerminal(status: ModelConfigurationStatus): boolean {
  return MODEL_CONFIGURATION_TERMINAL.has(status);
}
