/**
 * Arden.AS API — validação do Gradiente de Autoridade (ARDEN-BE-003, GAP-11).
 *
 * Função PURA (sem I/O) que valida um `AuthorityProfile` de NÍVEL DE VERSÃO para
 * publicação. Não é um motor de execução — apenas validação do perfil, conforme
 * docs/domain/AUTHORITY_PROFILE_MODEL_V1.md. O nível da versão é a classificação
 * principal para publicação.
 *
 * Regras por nível (semântica → numérico: observe=1, prepare=2,
 * execute_under_rule=3, execute_with_approval=4, blocked=5):
 *  - 1/2 (observa/prepara): não pode habilitar/permitir ações destrutivas.
 *  - 3 (executa sob regras): sem ação destrutiva irrestrita (contrato já exige que
 *    destrutiva ≥ execute_with_approval).
 *  - 4 (executa com aprovação): exige `approvalRequired`.
 *  - 5 (ações críticas): exige `approvalRequired` e `justificationRequired`
 *    (governança); não publica com configuração incompleta.
 * Além disso, o contrato (`publishableAuthorityProfile`) exige: ação destrutiva só
 * quando `destructiveActionsAllowed` e nunca abaixo de `execute_with_approval`.
 */

import {
  publishableAuthorityProfile,
  AUTHORITY_LEVEL_NUMBER,
  type AuthorityProfile,
} from '@arden/contracts';

export interface ValidationIssue {
  code: string;
  field?: string;
  message: string;
}

export interface AuthorityValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function validateAuthorityProfileForPublish(
  profile: AuthorityProfile,
): AuthorityValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // 1. Regras mínimas do contrato (destrutivas exigem permissão e nível ≥ 4).
  const contractCheck = publishableAuthorityProfile.safeParse(profile);
  if (!contractCheck.success) {
    for (const issue of contractCheck.error.issues) {
      errors.push({
        code: 'AUTHORITY_DESTRUCTIVE_ACTION_INVALID',
        field: `authorityProfile.${issue.path.join('.')}`,
        message: issue.message,
      });
    }
  }

  const hasDestructive = profile.allowedActions.some((a) => a.destructive);

  // 2. Níveis 1/2 não podem habilitar/permitir ações destrutivas.
  if (profile.level <= 2 && (profile.destructiveActionsAllowed || hasDestructive)) {
    errors.push({
      code: 'AUTHORITY_LEVEL_TOO_LOW_FOR_DESTRUCTIVE',
      field: 'authorityProfile.level',
      message: `Nível ${profile.level} (observa/prepara) não permite ações destrutivas.`,
    });
  }

  // 3. Nível ≥ 4 exige aprovação.
  if (profile.level >= 4 && !profile.approvalRequired) {
    errors.push({
      code: 'AUTHORITY_APPROVAL_REQUIRED',
      field: 'authorityProfile.approvalRequired',
      message: `Nível ${profile.level} exige aprovação humana (approvalRequired).`,
    });
  }

  // 4. Nível 5 (crítico) exige justificativa (governança adicional).
  if (profile.level === 5 && !profile.justificationRequired) {
    errors.push({
      code: 'AUTHORITY_JUSTIFICATION_REQUIRED',
      field: 'authorityProfile.justificationRequired',
      message: 'Nível 5 (crítico) exige justificativa (justificationRequired).',
    });
  }

  // Aviso: o nível declarado é menor que o de alguma ação permitida.
  const maxActionLevel = profile.allowedActions.reduce(
    (max, a) => Math.max(max, AUTHORITY_LEVEL_NUMBER[a.semanticLevel]),
    0,
  );
  if (maxActionLevel > profile.level) {
    warnings.push({
      code: 'AUTHORITY_LEVEL_BELOW_ACTIONS',
      field: 'authorityProfile.level',
      message: `Nível declarado (${profile.level}) é menor que o de uma ação permitida (${maxActionLevel}).`,
    });
  }

  return { errors, warnings };
}
