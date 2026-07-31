/**
 * Arden.AS API — utilitários de teste de operações (ARDEN-BE-003).
 * Reusa os helpers de identidade; semeia atores com papéis de sistema e provê
 * definições/perfis válidos para o fluxo de publicação.
 */

import type { OperationDefinition, AuthorityProfile } from '@arden/contracts';
import { bearer, seedMembership, seedUser } from './identity-helpers';

let keyCounter = 0;
/** Chave de idempotência única por chamada (≥8 chars). */
export function idemKey(label = 'k'): string {
  keyCounter += 1;
  return `idem-${label}-${keyCounter.toString().padStart(6, '0')}`;
}

export interface Actor {
  userId: string;
  auth: string;
  subject: string;
}

/** Semeia um usuário membro do tenant com os papéis dados (default: admin). */
export async function seedActor(
  subject: string,
  organizationId: string,
  roleKeys: string[] = ['corporate_admin'],
): Promise<Actor> {
  const user = await seedUser({ subject });
  await seedMembership({ userId: user.id, organizationId, roleKeys });
  return { userId: user.id, auth: bearer(subject), subject };
}

/** Definição válida mínima para publicação (objetivo + resultado esperado). */
export function validDefinition(overrides: Partial<OperationDefinition> = {}): OperationDefinition {
  return {
    objective: 'Reduzir o tempo de resposta a incidentes.',
    expectedResult: 'MTTR abaixo de 30 minutos, verificável em relatório.',
    triggers: ['incident.opened'],
    steps: [],
    actions: [],
    approverIds: [],
    contextSourceIds: [],
    integrationIds: [],
    completionCriteria: ['Relatório mensal auditável.'],
    environment: 'production',
    evidencePolicy: 'Evidência por etapa.',
    ...overrides,
  };
}

/** Perfil de autoridade nível 3 (executa sob regras), sem ação destrutiva. */
export function level3Profile(overrides: Partial<AuthorityProfile> = {}): AuthorityProfile {
  return {
    level: 3,
    allowedActions: [{ key: 'notify.team', semanticLevel: 'execute_under_rule', destructive: false }],
    approvalRequired: false,
    approvalPolicyId: null,
    financialLimit: null,
    destructiveActionsAllowed: false,
    justificationRequired: false,
    ...overrides,
  };
}
