/**
 * Arden.AS API — motor de decisão de autoridade (ARDEN-BE-004).
 *
 * Função PURA e determinística: dado o Gradiente de Autoridade da versão
 * publicada, as políticas aplicáveis e o contexto da ação, decide
 * ALLOWED | DENIED | APPROVAL_REQUIRED. Não há `eval`, `Function`, nem
 * execução de expressões: as condições são avaliadas por um interpretador
 * declarativo fechado (switch por operador). Precedência: DENY > REQUIRE_APPROVAL
 * > ALLOW (a decisão mais restritiva vence — nunca uma permissão anula um bloqueio).
 *
 * Este módulo NÃO acessa banco, rede ou relógio: recebe tudo por parâmetro para
 * ser 100% testável. O snapshot de política/autoridade é montado por quem chama.
 */

import type {
  ActionKey,
  AuthorityProfile,
  PolicyCondition,
  PolicyConditionOperator,
  PolicyDefinition,
  PolicyEffect,
} from '@arden/contracts';

export type ActionDecision = 'ALLOWED' | 'DENIED' | 'APPROVAL_REQUIRED';

/** Camada de capacidade da ação na taxonomia estável (ARDEN-BE-004 §14). */
export type ActionTier = 'READ' | 'PREPARE' | 'EXECUTE';

/** Classificação FIXA das ações da taxonomia em camadas. */
export const ACTION_TIER: Record<ActionKey, ActionTier> = {
  'data.read': 'READ',
  'data.write': 'PREPARE',
  'record.create': 'PREPARE',
  'record.update': 'PREPARE',
  'record.delete': 'EXECUTE',
  'document.generate': 'PREPARE',
  'communication.prepare': 'PREPARE',
  'communication.send': 'EXECUTE',
  'approval.request': 'PREPARE',
  'financial.prepare': 'PREPARE',
  'financial.execute': 'EXECUTE',
  'access.grant': 'EXECUTE',
  'access.revoke': 'EXECUTE',
  'integration.invoke': 'EXECUTE',
  'operation.pause': 'EXECUTE',
  'operation.resume': 'EXECUTE',
};

/** Ações destrutivas — exigem `destructiveActionsAllowed` no perfil. */
export const DESTRUCTIVE_ACTIONS: ReadonlySet<ActionKey> = new Set<ActionKey>([
  'record.delete',
  'financial.execute',
  'access.revoke',
  'operation.pause',
]);

/** Nível numérico do gradiente (1..5) do Gradiente de Autoridade (BE-003). */
export type GradientLevel = 1 | 2 | 3 | 4 | 5;

export interface ApplicablePolicySnapshot {
  policyId: string;
  policyVersionId: string;
  priority: number;
  definition: PolicyDefinition;
}

export interface EvaluationInput {
  actionKey: ActionKey;
  /** Contexto avaliável pelas condições (payload achatado + metadados). */
  context: Record<string, unknown>;
  authorityProfile: AuthorityProfile;
  /** Políticas já resolvidas (binding habilitado + versão publicada), com prioridade. */
  policies: ApplicablePolicySnapshot[];
  /** Instante de referência (injetado — o motor não lê o relógio). */
  now: Date;
}

export interface PolicyContribution {
  policyId: string;
  policyVersionId: string;
  effect: PolicyEffect;
  priority: number;
}

export interface EvaluationResult {
  decision: ActionDecision;
  reasonCodes: string[];
  applicablePolicies: PolicyContribution[];
  /** Fluxo de aprovação resolvido quando a decisão exige aprovação (se houver). */
  approvalFlowId: string | null;
}

const SEMANTIC_TO_LEVEL: Record<string, GradientLevel> = {
  observe: 1,
  prepare: 2,
  execute_under_rule: 3,
  execute_with_approval: 4,
  blocked: 5,
};

