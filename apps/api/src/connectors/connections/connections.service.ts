/**
 * Arden.AS API — serviço de persistência de conexões (ARDEN-BE-006.3).
 *
 * Sem HTTP. Cria/edita/transiciona conexões de forma TENANT-SCOPED, com máquina de
 * estados, concorrência otimista (revision) e auditoria imutável. Reusa
 * `runIdempotentCommand` e `AuditRecorder`. Valida a `networkPolicy` contra o
 * contrato compartilhado; a validação específica do JSON Schema do conector fica
 * para 006.4 (documentado). NÃO aceita segredo.
 */

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { connectorNetworkPolicy, type CreateConnectionRequest, type UpdateConnectionRequest, type Connection, type ConnectionStatus, type TestConnectionResult, type ConnectionConfigurationValidationResult } from '@arden/contracts';
import { validateAgainstSchema } from '../tools/json-schema-validator';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from '../../modules/idempotency/idempotency.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import { runIdempotentCommand } from '../../operations/command.helpers';
import { assertRevision } from '../../common/concurrency/optimistic-concurrency';
import type { AuthenticatedRequestContext } from '../../identity/request-context';
import {
  notFound, connectorNotAvailable, connectorDeprecated, invalidStateTransition, connectionRevoked, versionConflict, toolExecutionDenied, ApiException,
} from '../../common/errors/api-error';
import { sensitiveDataRedactor } from '../../common/redaction/sensitive-data-redactor';
import { SECURE_HTTP_CLIENT, type SecureHttpClient } from '../http/secure-http.types';
import { buildSecureHttpPolicy } from '../tools/network-policy-runtime';
import { buildAuthHeaders, deriveAuthMode } from '../tools/auth-builder';
import { CredentialResolver } from '../vault/credential-resolver';
import { OrganizationConnectionsRepository, ConnectionCredentialVersionsRepository } from './connections.repository';
import { ConnectorDefinitionsRepository } from '../catalog/catalog.repository';
import { canTransitionConnection } from '../connector.state-machines';
import { toConnectionContract } from '../connectors.serializers';

