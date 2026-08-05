/**
 * Arden.AS — API v1 · Gradiente de Autoridade (schemas) (ARDEN-FE-003).
 *
 * Formaliza o Gradiente como um `AuthorityProfile` de NÍVEL DE VERSÃO. Hoje o
 * frontend só tem autoridade por passo/ação (`OperationStep.authorityLevel`,
 * `OperationAction.authorityLevel`) e uma matriz de exibição (GAP-11) — não há um
 * perfil consolidado por versão. Este contrato define o que o backend deverá
 * validar; NÃO implementa autorização final. Inconsistências documentadas em
 * API_V1_OPEN_DECISIONS (D-003/D-004).
 *
 * Mapeamento nível semântico ↔ numérico (AUTHORITY_ORDER do domínio):
 *   observe=1 · prepare=2 · execute_under_rule=3 · execute_with_approval=4 · blocked=5
 * DECISÃO PENDENTE (D-003): direção semântica de `blocked` como "nível 5".
 */

import { z } from 'zod';
import { money } from '../common/timestamps';

export const authoritySemanticLevel = z.enum([
  'observe',
  'prepare',
  'execute_under_rule',
  'execute_with_approval',
  'blocked',
]);
export type AuthoritySemanticLevel = z.infer<typeof authoritySemanticLevel>;

export const AUTHORITY_LEVEL_NUMBER: Record<AuthoritySemanticLevel, 1 | 2 | 3 | 4 | 5> = {
  observe: 1,
  prepare: 2,
  execute_under_rule: 3,
  execute_with_approval: 4,
  blocked: 5,
};

export const authorityNumericLevel = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type AuthorityNumericLevel = z.infer<typeof authorityNumericLevel>;

/**
 * Ação permitida no gradiente. A TAXONOMIA canônica de `key` é DECISÃO PENDENTE
 * (D-004): hoje as ações são texto livre na matriz. `semanticLevel` reaproveita o
 * enum do domínio; `destructive` espelha `OperationAction.destructive`.
 */
export const authorityAction = z.object({
  key: z.string().min(1),
  semanticLevel: authoritySemanticLevel,
  destructive: z.boolean(),
});
export type AuthorityAction = z.infer<typeof authorityAction>;

export const authorityProfile = z.object({
  level: authorityNumericLevel,
  allowedActions: z.array(authorityAction),
  approvalRequired: z.boolean(),
  approvalPolicyId: z.string().nullable(),
  /** Limite financeiro SEMPRE com moeda (ou null). Reservado a escopos futuros. */
  financialLimit: money.nullable(),
  destructiveActionsAllowed: z.boolean(),
  justificationRequired: z.boolean(),
});
export type AuthorityProfile = z.infer<typeof authorityProfile>;

/**
 * Regras MÍNIMAS para publicação (executáveis no contrato; o backend será a
 * autoridade final). Espelham o bloqueador `authority_incoherent` do frontend:
 * ação destrutiva nunca abaixo de `execute_with_approval`, e só quando o perfil
 * permite ações destrutivas.
 */
export const publishableAuthorityProfile = authorityProfile.superRefine((profile, ctx) => {
  for (const action of profile.allowedActions) {
    if (action.destructive && !profile.destructiveActionsAllowed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Ação destrutiva "${action.key}" não permitida por este perfil.`,
        path: ['allowedActions'],
      });
    }
    if (
      action.destructive &&
      AUTHORITY_LEVEL_NUMBER[action.semanticLevel] < AUTHORITY_LEVEL_NUMBER.execute_with_approval
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Ação destrutiva "${action.key}" abaixo de execute_with_approval.`,
        path: ['allowedActions'],
      });
    }
  }
});

// ── Requests ──────────────────────────────────────────────────────────────────

/** Atualização do gradiente em rascunho (PATCH). Concorrência via expectedRevision. */
export const updateAuthorityProfileRequest = z.object({
  authorityProfile,
  expectedRevision: z.number().int().min(0),
});
export type UpdateAuthorityProfileRequest = z.infer<typeof updateAuthorityProfileRequest>;
