/**
 * Arden.AS API — persistência do checkpoint do loop de tool calling (ARDEN-BE-007.5).
 *
 * Uma linha por etapa de agente. Guarda apenas contadores, hashes e metadados
 * SANITIZADOS — nunca prompt/contexto/segredo/credencial/input/output bruto. Suporta
 * retomada idempotente após aprovação e execução única de tools por replay.
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface PendingToolCallMeta {
  toolCallId: string;
  idempotencyKey: string;
  alias: string;
  actionKey: string;
  riskLevel: string;
  inputHash: string;
}

export interface CompletedToolCallMeta {
  alias: string;
  actionKey: string;
  status: string;
  outputHash?: string;
  evidenceReferenceId?: string;
  errorCode?: string;
}

export type CompletedToolCallMap = Record<string, CompletedToolCallMeta>;

@Injectable()
export class AgentRuntimeCheckpointRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByStep(organizationId: string, executionStepId: string) {
    return this.prisma.agentRuntimeCheckpoint.findFirst({ where: { organizationId, executionStepId } });
  }

  /** Cria (ou retorna) o checkpoint da etapa. Idempotente via unique(executionStepId). */
  async ensure(input: {
    organizationId: string;
    executionRunId: string;
    executionStepId: string;
    agentDefinitionId: string;
    agentVersionId: string;
  }) {
    const existing = await this.findByStep(input.organizationId, input.executionStepId);
    if (existing) return existing;
    return this.prisma.agentRuntimeCheckpoint.create({ data: { ...input, status: 'ACTIVE' } });
  }

  async recordCompleted(executionStepId: string, idempotencyKey: string, meta: CompletedToolCallMeta, counts: { turnCount: number; modelCallCount: number; toolCallCount: number }): Promise<void> {
    const cp = await this.prisma.agentRuntimeCheckpoint.findUnique({ where: { executionStepId } });
    const completed = ((cp?.completedToolCalls as CompletedToolCallMap | null) ?? {}) as CompletedToolCallMap;
    completed[idempotencyKey] = meta;
    await this.prisma.agentRuntimeCheckpoint.update({
      where: { executionStepId },
      data: { completedToolCalls: completed as unknown as Prisma.InputJsonValue, ...counts, pendingToolCall: Prisma.JsonNull, approvalRequestId: null, status: 'ACTIVE', revision: { increment: 1 } },
    });
  }

  async markSuspended(executionStepId: string, pending: PendingToolCallMeta, approvalRequestId: string | null, counts: { turnCount: number; modelCallCount: number; toolCallCount: number }, contextHash: string | null): Promise<void> {
    await this.prisma.agentRuntimeCheckpoint.update({
      where: { executionStepId },
      data: { status: 'SUSPENDED', pendingToolCall: pending as unknown as Prisma.InputJsonValue, approvalRequestId, contextHash, ...counts, revision: { increment: 1 } },
    });
  }

  async markCompleted(executionStepId: string): Promise<void> {
    await this.prisma.agentRuntimeCheckpoint.update({
      where: { executionStepId },
      data: { status: 'COMPLETED', pendingToolCall: Prisma.JsonNull, revision: { increment: 1 } },
    });
  }
}
