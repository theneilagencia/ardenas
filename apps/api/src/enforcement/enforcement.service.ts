/**
 * Arden.AS API — serviço de enforcement de autoridade (ARDEN-BE-004).
 *
 * Ponto único onde uma AÇÃO é avaliada contra o Gradiente de Autoridade da versão
 * PUBLICADA e as políticas vinculadas. A decisão é do SERVIDOR — nunca do cliente,
 * do botão ou do papel de tela. A autorização emitida é o artefato terminal (a
 * execução real é ARDEN-BE-005). Autorizações são validadas de forma preguiçosa:
 * expiração e invalidação por mudança material são detectadas na leitura.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, ActionAuthorization as DbAuthorization } from '@prisma/client';
import {
  authorityProfile as authorityProfileSchema,
  policyDefinition as policyDefinitionSchema,
  type ActionKey,
  type AuthorityProfile,
  type ActionEvaluationResult,
  type ActionValidationResult,
  type EvaluateActionRequest,
  type ValidateAuthorizationRequest,
} from '@arden/contracts';
import { PrismaService } from '../database/prisma.service';
import { AuditRecorder } from '../audit/audit.recorder';
import { notFound } from '../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../identity/request-context';
import { EnforcementRepository } from './enforcement.repository';
import { evaluateAction, type ApplicablePolicySnapshot, type EvaluationResult } from './authority-evaluation';
import { hashActionPayload, buildActionContext } from './action-payload';
import { toAuthorizationContract } from './enforcement.serializers';

/** Perfil neutro (nega) quando a versão publicada não traz um perfil válido. */
const NEUTRAL_PROFILE: AuthorityProfile = {
  level: 5,
  allowedActions: [],
  approvalRequired: true,
  approvalPolicyId: null,
  financialLimit: null,
  destructiveActionsAllowed: false,
  justificationRequired: false,
};

export interface CoreEvaluation extends EvaluationResult {
  operationId: string;
  operationVersionId: string;
  actionKey: ActionKey;
  actionPayloadHash: string;
  actionContext: Record<string, unknown>;
  authorityProfile: AuthorityProfile;
  policySnapshot: Record<string, unknown>;
}

