/**
 * Arden.AS API — lifecycle de versões de credencial (ARDEN-BE-006.3).
 *
 * SEM SEGREDO nesta fase: cria versões PENDING (campos criptográficos NULL),
 * ativa/supersede/revoga, mantendo a integridade do ciclo. O cofre (006.4) passará
 * a cifrar e preencher o segredo na ativação. A unicidade de "uma única ACTIVE por
 * conexão" é garantida por índice parcial único no banco (concorrência-safe).
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CredentialMetadata } from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { notFound, connectionRevoked, credentialRotationConflict, credentialRevoked, invalidStateTransition } from '../../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import { OrganizationConnectionsRepository, ConnectionCredentialVersionsRepository } from './connections.repository';
import { canTransitionCredential } from '../connector.state-machines';
import { toCredentialMetadataContract } from '../connectors.serializers';

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

@Injectable()
export class CredentialVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: OrganizationConnectionsRepository,
    private readonly repo: ConnectionCredentialVersionsRepository,
    private readonly audit: AuditRecorder,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  /** Cria uma versão PENDING (sem segredo). Estrutura para o cofre preencher em 006.4. */
  async createPending(ctx: AuthenticatedRequestContext, connectionId: string): Promise<{ data: CredentialMetadata }> {
    const orgId = this.orgId(ctx);
    const row = await this.prisma.$transaction(async (tx) => {
      const conn = await this.connections.findById(orgId, connectionId, tx);
      if (!conn) throw notFound('Conexão não encontrada.');
      if (conn.status === 'REVOKED') throw connectionRevoked();
      const versionNumber = await this.repo.nextVersionNumber(connectionId, tx);
      const created = await this.repo.createPending({ organizationId: orgId, connectionId, versionNumber, createdByUserId: ctx.userId }, tx);
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'credential.version_created', resourceType: 'connection_credential_version', resourceId: created.id, correlationId: ctx.correlationId, after: { versionNumber, status: 'PENDING' }, metadata: {} });
      return created;
    });
    return { data: toCredentialMetadataContract(row) };
  }

  /** PENDING → ACTIVE: supersede a ACTIVE anterior e aponta a conexão. */
  async activate(ctx: AuthenticatedRequestContext, connectionId: string, credentialVersionId: string): Promise<{ data: CredentialMetadata }> {
    const orgId = this.orgId(ctx);
    const now = new Date();
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const cred = await this.repo.findById(orgId, credentialVersionId, tx);
        if (!cred || cred.connectionId !== connectionId) throw notFound('Credencial não encontrada.');
        if (cred.status === 'REVOKED') throw credentialRevoked();
        if (!canTransitionCredential(cred.status, 'ACTIVE')) throw invalidStateTransition(`Transição inválida ${cred.status} → ACTIVE.`);
        const prior = await this.repo.findActive(orgId, connectionId, tx);
        if (prior && prior.id !== credentialVersionId) {
          await this.repo.supersede(orgId, prior.id, now, tx);
          await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'credential.superseded', resourceType: 'connection_credential_version', resourceId: prior.id, correlationId: ctx.correlationId, metadata: {} });
        }
        const count = await this.repo.activate(orgId, credentialVersionId, now, tx);
        if (count === 0) throw credentialRotationConflict();
        await this.connections.setCurrentCredential(orgId, connectionId, credentialVersionId, tx);
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'credential.activated', resourceType: 'connection_credential_version', resourceId: credentialVersionId, correlationId: ctx.correlationId, after: { status: 'ACTIVE' }, metadata: {} });
        return (await this.repo.findById(orgId, credentialVersionId, tx))!;
      });
      return { data: toCredentialMetadataContract(row) };
    } catch (err) {
      if (isUniqueViolation(err)) throw credentialRotationConflict();
      throw err;
    }
  }

  async revoke(ctx: AuthenticatedRequestContext, connectionId: string, credentialVersionId: string): Promise<{ data: CredentialMetadata }> {
    const orgId = this.orgId(ctx);
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const cred = await this.repo.findById(orgId, credentialVersionId, tx);
      if (!cred || cred.connectionId !== connectionId) throw notFound('Credencial não encontrada.');
      if (cred.status === 'REVOKED') return cred; // idempotente
      await this.repo.revoke(orgId, credentialVersionId, now, tx);
      if (cred.status === 'ACTIVE') await this.connections.setCurrentCredential(orgId, connectionId, null, tx);
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'credential.revoked', resourceType: 'connection_credential_version', resourceId: credentialVersionId, correlationId: ctx.correlationId, before: { status: cred.status }, after: { status: 'REVOKED' }, metadata: {} });
      return (await this.repo.findById(orgId, credentialVersionId, tx))!;
    });
    return { data: toCredentialMetadataContract(row) };
  }

  async list(ctx: AuthenticatedRequestContext, connectionId: string): Promise<{ data: CredentialMetadata[] }> {
    const orgId = this.orgId(ctx);
    const conn = await this.connections.findById(orgId, connectionId);
    if (!conn) throw notFound('Conexão não encontrada.');
    const rows = await this.repo.list(orgId, connectionId);
    return { data: rows.map(toCredentialMetadataContract) };
  }
}