/** Ação de auditoria por estado de destino. */
const TRANSITION_AUDIT: Record<Exclude<ConnectionStatus, 'DRAFT'>, string> = {
  ACTIVE: 'connection.activated',
  SUSPENDED: 'connection.suspended',
  ERROR: 'connection.error_marked',
  REVOKED: 'connection.revoked',
};

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: OrganizationConnectionsRepository,
    private readonly credentials: ConnectionCredentialVersionsRepository,
    private readonly connectors: ConnectorDefinitionsRepository,
    private readonly credentialResolver: CredentialResolver,
    private readonly idem: IdempotencyService,
    private readonly audit: AuditRecorder,
    @Inject(SECURE_HTTP_CLIENT) private readonly http: SecureHttpClient,
  ) {}

  private orgId(ctx: AuthenticatedRequestContext): string {
    return ctx.organizationId as string;
  }

  private async withKey(row: Awaited<ReturnType<OrganizationConnectionsRepository['findById']>>): Promise<Connection> {
    const contract = toConnectionContract(row!);
    const def = await this.prisma.connectorDefinition.findUnique({ where: { id: row!.connectorDefinitionId } });
    if (def) {
      contract.connectorKey = def.key as Connection['connectorKey'];
      contract.connectorVersion = def.version;
    }
    return contract;
  }

  async create(ctx: AuthenticatedRequestContext, body: CreateConnectionRequest, idempotencyKey: string): Promise<{ statusCode: number; body: { data: Connection } }> {
    const orgId = this.orgId(ctx);
    if (body.networkPolicy) connectorNetworkPolicy.parse(body.networkPolicy);

    const result = await runIdempotentCommand<{ data: Connection }>(
      { idem: this.idem, prisma: this.prisma },
      { method: 'POST', path: `/organizations/${orgId}/connections`, idempotencyKey, userId: ctx.userId, organizationId: orgId },
      body, 201,
      async (tx) => {
        const def = await this.connectors.findByKeyAndVersion(body.connectorKey, body.connectorVersion, tx);
        if (!def || def.status === 'DISABLED') throw connectorNotAvailable();
        if (def.status === 'DEPRECATED') throw connectorDeprecated();
        const networkPolicy = (body.networkPolicy ?? def.networkPolicyTemplate) as Prisma.InputJsonValue;
        const created = await this.repo.create({
          organizationId: orgId,
          connectorDefinitionId: def.id,
          name: body.name,
          description: body.description ?? null,
          status: 'DRAFT',
          configuration: (body.configuration ?? {}) as Prisma.InputJsonValue,
          networkPolicy,
          createdByUserId: ctx.userId,
          revision: 1,
        }, tx);
        await this.audit.record(tx, {
          organizationId: orgId, actorUserId: ctx.userId, action: 'connection.created',
          resourceType: 'organization_connection', resourceId: created.id, correlationId: ctx.correlationId,
          after: { name: created.name, status: created.status, connectorKey: def.key }, metadata: {},
        });
        return { data: await this.withKey(created) };
      },
    );
    return { statusCode: result.statusCode, body: result.response };
  }

  async update(ctx: AuthenticatedRequestContext, id: string, body: UpdateConnectionRequest): Promise<{ data: Connection }> {
    const orgId = this.orgId(ctx);
    if (body.networkPolicy) connectorNetworkPolicy.parse(body.networkPolicy);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const current = await this.repo.findById(orgId, id, tx);
      if (!current) throw notFound('Conexão não encontrada.');
      assertRevision({ resourceType: 'organization_connection', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      const data: Prisma.OrganizationConnectionUncheckedUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.configuration !== undefined) data.configuration = body.configuration as Prisma.InputJsonValue;
      if (body.networkPolicy !== undefined) data.networkPolicy = body.networkPolicy as Prisma.InputJsonValue;
      const count = await this.repo.updateGuarded(orgId, id, body.expectedRevision, data, tx);
      if (count === 0) throw versionConflict({ resourceType: 'organization_connection', resourceId: id, expectedRevision: body.expectedRevision, currentRevision: current.revision });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'connection.updated', resourceType: 'organization_connection', resourceId: id, correlationId: ctx.correlationId, metadata: {} });
      return (await this.repo.findById(orgId, id, tx))!;
    });
    return { data: await this.withKey(fresh) };
  }

  async transitionStatus(ctx: AuthenticatedRequestContext, id: string, target: ConnectionStatus, expectedRevision: number, reason?: string): Promise<{ data: Connection }> {
    const orgId = this.orgId(ctx);
    const fresh = await this.prisma.$transaction(async (tx) => {
      const current = await this.repo.findById(orgId, id, tx);
      if (!current) throw notFound('Conexão não encontrada.');
      assertRevision({ resourceType: 'organization_connection', resourceId: id, expectedRevision, currentRevision: current.revision });
      if (current.status === 'REVOKED') throw connectionRevoked();
      if (!canTransitionConnection(current.status, target)) throw invalidStateTransition(`Transição inválida ${current.status} → ${target}.`);
      const count = await this.repo.updateGuarded(orgId, id, expectedRevision, { status: target }, tx);
      if (count === 0) throw versionConflict({ resourceType: 'organization_connection', resourceId: id, expectedRevision, currentRevision: current.revision });
      const action = target === 'ACTIVE' && current.status !== 'DRAFT' ? 'connection.reactivated' : TRANSITION_AUDIT[target as Exclude<ConnectionStatus, 'DRAFT'>];
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action, resourceType: 'organization_connection', resourceId: id, correlationId: ctx.correlationId, before: { status: current.status }, after: { status: target }, metadata: reason ? { reason } : {} });
      return (await this.repo.findById(orgId, id, tx))!;
    });
    return { data: await this.withKey(fresh) };
  }

  async get(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: Connection }> {
    const row = await this.repo.findById(this.orgId(ctx), id);
    if (!row) throw notFound('Conexão não encontrada.');
    return { data: await this.withKey(row) };
  }

  /**
   * Teste FUNCIONAL da conexão (ARDEN-BE-006.6/.8): resolve a credencial ativa
   * server-side, monta um request ao endpoint FIXO da configuração (nunca URL
   * arbitrária) e usa o SecureHttpClient (SSRF + política de rede). Resultado
   * SANITIZADO; nunca persiste/retorna segredo. Atualiza lastTested* e audita.
   */
  async test(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: TestConnectionResult }> {
    const orgId = this.orgId(ctx);
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const conn = await this.repo.findById(orgId, id);
    if (!conn) throw notFound('Conexão não encontrada.');
    if (conn.status === 'REVOKED') throw connectionRevoked();
    const def = await this.connectors.findById(conn.connectorDefinitionId);
    if (!def) throw connectorNotAvailable();
    if (!def.productionAllowed && nodeEnv === 'production') throw toolExecutionDenied('Conector de teste é proibido em produção.');

    const config = (conn.configuration ?? {}) as Record<string, unknown>;
    const startedAt = Date.now();
    let status: TestConnectionResult['status'] = 'SUCCESS';
    let latencyMs: number | null = null;
    let errorCode: string | null = null;
    let errorSummary: string | null = null;
    let fingerprint: string | null = null;

    try {
      // internal.test não faz rede: teste determinístico (só fora de produção).
      if (def.key === 'internal.test') {
        latencyMs = 0;
      } else {
        const endpoint = def.key === 'system.webhook' ? config.endpointUrl : config.baseUrl;
        if (typeof endpoint !== 'string' || !endpoint) throw toolExecutionDenied('Configuração sem endpoint fixo.');
        const policy = buildSecureHttpPolicy({ template: def.networkPolicyTemplate, connectionPolicy: conn.networkPolicy }, nodeEnv);

        const headers: Record<string, string> = {};
        if (conn.currentCredentialVersionId) {
          const resolved = await this.credentialResolver.resolveCredentialVersion({ organizationId: orgId, connectionId: id, credentialVersionId: conn.currentCredentialVersionId });
          fingerprint = resolved.fingerprint;
          const mode = deriveAuthMode(def.key, resolved.secret, false);
          Object.assign(headers, buildAuthHeaders({ mode, secret: resolved.secret, headerName: typeof resolved.secret.headerName === 'string' ? resolved.secret.headerName : undefined, now: new Date(), correlationId: ctx.correlationId }));
          resolved.secret = {};
        }
        const resp = await this.http.execute({ url: endpoint, method: 'GET', headers }, policy, { organizationId: orgId, correlationId: ctx.correlationId, connectionId: id });
        latencyMs = Date.now() - startedAt;
        if (resp.status >= 500) { status = 'FAILURE'; errorCode = 'EXTERNAL_PROVIDER_ERROR'; errorSummary = `Provedor respondeu ${resp.status}.`; }
      }
    } catch (err) {
      status = 'FAILURE';
      latencyMs = Date.now() - startedAt;
      errorCode = err instanceof ApiException ? err.code : 'EXTERNAL_PROVIDER_ERROR';
      errorSummary = sensitiveDataRedactor.redactError(err).message;
    }

    const checkedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.organizationConnection.updateMany({ where: { id, organizationId: orgId }, data: { lastTestedAt: checkedAt, lastTestStatus: status, lastErrorCode: errorCode, lastErrorSummary: errorSummary } });
      await this.audit.record(tx, { organizationId: orgId, actorUserId: ctx.userId, action: 'connection.tested', resourceType: 'organization_connection', resourceId: id, outcome: status === 'SUCCESS' ? 'SUCCESS' : 'FAILURE', correlationId: ctx.correlationId, metadata: { status, latencyMs, errorCode } });
    });

    return { data: { status, checkedAt: checkedAt.toISOString(), latencyMs, credentialFingerprint: fingerprint, errorCode, errorSummary } };
  }

  /**
   * VALIDAÇÃO LOCAL da configuração (ARDEN-BE-008.2 §17). NÃO contata o provider nem a
   * rede: valida o JSON de configuração contra o schema do conector, confere presença e
   * DECIFRABILIDADE da credencial ativa no cofre (decifra e descarta), e a compatibilidade
   * provider/conector. Sempre declara `NOT_VERIFIED_WITH_PROVIDER`. Nunca devolve segredo.
   */
  async validateConfiguration(ctx: AuthenticatedRequestContext, id: string): Promise<{ data: ConnectionConfigurationValidationResult }> {
    const orgId = this.orgId(ctx);
    const conn = await this.repo.findById(orgId, id);
    if (!conn) throw notFound('Conexão não encontrada.');
    if (conn.status === 'REVOKED') throw connectionRevoked();
    const def = await this.connectors.findById(conn.connectorDefinitionId);
    if (!def) throw connectorNotAvailable();

    const issues: string[] = [];

    // 1. Configuração válida contra o schema do conector (documento JSON Schema).
    const violations = validateAgainstSchema(conn.configuration ?? {}, (def.configurationSchema ?? undefined) as Record<string, unknown> | undefined);
    const configurationValid = violations.length === 0;
    for (const v of violations.slice(0, 10)) issues.push(`config:${v.path}:${v.message}`.slice(0, 200));

    // 2. Presença da credencial ativa (cofre) — sem exigir conexão ACTIVE.
    const active = await this.credentials.findActive(orgId, id);
    const credentialPresent = active !== null;
    if (!credentialPresent) issues.push('credential:absent');

    // 3. Decifrabilidade no cofre (decifra e descarta o plaintext) — nunca retorna segredo.
    let credentialDecryptable = false;
    let credentialFingerprint: string | null = null;
    if (active) {
      try {
        const resolved = await this.credentialResolver.resolveCredentialVersion({ organizationId: orgId, connectionId: id, credentialVersionId: active.id });
        credentialDecryptable = true;
        credentialFingerprint = resolved.fingerprint;
        resolved.secret = {};
      } catch {
        credentialDecryptable = false;
        issues.push('credential:not_decryptable');
      }
    }

    // 4. Compatibilidade provider/conector (conector ativo e não depreciado).
    const providerCompatible = def.status === 'ACTIVE';
    if (!providerCompatible) issues.push(`connector:${def.status.toLowerCase()}`);

    const validatedAt = new Date();
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        organizationId: orgId, actorUserId: ctx.userId, action: 'connection.configuration_validated',
        resourceType: 'organization_connection', resourceId: id, correlationId: ctx.correlationId,
        outcome: configurationValid && credentialPresent && credentialDecryptable && providerCompatible ? 'SUCCESS' : 'FAILURE',
        metadata: { configurationValid, credentialPresent, credentialDecryptable, providerCompatible, providerVerificationStatus: 'NOT_VERIFIED_WITH_PROVIDER' },
      }),
    );

    return {
      data: {
        connectionId: id,
        configurationValid,
        credentialPresent,
        credentialDecryptable,
        providerCompatible,
        providerVerificationStatus: 'NOT_VERIFIED_WITH_PROVIDER',
        credentialFingerprint,
        issues,
        validatedAt: validatedAt.toISOString(),
      },
    };
  }

  async list(ctx: AuthenticatedRequestContext, filters: { connectorDefinitionId?: string; status?: ConnectionStatus; search?: string }, limit: number, cursor?: string): Promise<{ data: Connection[]; nextCursor: string | null }> {
    const rows = await this.repo.list(this.orgId(ctx), filters, limit + 1, cursor);
    const hasNext = rows.length > limit;
    const page = hasNext ? rows.slice(0, limit) : rows;
    const data = await Promise.all(page.map((r) => this.withKey(r)));
    return { data, nextCursor: hasNext && page.length ? page[page.length - 1].createdAt.toISOString() : null };
  }
}
