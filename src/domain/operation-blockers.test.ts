import { describe, expect, it } from 'vitest';
import { computeBlockers, isPublishable } from './operation-blockers';
import type { Operation } from './types';

const tested = { testedIntegrationIds: new Set<string>(['int_ok']) };

function validOperation(): Partial<Operation> {
  return {
    ownerId: 'p_owner',
    expectedResult: 'Relatório aprovado até o 2º dia útil.',
    environment: 'production',
    budget: 5000,
    evidencePolicy: 'Evidência por etapa.',
    integrationIds: ['int_ok'],
    actions: [],
    steps: [],
    approverIds: [],
  };
}

describe('bloqueadores de publicação', () => {
  it('operação completa não tem bloqueadores', () => {
    expect(isPublishable(validOperation(), tested)).toBe(true);
  });

  it('responsável ausente bloqueia', () => {
    const op = { ...validOperation(), ownerId: '' };
    expect(computeBlockers(op, tested).some((b) => b.code === 'owner_missing')).toBe(true);
  });

  it('resultado esperado ausente bloqueia', () => {
    const op = { ...validOperation(), expectedResult: '  ' };
    expect(computeBlockers(op, tested).some((b) => b.code === 'expected_result_missing')).toBe(true);
  });

  it('ambiente não selecionado bloqueia', () => {
    const op = { ...validOperation(), environment: null };
    expect(computeBlockers(op, tested).some((b) => b.code === 'environment_missing')).toBe(true);
  });

  it('orçamento não configurado bloqueia', () => {
    const op = { ...validOperation(), budget: 0 };
    expect(computeBlockers(op, tested).some((b) => b.code === 'budget_missing')).toBe(true);
  });

  it('evidência não configurada bloqueia', () => {
    const op = { ...validOperation(), evidencePolicy: '' };
    expect(computeBlockers(op, tested).some((b) => b.code === 'evidence_missing')).toBe(true);
  });

  it('integração não testada bloqueia', () => {
    const op = { ...validOperation(), integrationIds: ['int_novo'] };
    expect(computeBlockers(op, tested).some((b) => b.code === 'integration_untested')).toBe(true);
  });

  it('autoridade incoerente com o risco da ação bloqueia', () => {
    const op = {
      ...validOperation(),
      actions: [
        { id: 'a1', name: 'Excluir', authorityLevel: 'execute_under_rule' as const, destructive: true },
      ],
    };
    expect(computeBlockers(op, tested).some((b) => b.code === 'authority_incoherent')).toBe(true);
  });

  it('aprovador ausente em ação que exige aprovação bloqueia', () => {
    const op = {
      ...validOperation(),
      steps: [
        {
          id: 's1',
          order: 1,
          name: 'Reter',
          description: '',
          authorityLevel: 'execute_with_approval' as const,
          requiresApproval: true,
          workUnitCost: 1,
          producesEvidence: true,
        },
      ],
      approverIds: [],
    };
    expect(computeBlockers(op, tested).some((b) => b.code === 'approver_missing')).toBe(true);
  });
});
