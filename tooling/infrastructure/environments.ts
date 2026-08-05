/**
 * ARDEN-PRD-001.2A.2 — Contrato de ambientes e isolamento (OFFLINE, provider-neutro).
 *
 * staging / production / recovery. Cada ambiente exige recursos isolados. A matriz de
 * isolamento PROÍBE conexões cruzadas (staging→banco de produção, etc.).
 */

export type EnvironmentName = 'staging' | 'production' | 'recovery';

export interface EnvironmentContract {
  readonly name: EnvironmentName;
  readonly isolatedProjectOrAccount: true;
  readonly isolatedNetwork: true;
  readonly isolatedDatabase: true;
  readonly isolatedSecrets: true;
  readonly isolatedDomain: true;
  readonly isolatedLogs: true;
  readonly isolatedIdentities: true;
  readonly isolatedBudget: true;
}

export const ENVIRONMENT_CONTRACTS: readonly EnvironmentContract[] = (
  ['staging', 'production', 'recovery'] as const
).map((name) => ({
  name,
  isolatedProjectOrAccount: true,
  isolatedNetwork: true,
  isolatedDatabase: true,
  isolatedSecrets: true,
  isolatedDomain: true,
  isolatedLogs: true,
  isolatedIdentities: true,
  isolatedBudget: true,
}));

/** Uma referência de recurso pertence a um ambiente. */
export interface ResourceBinding {
  readonly environment: EnvironmentName;
  readonly databaseEnvironment: EnvironmentName;
  readonly secretsEnvironment: EnvironmentName;
  readonly queueEnvironment: EnvironmentName;
  readonly usesRuntimeCredentials: boolean;
}

export interface IsolationCheck {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

/**
 * Verifica a matriz de isolamento. Proíbe:
 * - staging apontar para banco/secrets/fila de produção;
 * - recovery usar credenciais de runtime;
 * - qualquer ambiente cruzar banco/secret/fila com outro.
 */
export function checkIsolation(binding: ResourceBinding): IsolationCheck {
  const v: string[] = [];
  if (binding.databaseEnvironment !== binding.environment) {
    v.push(`${binding.environment} aponta para banco de ${binding.databaseEnvironment}`);
  }
  if (binding.secretsEnvironment !== binding.environment) {
    v.push(`${binding.environment} usa secrets de ${binding.secretsEnvironment}`);
  }
  if (binding.queueEnvironment !== binding.environment) {
    v.push(`${binding.environment} consome fila de ${binding.queueEnvironment}`);
  }
  if (binding.environment === 'recovery' && binding.usesRuntimeCredentials) {
    v.push('recovery não pode usar credenciais de runtime');
  }
  return { ok: v.length === 0, violations: v };
}
