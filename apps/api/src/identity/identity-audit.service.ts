/**
 * Arden.AS API — auditoria de identidade (ARDEN-BE-002).
 * Append-only. NUNCA registra tokens/segredos. Best-effort: uma falha ao gravar
 * auditoria não deve derrubar a requisição, mas é logada.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILURE';

export interface IdentityAuditInput {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: AuditOutcome;
  reasonCode?: string | null;
  correlationId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

const SENSITIVE = /(authorization|token|secret|password|cookie)/i;

function sanitize(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    out[k] = SENSITIVE.test(k) ? '[REDACTED]' : v;
  }
  return out;
}

@Injectable()
export class IdentityAuditService {
  private readonly logger = new Logger('IdentityAudit');

  constructor(private readonly prisma: PrismaService) {}

  async record(input: IdentityAuditInput): Promise<void> {
    try {
      await this.prisma.identityAuditEvent.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          organizationId: input.organizationId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          outcome: input.outcome,
          reasonCode: input.reasonCode ?? null,
          correlationId: input.correlationId,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          metadata: sanitize(input.metadata) as Prisma.InputJsonObject,
        },
      });
    } catch (err) {
      this.logger.error(
        { correlationId: input.correlationId, action: input.action },
        `Falha ao gravar auditoria de identidade: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
