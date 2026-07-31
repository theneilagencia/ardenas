/**
 * Arden.AS API — repositório de políticas, versões e vínculos (ARDEN-BE-004).
 * Sempre escopado por tenant. Aceita cliente de transação. Sem delete físico de
 * políticas/versões (o binding pode ser removido).
 */

import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  Policy as DbPolicy,
  PolicyVersion as DbPolicyVersion,
  OperationPolicyBinding as DbBinding,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type Db = Prisma.TransactionClient;

@Injectable()
export class PoliciesRepository {
  constructor(private readonly prisma: PrismaService) {}
  private db(tx?: Db): Db {
    return tx ?? (this.prisma as unknown as Db);
  }

  // ── Políticas ──────────────────────────────────────────────────────────────
  listPolicies(organizationId: string, limit: number, cursor?: string): Promise<DbPolicy[]> {
    const where: Prisma.PolicyWhereInput = { organizationId };
    if (cursor) where.createdAt = { lt: new Date(cursor) };
    return this.prisma.policy.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit });
  }
  findPolicy(organizationId: string, id: string, tx?: Db): Promise<DbPolicy | null> {
    return this.db(tx).policy.findFirst({ where: { id, organizationId } });
  }
  createPolicy(data: Prisma.PolicyUncheckedCreateInput, tx?: Db): Promise<DbPolicy> {
    return this.db(tx).policy.create({ data });
  }

  // ── Versões ────────────────────────────────────────────────────────────────
  findVersion(organizationId: string, policyId: string, versionId: string, tx?: Db): Promise<DbPolicyVersion | null> {
    return this.db(tx).policyVersion.findFirst({ where: { id: versionId, organizationId, policyId } });
  }
  findCurrentDraft(organizationId: string, policyId: string, tx?: Db): Promise<DbPolicyVersion | null> {
    return this.db(tx).policyVersion.findFirst({ where: { organizationId, policyId, status: 'DRAFT' }, orderBy: { versionNumber: 'desc' } });
  }
  findPublishedVersion(organizationId: string, policyId: string, tx?: Db): Promise<DbPolicyVersion | null> {
    return this.db(tx).policyVersion.findFirst({ where: { organizationId, policyId, status: 'PUBLISHED' } });
  }
  async maxVersionNumber(organizationId: string, policyId: string, tx?: Db): Promise<number> {
    const top = await this.db(tx).policyVersion.findFirst({ where: { organizationId, policyId }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } });
    return top?.versionNumber ?? 0;
  }
  createVersion(data: Prisma.PolicyVersionUncheckedCreateInput, tx?: Db): Promise<DbPolicyVersion> {
    return this.db(tx).policyVersion.create({ data });
  }

  // ── Vínculos ───────────────────────────────────────────────────────────────
  listBindings(organizationId: string, operationId: string, tx?: Db): Promise<DbBinding[]> {
    return this.db(tx).operationPolicyBinding.findMany({ where: { organizationId, operationId }, orderBy: { priority: 'asc' } });
  }
  findBinding(organizationId: string, operationId: string, bindingId: string, tx?: Db): Promise<DbBinding | null> {
    return this.db(tx).operationPolicyBinding.findFirst({ where: { id: bindingId, organizationId, operationId } });
  }
  createBinding(data: Prisma.OperationPolicyBindingUncheckedCreateInput, tx?: Db): Promise<DbBinding> {
    return this.db(tx).operationPolicyBinding.create({ data });
  }
}