@Injectable()
export class EnforcementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: EnforcementRepository,
    private readonly audit: AuditRecorder,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  /**
   * Avaliação núcleo (reutilizada por evaluate e pela criação de solicitação).
   * SEMPRE usa a versão PUBLICADA corrente como fonte de autoridade.
   */
  async evaluateCore(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    actionKey: ActionKey,
    actionPayload: unknown,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<CoreEvaluation> {
    const orgId = this.orgId(ctx);
    const op = await this.repo.findOperation(orgId, operationId, tx);
    if (!op) throw notFound('Operação não encontrada.');

    const context = buildActionContext(actionKey, actionPayload);
    const actionPayloadHash = hashActionPayload(actionKey, actionPayload);

    if (!op.publishedVersionId) {
      return {
        decision: 'DENIED',
        reasonCodes: ['NO_PUBLISHED_VERSION'],
        applicablePolicies: [],
        approvalFlowId: null,
        operationId,
        operationVersionId: op.publishedVersionId ?? '',
        actionKey,
        actionPayloadHash,
        actionContext: context,
        authorityProfile: NEUTRAL_PROFILE,
        policySnapshot: {},
      };
    }

    const version = await this.repo.findVersion(orgId, operationId, op.publishedVersionId, tx);
    const parsedProfile = authorityProfileSchema.safeParse(version?.authorityProfile);
    const profile = parsedProfile.success ? parsedProfile.data : NEUTRAL_PROFILE;

    const rawPolicies = await this.repo.applicablePolicies(orgId, operationId, tx);
    const policies: ApplicablePolicySnapshot[] = [];
    const policySnapshot: Record<string, unknown> = {};
    for (const p of rawPolicies) {
      const parsed = policyDefinitionSchema.safeParse(p.definition);
      if (!parsed.success) continue;
      policies.push({ policyId: p.policyId, policyVersionId: p.policyVersionId, priority: p.priority, definition: parsed.data });
      policySnapshot[p.policyVersionId] = parsed.data;
    }

    const result = evaluateAction({ actionKey, context, authorityProfile: profile, policies, now });
    return {
      ...result,
      operationId,
      operationVersionId: op.publishedVersionId,
      actionKey,
      actionPayloadHash,
      actionContext: context,
      authorityProfile: profile,
      policySnapshot,
    };
  }

  /** Endpoint POST actions/evaluate — puro, não persiste. */
  async evaluate(
    ctx: AuthenticatedRequestContext,
    operationId: string,
    body: EvaluateActionRequest,
  ): Promise<{ data: ActionEvaluationResult }> {
    const core = await this.evaluateCore(ctx, operationId, body.actionKey, body.actionPayload, new Date());
    const data: ActionEvaluationResult = {
      decision: core.decision,
      reasonCodes: core.reasonCodes,
      applicablePolicies: core.applicablePolicies.map((p) => ({
        policyId: p.policyId,
        policyVersionId: p.policyVersionId,
        effect: p.effect,
        priority: p.priority,
      })),
    };

    if (body.existingAuthorizationId) {
      const auth = await this.repo.findAuthorization(this.orgId(ctx), body.existingAuthorizationId);
      if (auth && auth.operationId === operationId && auth.actionPayloadHash === core.actionPayloadHash && auth.status === 'ACTIVE') {
        data.authorization = toAuthorizationContract(auth);
      }
    }
    return { data };
  }

  /**
   * Emite a autorização de ação DENTRO da transação de aprovação (uma única vez —
   * a transição terminal da solicitação é o guarda de concorrência).
   */
  async issueAuthorization(
    tx: Prisma.TransactionClient,
    input: {
      organizationId: string;
      approvalRequestId: string | null;
      operationId: string;
      operationVersionId: string;
      actionKey: string;
      actionPayloadHash: string;
      grantedToUserId: string | null;
      validUntil: Date | null;
      authoritySnapshot: unknown;
      policySnapshot: unknown;
      correlationId: string;
    },
  ): Promise<DbAuthorization> {
    return tx.actionAuthorization.create({
      data: {
        organizationId: input.organizationId,
        approvalRequestId: input.approvalRequestId,
        operationId: input.operationId,
        operationVersionId: input.operationVersionId,
        actionKey: input.actionKey,
        actionPayloadHash: input.actionPayloadHash,
        grantedToUserId: input.grantedToUserId,
        status: 'ACTIVE',
        validUntil: input.validUntil,
        authoritySnapshot: (input.authoritySnapshot ?? {}) as Prisma.InputJsonValue,
        policySnapshot: (input.policySnapshot ?? {}) as Prisma.InputJsonValue,
        correlationId: input.correlationId,
      },
    });
  }

  /** Endpoint POST action-authorizations/validate — não executa a ação. */
  async validate(
    ctx: AuthenticatedRequestContext,
    body: ValidateAuthorizationRequest,
  ): Promise<{ data: ActionValidationResult }> {
    const orgId = this.orgId(ctx);
    const now = new Date();
    const payloadHash = hashActionPayload(body.actionKey, body.actionPayload);

    // Sem id de autorização: reavalia a ação (caso "permitida diretamente").
    if (!body.authorizationId) {
      const core = await this.evaluateCore(ctx, body.operationId, body.actionKey, body.actionPayload, now);
      return {
        data: { valid: core.decision === 'ALLOWED', reasonCodes: core.decision === 'ALLOWED' ? ['ALLOWED_DIRECTLY'] : core.reasonCodes },
      };
    }

    const auth = await this.repo.findAuthorization(orgId, body.authorizationId);
    if (!auth) throw notFound('Autorização não encontrada.');

    const reasons: string[] = [];
    let valid = true;

    if (auth.operationId !== body.operationId || auth.actionKey !== body.actionKey || auth.actionPayloadHash !== payloadHash) {
      return { data: { valid: false, reasonCodes: ['AUTHORIZATION_PAYLOAD_MISMATCH'], authorization: toAuthorizationContract(auth) } };
    }

    // Invalidação preguiçosa: versão de autoridade mudou → invalida.
    const op = await this.repo.findOperation(orgId, body.operationId);
    if (op && op.publishedVersionId && op.publishedVersionId !== auth.operationVersionId && auth.status === 'ACTIVE') {
      const fresh = await this.markAuthorization(orgId, auth.id, 'INVALIDATED', ctx, 'action_authorization.invalidated');
      return { data: { valid: false, reasonCodes: ['AUTHORIZATION_INVALIDATED'], authorization: toAuthorizationContract(fresh) } };
    }

    // Expiração preguiçosa.
    if (auth.status === 'ACTIVE' && auth.validUntil && auth.validUntil < now) {
      const fresh = await this.markAuthorization(orgId, auth.id, 'EXPIRED', ctx, 'action_authorization.expired');
      return { data: { valid: false, reasonCodes: ['AUTHORIZATION_EXPIRED'], authorization: toAuthorizationContract(fresh) } };
    }

    if (auth.status !== 'ACTIVE') {
      valid = false;
      reasons.push(`AUTHORIZATION_${auth.status}`);
    } else {
      reasons.push('AUTHORIZATION_ACTIVE');
    }

    return { data: { valid, reasonCodes: reasons, authorization: toAuthorizationContract(auth) } };
  }

  private async markAuthorization(
    orgId: string,
    id: string,
    status: 'EXPIRED' | 'INVALIDATED' | 'REVOKED' | 'USED',
    ctx: AuthenticatedRequestContext,
    action: string,
  ): Promise<DbAuthorization> {
    return this.prisma.$transaction(async (tx) => {
      await tx.actionAuthorization.updateMany({
        where: { id, organizationId: orgId, status: 'ACTIVE' },
        data: { status, revision: { increment: 1 } },
      });
      const fresh = (await this.repo.findAuthorization(orgId, id, tx))!;
      await this.audit.record(tx, {
        organizationId: orgId, actorUserId: ctx.userId, action,
        resourceType: 'action_authorization', resourceId: id, correlationId: ctx.correlationId, metadata: {},
      });
      return fresh;
    });
  }
}
