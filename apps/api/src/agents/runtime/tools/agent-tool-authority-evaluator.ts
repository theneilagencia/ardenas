/**
 * Arden.AS API — avaliação de autoridade de tool call do agente (ARDEN-BE-007.5).
 *
 * Combina, com precedência DENY > REQUIRE_APPROVAL > ALLOW:
 *  1. Gates de RISCO da `AgentToolPolicy` (READ/WRITE/DESTRUCTIVE/FINANCIAL/SECURITY_CRITICAL).
 *  2. Gradiente de Autoridade + políticas da operação, REUTILIZANDO `enforcement.evaluateCore`
 *     sobre a action canônica `integration.invoke` (BE-004) e o input LÓGICO da tool.
 *  3. `ActionAuthorization` já ativa (aprovada) para a mesma tupla → ALLOW consumível.
 * O risco NUNCA é reduzido pelo agente; a policy pode negar categorias. Quando a policy
 * exige autorização humana para o risco mas a autoridade concede diretamente (sem fluxo de
 * aprovação), a decisão é DENY (fail-safe): nunca executa sem a autorização exigida.
 */

import { Injectable } from '@nestjs/common';
import type { AgentToolPolicy, AgentToolRiskLevel } from '@arden/contracts';
import type { AuthenticatedRequestContext } from '../../../identity/request-context';
import { EnforcementService } from '../../../enforcement/enforcement.service';
import { hashActionPayload } from '../../../enforcement/action-payload';
import { PrismaService } from '../../../database/prisma.service';
import type { AgentToolAuthorityDecision } from './agent-tool.types';

const TOOL_ACTION_KEY = 'integration.invoke' as const;

function riskAllowed(policy: AgentToolPolicy, risk: AgentToolRiskLevel): boolean {
  switch (risk) {
    case 'READ': return policy.allowRead;
    case 'WRITE': return policy.allowWrite;
    case 'DESTRUCTIVE': return policy.allowDestructive;
    case 'FINANCIAL': return policy.allowFinancial;
    case 'SECURITY_CRITICAL': return policy.allowSecurityCritical;
    default: return false;
  }
}

export interface AgentToolAuthorityInput {
  organizationId: string;
  operationId: string;
  operationVersionId: string;
  executionRunId: string;
  executionStepId: string;
  requestedByUserId: string;
  correlationId: string;
  alias: string;
  actionKey: string;
  riskLevel: AgentToolRiskLevel;
  toolPolicy: AgentToolPolicy;
  /** Input LÓGICO da tool (normalizado) — base do actionPayloadHash. */
  toolPayload: unknown;
  now: Date;
}

@Injectable()
export class AgentToolAuthorityEvaluator {
  constructor(
    private readonly enforcement: EnforcementService,
    private readonly prisma: PrismaService,
  ) {}

  /** Hash canônico do payload da tool para casar/emitir `ActionAuthorization`. */
  payloadHash(payload: unknown): string {
    return hashActionPayload(TOOL_ACTION_KEY, payload);
  }

  async evaluate(input: AgentToolAuthorityInput): Promise<AgentToolAuthorityDecision> {
    // 1) Gate de risco da política do agente (o agente não reduz o risco).
    if (!riskAllowed(input.toolPolicy, input.riskLevel)) {
      return { decision: 'DENY', reasonCode: 'AGENT_TOOL_RISK_DENIED' };
    }

    // 2) Autoridade da operação (BE-004) sobre integration.invoke.
    const ctx = { organizationId: input.organizationId, userId: input.requestedByUserId, correlationId: input.correlationId } as AuthenticatedRequestContext;
    const core = await this.enforcement.evaluateCore(ctx, input.operationId, TOOL_ACTION_KEY, input.toolPayload, input.now);
    if (core.decision === 'DENIED') {
      return { decision: 'DENY', reasonCode: 'AUTHORITY_DENIED' };
    }

    // 3) Autorização já ativa para a mesma tupla (op, versão, ação, payload) → ALLOW.
    const existing = await this.prisma.actionAuthorization.findFirst({
      where: {
        organizationId: input.organizationId,
        operationId: input.operationId,
        operationVersionId: core.operationVersionId,
        actionKey: TOOL_ACTION_KEY,
        actionPayloadHash: core.actionPayloadHash,
        status: 'ACTIVE',
      },
      select: { id: true, validUntil: true },
    });
    if (existing && (!existing.validUntil || existing.validUntil > input.now)) {
      return { decision: 'ALLOW', reasonCode: 'AUTHORIZATION_PRESENT', authorizationId: existing.id };
    }

    // 4) Autoridade exige aprovação → REQUIRE_APPROVAL (fluxo BE-004).
    if (core.decision === 'APPROVAL_REQUIRED') {
      return { decision: 'REQUIRE_APPROVAL', reasonCode: 'AUTHORITY_APPROVAL_REQUIRED' };
    }

    // 5) Política do agente exige autorização humana para o risco, mas a autoridade concede
    // diretamente (sem fluxo) e não há autorização → nega (fail-safe).
    if (input.toolPolicy.requireAuthorizationFor.includes(input.riskLevel as never)) {
      return { decision: 'DENY', reasonCode: 'AGENT_TOOL_AUTHORIZATION_UNAVAILABLE' };
    }

    // 6) Permitido diretamente (ex.: READ, ou WRITE liberado sem exigência de autorização).
    return { decision: 'ALLOW', reasonCode: 'AUTHORITY_ALLOWED' };
  }
}
