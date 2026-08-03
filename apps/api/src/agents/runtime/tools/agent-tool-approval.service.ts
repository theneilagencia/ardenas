/**
 * Arden.AS API — criação/consulta de aprovação de tool call do agente (ARDEN-BE-007.5).
 *
 * REUTILIZA integralmente o motor de aprovações do BE-004: `ApprovalRequestsService.create`
 * (que reavalia a autoridade via `evaluateCore` e resolve o fluxo) e a emissão de
 * `ActionAuthorization` na aprovação humana (endpoint existente). Não duplica o motor —
 * apenas adapta o contexto do worker (sem usuário HTTP) para `integration.invoke`.
 */

import { Injectable } from '@nestjs/common';
import type { AuthenticatedRequestContext } from '../../../identity/request-context';
import { ApprovalRequestsService } from '../../../approvals/requests.service';
import { PrismaService } from '../../../database/prisma.service';

const TOOL_ACTION_KEY = 'integration.invoke' as const;

@Injectable()
export class AgentToolApprovalService {
  constructor(
    private readonly requests: ApprovalRequestsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Status de uma solicitação de aprovação existente (para retomada idempotente). */
  async statusOf(organizationId: string, approvalRequestId: string): Promise<string | null> {
    const req = await this.prisma.approvalRequest.findFirst({ where: { id: approvalRequestId, organizationId }, select: { status: true } });
    return req?.status ?? null;
  }

  /**
   * Cria (ou retorna, por idempotência) a solicitação de aprovação da tool call. O fluxo e
   * os snapshots vêm de `evaluateCore` sobre `integration.invoke` com o input LÓGICO da tool.
   */
  async createOrGet(input: {
    organizationId: string;
    operationId: string;
    operationVersionId: string;
    requestedByUserId: string;
    correlationId: string;
    executionStepId: string;
    toolPayload: unknown;
    idempotencyKey: string;
  }): Promise<{ approvalRequestId: string; status: string }> {
    const ctx = {
      organizationId: input.organizationId,
      userId: input.requestedByUserId,
      correlationId: input.correlationId,
      permissions: new Set<string>(),
      membershipId: null,
      externalSubject: input.requestedByUserId,
      ipAddress: null,
      userAgent: null,
      identityExpiresAt: null,
    } as AuthenticatedRequestContext;

    const created = await this.requests.create(
      ctx,
      input.operationId,
      { operationVersionId: input.operationVersionId, actionKey: TOOL_ACTION_KEY, actionPayload: input.toolPayload },
      `agent-tool-approval:${input.executionStepId}:${input.idempotencyKey}`,
    );
    const request = created.body.data;
    return { approvalRequestId: request.id, status: request.status };
  }
}
