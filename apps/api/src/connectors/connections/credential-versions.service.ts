/**
 * Arden.AS API — lifecycle de versões de credencial (ARDEN-BE-006.3 + 006.4).
 *
 * 006.3 forneceu os primitivos de lifecycle SEM segredo (createPending/activate).
 * 006.4 adiciona o fluxo REAL com o cofre: `create` e `rotate` recebem o segredo,
 * validam, cifram (AES-256-GCM via SecretVault) e ativam ATOMICAMENTE (nova versão →
 * ACTIVE, anterior → SUPERSEDED, ponteiro atualizado) numa única transação. Rollback
 * total em qualquer falha. `revoke` faz crypto-shredding via cofre. Nenhum plaintext
 * é persistido; nenhuma resposta/auditoria contém segredo.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CredentialMetadata, CreateConnectionCredentialRequest, RotateConnectionCredentialRequest } from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { runIdempotentCommand } from '../../operations/command.helpers';
import { notFound, connectionRevoked, connectionNotActive, credentialRotationConflict, credentialRevoked, invalidStateTransition } from '../../common/errors/api-error';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import { OrganizationConnectionsRepository, ConnectionCredentialVersionsRepository } from './connections.repository';
import { canTransitionCredential } from '../connector.state-machines';
import { toCredentialMetadataContract } from '../connectors.serializers';
import { SECRET_VAULT, type SecretVault } from '../vault/secret-vault';
import { ConnectorKeyProvider } from '../vault/connector-key-provider';

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
    private readonly idem: IdempotencyService,
    @Inject(SECRET_VAULT) private readonly vault: SecretVault,
    private readonly keys: ConnectorKeyProvider,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  /** Cria a PRIMEIRA credencial (ou uma nova) com segredo: cifra e ativa atomicamente. */
  async create(ctx: AuthenticatedRequestContext, connectionId: string, body: CreateConnectionCredentialRequest, idempotencyKey: string): Promise<{ statusCode: number; body: { data: CredentialMetadata } }> {
    return this.createOrRotate(ctx, connectionId, body.secret, 201, `/organizations/${this.orgId(ctx)}/connections/${connectionId}/credentials`, idempotencyKey, body, 'credential.version_created');
  }

  /** Rotaciona: nova versão cifrada torna-se ACTIVE; anterior SUPERSEDED. Atômico. */
  async rotate(ctx: AuthenticatedRequestContext, connectionId: string, body: RotateConnectionCredentialRequest, idempotencyKey: string): Promise<{ statusCode: number; body: { data: CredentialMetadata } }> {
    return this.createOrRotate(ctx, connectionId, body.secret, 201, `/organizations/${this.orgId(ctx)}/connections/${connectionId}/credentials/rotate`, idempotencyKey, body, 'credential.rotated');
  }

  private async createOrRotate(
    ctx: AuthenticatedRequestContext,
    connectionId: string,
    secret: Record<string, unknown>,
    statusCode: number,
    path: string,
    idempotencyKey: string,
    body: unknown,
    createdAction: 'credential.version_created' | 'credential.rotated',
  ): Promise<{ statusCode: number; body: { data: CredentialMetadata } }> {
    const orgId = this.orgId(ctx);
    const keyVersion = this.keys.getCurrentKey().version; // falha cedo se cofre indisponível

    const result = await runIdempotentCommand<{ data: CredentialMetadata }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body, statusCode,
      async (tx) => {
        const conn = await this.connections.findById(orgId, connectionId, tx);
        if (!conn) throw notFound('Conexão não encontrada.');
        if (conn.status === 'REVOKED') throw connectionRevoked();
        if (createdAction === 'credential.rotated' && conn.status !== 'ACTIVE') throw connectionNotActive('Rotação exige conexão ativa.');
        const def = await tx.connectorDefinition.findUnique({ where: { id: conn.connectorDefinitionId } });
        const credentialSchema = (def?.credentialSchema ?? undefined) as Record<string, unknown> | undefined;

        const versionNumber = await this.repo.nextVersionNumber(connectionId, tx);
        const created = await this.repo.createPending({ organizationId: orgId, connectionId, versionNumber, createdByUserId: ctx.userId }, tx);

        // Cifra o segredo NA MESMA transação (atomicidade total; rollback em falha).
        const ref = await this.vault.storeSecret({ organizationId: orgId, connectionId, credentialVersionId: created.id, keyVersion, secret, credentialSchema }, tx);
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: createdAction, resourceType: 'connection_credential_version', resourceId: created.id, correlationId: ctx.correlationId, after: { versionNumber, status: 'PENDING', keyVersion: ref.keyVersion, fingerprint: ref.fingerprint }, metadata: {} });

        // Ativa: supersede a ativa anterior (se houver) e aponta a conexão.
        const prior = await this.repo.findActive(orgId, connectionId, tx);
        if (prior && prior.id !== created.id) {
          await this.repo.supersede(orgId, prior.id, new Date(), tx);
          await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'credential.superseded', resourceType: 'connection_credential_version', resourceId: prior.id, correlationId: ctx.correlationId, metadata: {} });
        }
        const activated = await this.repo.activate(orgId, created.id, new Date(), tx);
        if (activated === 0) throw credentialRotationConflict();
        await this.connections.setCurrentCredential(orgId, connectionId, created.id, tx);
        await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'credential.activated', resourceType: 'connection_credential_version', resourceId: created.id, correlationId: ctx.correlationId, after: { status: 'ACTIVE', fingerprint: ref.fingerprint }, metadata: {} });

        const fresh = (await this.repo.findById(orgId, created.id, tx))!;
        return { data: toCredentialMetadataContract(fresh) };
      },
    ).catch((err) => {
      if (isUniqueViolation(err)) throw credentialRotationConflict();
      throw err;
    });
    return { statusCode: result.statusCode, body: result.response };
  }

  async revoke(ctx: AuthenticatedRequestContext, connectionId: string, credentialVersionId: string): Promise<{ data: CredentialMetadata }> {
    const orgId = this.orgId(ctx);
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const cred = await this.repo.findById(orgId, credentialVersionId, tx);
      if (!cred || cred.connectionId !== connectionId) throw notFound('Credencial não encontrada.');
      if (cred.status === 'REVOKED') return cred; // idempotente
      await this.repo.revoke(orgId, credentialVersionId, now, tx);
      // Crypto-shredding: zera o material criptográfico da versão revogada.
      await this.vault.revokeSecret({ organizationId: orgId, connectionId, credentialVersionId }, tx);
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

  // ── Primitivos de lifecycle SEM segredo (006.3) — mantidos p/ testes de integridade ──
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
}