/** Resolve o valor de um campo por caminho pontuado, sem executar código. */
export function resolveField(context: Record<string, unknown>, field: string): unknown {
  const parts = field.split('.');
  let cursor: unknown = context;
  for (const part of parts) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Avalia UMA condição declarativa. Fechado por operador — nunca interpreta texto. */
export function evaluateCondition(condition: PolicyCondition, context: Record<string, unknown>): boolean {
  const actual = resolveField(context, condition.field);
  const op: PolicyConditionOperator = condition.operator;
  const expected = condition.value;

  switch (op) {
    case 'EXISTS':
      return actual !== undefined && actual !== null;
    case 'EQUALS':
      return actual === expected;
    case 'NOT_EQUALS':
      return actual !== expected;
    case 'IN':
      return Array.isArray(expected) && expected.includes(actual as never);
    case 'NOT_IN':
      return !Array.isArray(expected) || !expected.includes(actual as never);
    case 'GREATER_THAN':
    case 'GREATER_THAN_OR_EQUAL':
    case 'LESS_THAN':
    case 'LESS_THAN_OR_EQUAL': {
      const a = asNumber(actual);
      const b = asNumber(expected);
      if (a === null || b === null) return false;
      if (op === 'GREATER_THAN') return a > b;
      if (op === 'GREATER_THAN_OR_EQUAL') return a >= b;
      if (op === 'LESS_THAN') return a < b;
      return a <= b;
    }
    default: {
      // Exaustividade: operador desconhecido nunca "passa".
      const _never: never = op;
      void _never;
      return false;
    }
  }
}

/** Todas as condições precisam casar (AND). Lista vazia = aplica sempre. */
export function policyApplies(def: PolicyDefinition, context: Record<string, unknown>, now: Date): boolean {
  if (def.validFrom && now < new Date(def.validFrom)) return false;
  if (def.validUntil && now > new Date(def.validUntil)) return false;
  return def.appliesWhen.every((c) => evaluateCondition(c, context));
}

/** Um limite excedido transforma a contribuição da política em REQUIRE_APPROVAL. */
function limitExceeded(def: PolicyDefinition, context: Record<string, unknown>): boolean {
  if (!def.limits) return false;
  if (def.limits.financial) {
    const amount = asNumber(resolveField(context, 'amountMinor'));
    if (amount !== null && amount > def.limits.financial.amountMinor) return true;
  }
  if (def.limits.quantity !== undefined) {
    const quantity = asNumber(resolveField(context, 'quantity'));
    if (quantity !== null && quantity > def.limits.quantity) return true;
  }
  return false;
}

const RANK: Record<PolicyEffect, number> = { ALLOW: 0, REQUIRE_APPROVAL: 1, DENY: 2 };

/** Combina duas decisões pela precedência mais restritiva. */
function combine(a: ActionDecision, b: ActionDecision): ActionDecision {
  const rank: Record<ActionDecision, number> = { ALLOWED: 0, APPROVAL_REQUIRED: 1, DENIED: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/** Decisão base do Gradiente para a camada da ação. */
function gradientBaseline(
  tier: ActionTier,
  level: GradientLevel,
  approvalRequired: boolean,
): { decision: ActionDecision; reason: string } {
  if (level >= 5) return { decision: 'DENIED', reason: 'GRADIENT_BLOCKED' };
  if (tier === 'READ') return { decision: 'ALLOWED', reason: 'GRADIENT_READ_ALLOWED' };
  if (tier === 'PREPARE') {
    if (level <= 1) return { decision: 'DENIED', reason: 'GRADIENT_OBSERVE_ONLY' };
    return { decision: 'ALLOWED', reason: 'GRADIENT_PREPARE_ALLOWED' };
  }
  // EXECUTE
  if (level <= 2) return { decision: 'DENIED', reason: 'GRADIENT_EXECUTE_NOT_ALLOWED' };
  if (level === 3) {
    return approvalRequired
      ? { decision: 'APPROVAL_REQUIRED', reason: 'PROFILE_APPROVAL_REQUIRED' }
      : { decision: 'ALLOWED', reason: 'GRADIENT_EXECUTE_UNDER_RULE' };
  }
  // level === 4
  return { decision: 'APPROVAL_REQUIRED', reason: 'GRADIENT_EXECUTE_WITH_APPROVAL' };
}

/**
 * Avaliação central. Determinística: mesmas entradas → mesma saída, sem efeitos.
 */
export function evaluateAction(input: EvaluationInput): EvaluationResult {
  const { actionKey, context, authorityProfile: profile, policies, now } = input;
  const reasonCodes: string[] = [];
  const tier = ACTION_TIER[actionKey];

  // 1. Ação precisa estar declarada no perfil quando há lista de ações.
  const declared = profile.allowedActions.find((a) => a.key === actionKey);
  if (profile.allowedActions.length > 0 && !declared && tier !== 'READ') {
    return {
      decision: 'DENIED',
      reasonCodes: ['ACTION_NOT_DECLARED'],
      applicablePolicies: [],
      approvalFlowId: null,
    };
  }

  // 2. Nível efetivo: o da ação declarada (se houver) ou o da versão.
  const effectiveLevel: GradientLevel = declared
    ? SEMANTIC_TO_LEVEL[declared.semanticLevel]
    : (profile.level as GradientLevel);

  // 3. Ação destrutiva exige permissão explícita do perfil.
  if (DESTRUCTIVE_ACTIONS.has(actionKey) && !profile.destructiveActionsAllowed) {
    return {
      decision: 'DENIED',
      reasonCodes: ['DESTRUCTIVE_NOT_ALLOWED'],
      applicablePolicies: [],
      approvalFlowId: null,
    };
  }

  // 4. Linha de base do Gradiente.
  const base = gradientBaseline(tier, effectiveLevel, profile.approvalRequired);
  let decision = base.decision;
  reasonCodes.push(base.reason);

  // 5. Políticas aplicáveis (ordem por prioridade desc para escolher fluxo).
  const ordered = [...policies].sort((a, b) => b.priority - a.priority);
  const contributions: PolicyContribution[] = [];
  let approvalFlowId: string | null = null;

  for (const pol of ordered) {
    if (!policyApplies(pol.definition, context, now)) continue;
    let effect: PolicyEffect = pol.definition.effect;
    if (effect === 'ALLOW' && limitExceeded(pol.definition, context)) {
      effect = 'REQUIRE_APPROVAL';
      reasonCodes.push('POLICY_LIMIT_EXCEEDED');
    } else if (limitExceeded(pol.definition, context)) {
      reasonCodes.push('POLICY_LIMIT_EXCEEDED');
    }
    contributions.push({ policyId: pol.policyId, policyVersionId: pol.policyVersionId, effect, priority: pol.priority });

    const asDecision: ActionDecision =
      effect === 'DENY' ? 'DENIED' : effect === 'REQUIRE_APPROVAL' ? 'APPROVAL_REQUIRED' : 'ALLOWED';
    if (effect === 'DENY') reasonCodes.push('POLICY_DENY');
    if (effect === 'REQUIRE_APPROVAL') reasonCodes.push('POLICY_REQUIRE_APPROVAL');
    decision = combine(decision, asDecision);

    if (
      (effect === 'REQUIRE_APPROVAL' || decision === 'APPROVAL_REQUIRED') &&
      pol.definition.approvalFlowId &&
      !approvalFlowId
    ) {
      approvalFlowId = pol.definition.approvalFlowId;
    }
  }

  // 6. Se exige aprovação e nenhuma política definiu fluxo, usa o do perfil.
  if (decision === 'APPROVAL_REQUIRED' && !approvalFlowId) {
    approvalFlowId = profile.approvalPolicyId ?? null;
  }
  if (decision !== 'APPROVAL_REQUIRED') approvalFlowId = null;

  return { decision, reasonCodes, applicablePolicies: contributions, approvalFlowId };
}
