/**
 * Arden.AS API — testes das regras do Gradiente de Autoridade (ARDEN-BE-003).
 * Cobre a validação por nível 1..5.
 */

import { describe, expect, it } from 'vitest';
import type { AuthorityProfile } from '@arden/contracts';
import { validateAuthorityProfileForPublish } from './authority.rules';

function profile(overrides: Partial<AuthorityProfile>): AuthorityProfile {
  return {
    level: 1,
    allowedActions: [],
    approvalRequired: false,
    approvalPolicyId: null,
    financialLimit: null,
    destructiveActionsAllowed: false,
    justificationRequired: false,
    ...overrides,
  };
}

const codes = (p: AuthorityProfile) => validateAuthorityProfileForPublish(p).errors.map((e) => e.code);

describe('validateAuthorityProfileForPublish', () => {
  it('nível 1 sem ações é válido (observa)', () => {
    expect(validateAuthorityProfileForPublish(profile({ level: 1 })).errors).toEqual([]);
  });

  it('nível 1 com ação destrutiva é rejeitado', () => {
    const p = profile({
      level: 1,
      destructiveActionsAllowed: true,
      allowedActions: [{ key: 'delete', semanticLevel: 'execute_with_approval', destructive: true }],
    });
    expect(codes(p)).toContain('AUTHORITY_LEVEL_TOO_LOW_FOR_DESTRUCTIVE');
  });

  it('nível 2 que permite ações destrutivas é rejeitado', () => {
    expect(codes(profile({ level: 2, destructiveActionsAllowed: true }))).toContain(
      'AUTHORITY_LEVEL_TOO_LOW_FOR_DESTRUCTIVE',
    );
  });

  it('nível 3 com ação não destrutiva é válido', () => {
    const p = profile({
      level: 3,
      allowedActions: [{ key: 'notify', semanticLevel: 'execute_under_rule', destructive: false }],
    });
    expect(validateAuthorityProfileForPublish(p).errors).toEqual([]);
  });

  it('ação destrutiva abaixo de execute_with_approval é rejeitada (contrato)', () => {
    const p = profile({
      level: 3,
      destructiveActionsAllowed: true,
      allowedActions: [{ key: 'purge', semanticLevel: 'execute_under_rule', destructive: true }],
    });
    expect(codes(p)).toContain('AUTHORITY_DESTRUCTIVE_ACTION_INVALID');
  });

  it('nível 4 sem aprovação é rejeitado; com aprovação é válido', () => {
    expect(codes(profile({ level: 4, approvalRequired: false }))).toContain('AUTHORITY_APPROVAL_REQUIRED');
    expect(validateAuthorityProfileForPublish(profile({ level: 4, approvalRequired: true })).errors).toEqual([]);
  });

  it('nível 5 exige aprovação e justificativa', () => {
    expect(codes(profile({ level: 5, approvalRequired: true, justificationRequired: false }))).toContain(
      'AUTHORITY_JUSTIFICATION_REQUIRED',
    );
    const ok = profile({ level: 5, approvalRequired: true, justificationRequired: true });
    expect(validateAuthorityProfileForPublish(ok).errors).toEqual([]);
  });

  it('nível 5 crítico com ação destrutiva permitida e ≥ execute_with_approval é válido', () => {
    const p = profile({
      level: 5,
      approvalRequired: true,
      justificationRequired: true,
      destructiveActionsAllowed: true,
      allowedActions: [{ key: 'shutdown', semanticLevel: 'execute_with_approval', destructive: true }],
    });
    expect(validateAuthorityProfileForPublish(p).errors).toEqual([]);
  });
});
