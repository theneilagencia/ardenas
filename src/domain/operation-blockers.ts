/**
 * Arden.AS — bloqueadores de publicação.
 * Validados na etapa 19 do wizard. Com qualquer bloqueador presente, a
 * publicação fica indisponível. Não é aviso: é impedimento.
 */

import { AUTHORITY_ORDER, type Operation } from './types';

export type BlockerCode =
  | 'owner_missing'
  | 'expected_result_missing'
  | 'environment_missing'
  | 'budget_missing'
  | 'evidence_missing'
  | 'integration_untested'
  | 'authority_incoherent'
  | 'approver_missing';

export interface Blocker {
  code: BlockerCode;
  /** Chave i18n da descrição. */
  messageKey: string;
}

interface BlockerContext {
  /** Integrações que já passaram em teste. */
  testedIntegrationIds: Set<string>;
}

const rank = (level: string) => AUTHORITY_ORDER.indexOf(level as never);

/**
 * Retorna a lista de bloqueadores presentes. Vazia significa publicável.
 */
export function computeBlockers(op: Partial<Operation>, ctx: BlockerContext): Blocker[] {
  const blockers: Blocker[] = [];

  if (!op.ownerId) {
    blockers.push({ code: 'owner_missing', messageKey: 'wizard.blocker.owner_missing' });
  }

  if (!op.expectedResult || op.expectedResult.trim() === '') {
    blockers.push({
      code: 'expected_result_missing',
      messageKey: 'wizard.blocker.expected_result_missing',
    });
  }

  if (!op.environment) {
    blockers.push({ code: 'environment_missing', messageKey: 'wizard.blocker.environment_missing' });
  }

  if (!op.budget || op.budget <= 0) {
    blockers.push({ code: 'budget_missing', messageKey: 'wizard.blocker.budget_missing' });
  }

  if (!op.evidencePolicy || op.evidencePolicy.trim() === '') {
    blockers.push({ code: 'evidence_missing', messageKey: 'wizard.blocker.evidence_missing' });
  }

  const integrationIds = op.integrationIds ?? [];
  const anyUntested = integrationIds.some((id) => !ctx.testedIntegrationIds.has(id));
  if (integrationIds.length > 0 && anyUntested) {
    blockers.push({
      code: 'integration_untested',
      messageKey: 'wizard.blocker.integration_untested',
    });
  }

  // Ações destrutivas ou irreversíveis nunca abaixo de execute_with_approval.
  const actions = op.actions ?? [];
  const incoherent = actions.some(
    (a) => a.destructive && rank(a.authorityLevel) < rank('execute_with_approval'),
  );
  if (incoherent) {
    blockers.push({
      code: 'authority_incoherent',
      messageKey: 'wizard.blocker.authority_incoherent',
    });
  }

  // Aprovador ausente em ação que exige aprovação.
  const needsApproval =
    (op.steps ?? []).some((s) => s.requiresApproval) ||
    actions.some((a) => a.authorityLevel === 'execute_with_approval');
  if (needsApproval && (op.approverIds ?? []).length === 0) {
    blockers.push({ code: 'approver_missing', messageKey: 'wizard.blocker.approver_missing' });
  }

  return blockers;
}

export function isPublishable(op: Partial<Operation>, ctx: BlockerContext): boolean {
  return computeBlockers(op, ctx).length === 0;
}
