/**
 * Arden.AS API — resolução server-side de credencial (ARDEN-BE-006.4).
 *
 * SOMENTE serviços internos autorizados resolvem segredos (não há endpoint público
 * de resolução; o frontend nunca resolve). Valida tenant, estado da conexão e da
 * credencial ativa, e delega a decifragem ao cofre — retornando plaintext apenas em
 * memória. Nunca registra o objeto resolvido; a auditoria é sanitizada.
 */

import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { notFound, connectionRevoked, connectionSuspended, connectionNotActive, credentialRequired } from '../../common/errors/api-error';
import { OrganizationConnectionsRepository, ConnectionCredentialVersionsRepository } from '../connections/connections.repository';
import { SECRET_VAULT, type SecretVault } from './secret-vault';

export interface ResolveActiveCredentialInput {
  organizationId: string;
  connectionId: string;
  correlationId?: string;
  actorUserId?: string | null;
}

export interface ResolvedCredential {
  connectionId: string;
  credentialVersionId: string;
  secret: Record<string, unknown>;
  fingerprint: string;
  keyVersion: string;
}

@Injectable()
export class CredentialResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: OrganizationConnectionsRepository,
    private readonly credentials: ConnectionCredentialVersionsRepository,
    private readonly audit: AuditRecorder,
    @Inject(SECRET_VAULT) private readonly vault: SecretVault,
  ) {}

  /**
   * Resolve o segredo de uma VERSÃO específica de credencial (ex.: segredo de
   * assinatura de webhook), tenant-scoped, sem exigir que seja a ativa da conexão.
   * Não audita (o chamador registra o contexto de webhook). Nunca loga o segredo.
   */
  async resolveCredentialVersion(input: { organizationId: string; connectionId: string; credentialVersionId: string }): Promise<ResolvedCredential> {
    const version = await this.credentials.findById(input.organizationId, input.credentialVersionId);
    if (!version || version.connectionId !== input.connectionId) throw credentialRequired();
    if (version.status === 'REVOKED') throw credentialRequired();
    const resolved = await this.vault.resolveSecret({ organizationId: input.organizationId, connectionId: input.connectionId, credentialVersionId: version.id });
    return { connectionId: input.connectionId, credentialVersionId: version.id, secret: resolved.secret, fingerprint: resolved.fingerprint, keyVersion: resolved.keyVersion };
  }

  async resolveActiveCredential(input: ResolveActiveCredentialInput): Promise<ResolvedCredential> {
    const { organizationId, connectionId } = input;
    const correlationId = input.correlationId ?? 'internal';
    try {
      const conn = await this.connections.findById(organizationId, connectionId);
      if (!conn) throw notFound('Conexão não encontrada.');
      if (conn.status === 'REVOKED') throw connectionRevoked();
      if (conn.status === 'SUSPENDED') throw connectionSuspended();
      if (conn.status !== 'ACTIVE') throw connectionNotActive();

      const active = await this.credentials.findActive(organizationId, connectionId);
      if (!active) throw credentialRequired();

      const resolved = await this.vault.resolveSecret({ organizationId, connectionId, credentialVersionId: active.id });

      await this.record(organizationId, active.id, 'credential.resolved', 'SUCCESS', correlationId, input.actorUserId ?? null, {
        credentialVersionId: active.id, versionNumber: active.versionNumber, keyVersion: resolved.keyVersion, fingerprint: resolved.fingerprint,
      });
      return { connectionId, credentialVersionId: active.id, secret: resolved.secret, fingerprint: resolved.fingerprint, keyVersion: resolved.keyVersion };
    } catch (err) {
      await this.record(organizationId, connectionId, 'credential.resolution_denied', 'DENIED', correlationId, input.actorUserId ?? null, {
        reason: err instanceof Error && 'code' in err ? (err as { code: string }).code : 'unknown',
      }).catch(() => undefined);
      throw err;
    }
  }

  private async record(
    organizationId: string,
    resourceId: string,
    action: string,
    outcome: 'SUCCESS' | 'DENIED',
    correlationId: string,
    actorUserId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, { organizationId, actorUserId, action, resourceType: 'connection_credential_version', resourceId, outcome, correlationId, metadata }),
    );
  }
}
