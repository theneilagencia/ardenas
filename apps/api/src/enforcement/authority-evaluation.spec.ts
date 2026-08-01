/**
 * Arden.AS API — testes do motor de decisão de autoridade (ARDEN-BE-004).
 * O motor é PURO: cada caso fixa entradas e verifica a decisão determinística.
 */

import { describe, expect, it } from 'vitest';
import type { AuthorityProfile, PolicyDefinition } from '@arden/contracts';
import {
  evaluateAction,
  evaluateCondition,
  policyApplies,
  ACTION_TIER,
  DESTRUCTIVE_ACTIONS,
  type ApplicablePolicySnapshot,
  type EvaluationInput,
} from './authority-evaluation';

const NOW = new Date('2026-07-31T12:00:00.000Z');

function profile(overrides: Partial<AuthorityProfile> = {}): AuthorityProfile {
  return {
    level: 3,
    allowedActions: [],
    approvalRequired: false,
    approvalPolicyId: null,
    financialLimit: null,
    destructiveActionsAllowed: false,
    justificationRequired: false,
    ...overrides,
  };
}

function evaluate(input: Partial<EvaluationInput> & Pick<EvaluationInput, 'actionKey'>) {
  return evaluateAction({
    context: {},
    authorityProfile: profile(),
    policies: [],
    now: NOW,
    ...input,
  });
}

function policy(def: Partial<PolicyDefinition>, priority = 0, ids = 'p'): ApplicablePolicySnapshot {
  return {
    policyId: `${ids}-id`,
    policyVersionId: `${ids}-v`,
    priority,
    definition: { appliesWhen: [], effect: 'ALLOW', ...def } as PolicyDefinition,
  };
}

describe('taxonomia de ações', () => {
  it('classifica leitura, preparo e execução', () => {
    expect(ACTION_TIER['data.read']).toBe('READ');
    expect(ACTION_TIER['financial.prepare']).toBe('PREPARE');
    expect(ACTION_TIER['financial.execute']).toBe('EXECUTE');
  });
  it('marca ações destrutivas', () => {
    expect(DESTRUCTIVE_ACTIONS.has('record.delete')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('data.read')).toBe(false);
  });
});

describe('Gradiente — níveis 1..5', () => {
  it('nível 1 (observe): só leitura passa; preparo e execução negados', () => {
    expect(evaluate({ actionKey: 'data.read', authorityProfile: profile({ level: 1 }) }).decision).toBe('ALLOWED');
    expect(evaluate({ actionKey: 'record.create', authorityProfile: profile({ level: 1 }) }).decision).toBe('DENIED');
    expect(evaluate({ actionKey: 'communication.send', authorityProfile: profile({ level: 1 }) }).decision).toBe('DENIED');
  });
  it('nível 2 (prepare): preparo permitido; execução negada', () => {
    expect(evaluate({ actionKey: 'financial.prepare', authorityProfile: profile({ level: 2 }) }).decision).toBe('ALLOWED');
    expect(evaluate({ actionKey: 'communication.send', authorityProfile: profile({ level: 2 }) }).decision).toBe('DENIED');
  });
  it('nível 3 (execute_under_rule): execução permitida diretamente', () => {
    expect(evaluate({ actionKey: 'communication.send', authorityProfile: profile({ level: 3 }) }).decision).toBe('ALLOWED');
  });
  it('nível 4 (execute_with_approval): execução exige aprovação', () => {
    expect(evaluate({ actionKey: 'communication.send', authorityProfile: profile({ level: 4 }) }).decision).toBe('APPROVAL_REQUIRED');
  });
  it('nível 5 (blocked): tudo negado', () => {
    expect(evaluate({ actionKey: 'data.read', authorityProfile: profile({ level: 5 }) }).decision).toBe('DENIED');
  });
});

describe('perfil — flags', () => {
  it('approvalRequired transforma execução de nível 3 em aprovação', () => {
    const r = evaluate({ actionKey: 'communication.send', authorityProfile: profile({ level: 3, approvalRequired: true }) });
    expect(r.decision).toBe('APPROVAL_REQUIRED');
  });
  it('ação destrutiva sem permissão do perfil é negada', () => {
    const r = evaluate({ actionKey: 'record.delete', authorityProfile: profile({ level: 4, destructiveActionsAllowed: false }) });
    expect(r.decision).toBe('DENIED');
    expect(r.reasonCodes).toContain('DESTRUCTIVE_NOT_ALLOWED');
  });
  it('ação destrutiva com permissão segue o gradiente', () => {
    const r = evaluate({ actionKey: 'record.delete', authorityProfile: profile({ level: 4, destructiveActionsAllowed: true }) });
    expect(r.decision).toBe('APPROVAL_REQUIRED');
  });
  it('ação não declarada quando há lista de ações é negada', () => {
    const r = evaluate({
      actionKey: 'financial.execute',
      authorityProfile: profile({ level: 3, allowedActions: [{ key: 'data.read', semanticLevel: 'observe', destructive: false }] }),
    });
    expect(r.decision).toBe('DENIED');
    expect(r.reasonCodes).toContain('ACTION_NOT_DECLARED');
  });
  it('usa o nível semântico da ação declarada', () => {
    const r = evaluate({
      actionKey: 'communication.send',
      authorityProfile: profile({ level: 3, allowedActions: [{ key: 'communication.send', semanticLevel: 'execute_with_approval', destructive: false }] }),
    });
    expect(r.decision).toBe('APPROVAL_REQUIRED');
  });
});

