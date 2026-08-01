/**
 * Arden.AS API — acesso a dados de enforcement (ARDEN-BE-004).
 * Carrega a operação, a versão de autoridade e as políticas aplicáveis, sempre
 * escopado por organização. Aceita cliente de transação opcional.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class EnforcementRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient): Db {
    return tx ?? this.prisma;
  }

  findOperation(organizationId: string, operationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).operation.findFirst({ where: { id: operationId, organizationId } });
  }

  findVersion(organizationId: string, operationId: string, versionId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).operationVersion.findFirst({ where: { id: versionId, operationId, organizationId } });
  }

  /** Vínculos habilitados da operação, com a versão publicada de cada política. */
  async applicablePolicies(organizationId: string, operationId: string, tx?: Prisma.TransactionClient) {
    const bindings = await this.db(tx).operationPolicyBinding.findMany({
      where: { organizationId, operationId, enabled: true },
    });
    const results: Array<{ policyId: string; policyVersionId: string; priority: number; definition: unknown }> = [];
    for (const binding of bindings) {
      const version = await this.db(tx).policyVersion.findFirst({
        where: { id: binding.policyVersionId, organizationId, status: 'PUBLISHED' },
        select: { id: true, policyId: true, definition: true },
      });
      if (!version) continue; // política suspensa/superseded não vincula mais.
      const policy = await this.db(tx).policy.findFirst({
        where: { id: version.policyId, organizationId, status: 'PUBLISHED' },
        select: { id: true },
      });
      if (!policy) continue;
      results.push({
        policyId: version.policyId,
        policyVersionId: version.id,
        priority: binding.priority,
        definition: version.definition,
      });
    }
    return results;
  }

  findAuthorization(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).actionAuthorization.findFirst({ where: { id, organizationId } });
  }

  findActiveAuthorization(
    organizationId: string,
    operationId: string,
    actionKey: string,
    actionPayloadHash: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).actionAuthorization.findFirst({
      where: { organizationId, operationId, actionKey, actionPayloadHash, status: 'ACTIVE' },
      orderBy: { grantedAt: 'desc' },
    });
  }
}