describe('políticas — efeitos e precedência', () => {
  it('DENY vence REQUIRE_APPROVAL e ALLOW', () => {
    const r = evaluate({
      actionKey: 'communication.send',
      authorityProfile: profile({ level: 3 }),
      policies: [policy({ effect: 'REQUIRE_APPROVAL' }, 10, 'a'), policy({ effect: 'DENY' }, 5, 'b')],
    });
    expect(r.decision).toBe('DENIED');
  });
  it('REQUIRE_APPROVAL vence ALLOW', () => {
    const r = evaluate({
      actionKey: 'communication.send',
      authorityProfile: profile({ level: 3 }),
      policies: [policy({ effect: 'REQUIRE_APPROVAL', approvalFlowId: 'flow-1' }, 10, 'a')],
    });
    expect(r.decision).toBe('APPROVAL_REQUIRED');
    expect(r.approvalFlowId).toBe('flow-1');
  });
  it('ALLOW não anula bloqueio do gradiente', () => {
    const r = evaluate({
      actionKey: 'communication.send',
      authorityProfile: profile({ level: 1 }),
      policies: [policy({ effect: 'ALLOW' }, 10, 'a')],
    });
    expect(r.decision).toBe('DENIED');
  });
  it('limite financeiro excedido exige aprovação', () => {
    const r = evaluate({
      actionKey: 'financial.execute',
      context: { amountMinor: 100_000 },
      authorityProfile: profile({ level: 3, destructiveActionsAllowed: true }),
      policies: [policy({ effect: 'ALLOW', limits: { financial: { amountMinor: 50_000, currency: 'BRL' } }, approvalFlowId: 'flow-fin' }, 10, 'a')],
    });
    expect(r.decision).toBe('APPROVAL_REQUIRED');
    expect(r.reasonCodes).toContain('POLICY_LIMIT_EXCEEDED');
    expect(r.approvalFlowId).toBe('flow-fin');
  });
  it('dentro do limite permanece permitido', () => {
    const r = evaluate({
      actionKey: 'financial.execute',
      context: { amountMinor: 10_000 },
      authorityProfile: profile({ level: 3, destructiveActionsAllowed: true }),
      policies: [policy({ effect: 'ALLOW', limits: { financial: { amountMinor: 50_000, currency: 'BRL' } } }, 10, 'a')],
    });
    expect(r.decision).toBe('ALLOWED');
  });
  it('escolhe o fluxo da política de maior prioridade', () => {
    const r = evaluate({
      actionKey: 'communication.send',
      authorityProfile: profile({ level: 3 }),
      policies: [
        policy({ effect: 'REQUIRE_APPROVAL', approvalFlowId: 'low' }, 1, 'a'),
        policy({ effect: 'REQUIRE_APPROVAL', approvalFlowId: 'high' }, 99, 'b'),
      ],
    });
    expect(r.approvalFlowId).toBe('high');
  });
});

describe('condições declarativas (sem eval)', () => {
  it('EQUALS / NOT_EQUALS', () => {
    expect(evaluateCondition({ field: 'kind', operator: 'EQUALS', value: 'wire' }, { kind: 'wire' })).toBe(true);
    expect(evaluateCondition({ field: 'kind', operator: 'NOT_EQUALS', value: 'wire' }, { kind: 'ach' })).toBe(true);
  });
  it('IN / NOT_IN', () => {
    expect(evaluateCondition({ field: 'k', operator: 'IN', value: ['a', 'b'] }, { k: 'b' })).toBe(true);
    expect(evaluateCondition({ field: 'k', operator: 'NOT_IN', value: ['a', 'b'] }, { k: 'c' })).toBe(true);
  });
  it('comparadores numéricos', () => {
    expect(evaluateCondition({ field: 'n', operator: 'GREATER_THAN', value: 5 }, { n: 10 })).toBe(true);
    expect(evaluateCondition({ field: 'n', operator: 'LESS_THAN_OR_EQUAL', value: 5 }, { n: 5 })).toBe(true);
    expect(evaluateCondition({ field: 'n', operator: 'GREATER_THAN', value: 5 }, { n: 'x' })).toBe(false);
  });
  it('EXISTS', () => {
    expect(evaluateCondition({ field: 'a.b', operator: 'EXISTS' }, { a: { b: 1 } })).toBe(true);
    expect(evaluateCondition({ field: 'a.b', operator: 'EXISTS' }, { a: {} })).toBe(false);
  });
  it('política só se aplica quando TODAS as condições casam', () => {
    const def: PolicyDefinition = { appliesWhen: [{ field: 'kind', operator: 'EQUALS', value: 'wire' }], effect: 'DENY' };
    expect(policyApplies(def, { kind: 'wire' }, NOW)).toBe(true);
    expect(policyApplies(def, { kind: 'ach' }, NOW)).toBe(false);
  });
  it('respeita janela validFrom/validUntil', () => {
    const def: PolicyDefinition = { appliesWhen: [], effect: 'DENY', validFrom: '2026-08-01T00:00:00.000Z' };
    expect(policyApplies(def, {}, NOW)).toBe(false);
  });
  it('condição aplicável direciona a decisão', () => {
    const r = evaluate({
      actionKey: 'communication.send',
      context: { channel: 'external' },
      authorityProfile: profile({ level: 3 }),
      policies: [policy({ appliesWhen: [{ field: 'channel', operator: 'EQUALS', value: 'external' }], effect: 'DENY' }, 10, 'a')],
    });
    expect(r.decision).toBe('DENIED');
  });
  it('condição não aplicável é ignorada', () => {
    const r = evaluate({
      actionKey: 'communication.send',
      context: { channel: 'internal' },
      authorityProfile: profile({ level: 3 }),
      policies: [policy({ appliesWhen: [{ field: 'channel', operator: 'EQUALS', value: 'external' }], effect: 'DENY' }, 10, 'a')],
    });
    expect(r.decision).toBe('ALLOWED');
    expect(r.applicablePolicies).toHaveLength(0);
  });
});
