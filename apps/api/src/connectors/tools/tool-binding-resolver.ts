/**
 * Arden.AS API — resolução de tool binding para execução (ARDEN-BE-006.6).
 *
 * TENANT-SCOPED. Resolve alias → OperationToolBinding → OrganizationToolBinding →
 * OrganizationConnection → ConnectorDefinition/ToolDefinition, validando as 18 regras
 * de segurança. Retorna SOMENTE dados seguros (sem segredo, sem URL arbitrária, sem
 * classe). `internal.test` é bloqueado em produção. Erros são tipados e sanitizados.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditRecorder } from '../../audit/audit.recorder';
import {
  notFound, toolBindingNotFound, toolNotAvailable, toolExecutionDenied,
  connectionNotActive, connectionSuspended, connectionRevoked,
} from '../../common/errors/api-error';
import { OperationToolBindingsRepository, OrganizationToolBindingsRepository } from '../tool-bindings/tool-bindings.repository';
import { OrganizationConnectionsRepository } from '../connections/connections.repository';
import { ConnectorDefinitionsRepository, ConnectorToolDefinitionsRepository } from '../catalog/catalog.repository';
import { buildSecureHttpPolicy } from './network-policy-runtime';
import type { ResolvedToolBinding } from './tool-execution.types';

export interface ResolveToolBindingInput {
  organizationId: string;
  operationId: string;
  operationVersionId: string;
  alias: string;
  actionKey: string;
  correlationId: string;
  nodeEnv: string;
  actorUserId?: string | null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

@Injectable()
export class ToolBindingResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opBindings: OperationToolBindingsRepository,
    private readonly orgBindings: OrganizationToolBindingsRepository,
    private readonly connections: OrganizationConnectionsRepository,
    private readonly connectors: ConnectorDefinitionsRepository,
    private readonly tools: ConnectorToolDefinitionsRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async resolveForExecution(input: ResolveToolBindingInput): Promise<ResolvedToolBinding> {
    try {
      const resolved = await this.resolve(input);
      await this.record(input, 'tool_binding.resolved', 'SUCCESS', resolved.operationToolBindingId, {
        alias: input.alias, actionKey: input.actionKey, connectorKey: resolved.connectorKey, toolKey: resolved.toolKey,
      });
      return resolved;
    } catch (err) {
      await this.record(input, 'tool_binding.resolution_denied', 'DENIED', input.operationId, {
        alias: input.alias, actionKey: input.actionKey, reason: err instanceof Error && 'code' in err ? (err as { code: string }).code : 'unknown',
      }).catch(() => undefined);
      throw err;
    }
  }

  private async resolve(input: ResolveToolBindingInput): Promise<ResolvedToolBinding> {
    const { organizationId, operationId, operationVersionId, alias, actionKey } = input;

    // (1) operação pertence ao tenant.
    const op = await this.prisma.operation.findFirst({ where: { id: operationId, organizationId } });
    if (!op) throw notFound('Operação não encontrada.');
    // (2/3) versão pertence à operação e está publicada.
    const version = await this.prisma.operationVersion.findFirst({ where: { id: operationVersionId, organizationId, operationId, status: 'published' } });
    if (!version) throw toolExecutionDenied('Versão da operação não está publicada.');

    // (4/6/7) operation binding pertence ao tenant, não removido, alias confere.
    const opBinding = await this.opBindings.findByAlias(organizationId, operationId, alias);
    if (!opBinding || opBinding.removedAt) throw toolBindingNotFound('Alias de ferramenta não encontrado.');
    // (5) binding habilitado.
    if (!opBinding.enabled) throw toolExecutionDenied('Vínculo da operação desabilitado.');
    // vínculo atrelado a uma versão específica deve bater com a publicada.
    if (opBinding.operationVersionId && opBinding.operationVersionId !== operationVersionId) {
      throw toolExecutionDenied('Vínculo pertence a outra versão da operação.');
    }
    // (8) actionKey solicitada está em allowedActionKeys.
    const allowed = Array.isArray(opBinding.allowedActionKeys) ? (opBinding.allowedActionKeys as unknown[]) : [];
    if (!allowed.includes(actionKey)) throw toolExecutionDenied('Action key não permitida para este alias.');

    // (9/10) organization binding pertence ao tenant e está habilitado.
    const orgBinding = await this.orgBindings.findById(organizationId, opBinding.organizationToolBindingId);
    if (!orgBinding) throw toolBindingNotFound('Vínculo de organização não encontrado.');
    if (!orgBinding.enabled) throw toolExecutionDenied('Vínculo de organização desabilitado.');

    // (11/12) connection pertence ao tenant e está ACTIVE.
    const conn = await this.connections.findById(organizationId, orgBinding.connectionId);
    if (!conn) throw notFound('Conexão não encontrada.');
    if (conn.status === 'REVOKED') throw connectionRevoked();
    if (conn.status === 'SUSPENDED') throw connectionSuspended();
    if (conn.status !== 'ACTIVE') throw connectionNotActive();
    if (!conn.currentCredentialVersionId && actionKey.startsWith('external.')) {
      // Ferramentas externas exigem credencial ativa (resolvida logo antes da chamada).
      // internal.test não usa credencial.
    }

    // (13) connector definition ACTIVE.
    const connector = await this.connectors.findById(conn.connectorDefinitionId);
    if (!connector || connector.status !== 'ACTIVE') throw toolNotAvailable('Conector indisponível.');
    // (17) internal.test bloqueado em produção.
    if (!connector.productionAllowed && input.nodeEnv === 'production') {
      throw toolExecutionDenied('Conector de teste é proibido em produção.');
    }

    // (14/15) tool definition ativa e pertence ao conector da conexão.
    const tool = await this.prisma.connectorToolDefinition.findFirst({ where: { id: orgBinding.connectorToolDefinitionId, connectorDefinitionId: connector.id } });
    if (!tool || !tool.active) throw toolNotAvailable('Ferramenta indisponível.');
    // (16) tool actionKey confere.
    if (tool.actionKey !== actionKey) throw toolExecutionDenied('Ação incompatível com a ferramenta vinculada.');

    const configuration = { ...asObject(conn.configuration), ...asObject(orgBinding.configurationOverrides) };
    const policy = buildSecureHttpPolicy(
      { template: connector.networkPolicyTemplate, connectionPolicy: conn.networkPolicy, overrides: orgBinding.policyOverrides },
      input.nodeEnv,
    );

    return {
      operationToolBindingId: opBinding.id,
      organizationToolBindingId: orgBinding.id,
      connectionId: conn.id,
      connectorKey: connector.key,
      connectorVersion: connector.version,
      toolKey: tool.key,
      toolVersion: tool.version,
      actionKey: tool.actionKey,
      configuration,
      policy,
      inputMapping: opBinding.inputMapping ?? {},
      outputMapping: opBinding.outputMapping ?? {},
      idempotencyMode: tool.idempotencyMode as ResolvedToolBinding['idempotencyMode'],
      retryMode: tool.retryMode as ResolvedToolBinding['retryMode'],
      defaultTimeoutMs: tool.defaultTimeoutMs,
      maximumTimeoutMs: tool.maximumTimeoutMs,
      inputSchema: asObject(tool.inputSchema),
      outputSchema: asObject(tool.outputSchema),
      credentialSchema: asObject(connector.credentialSchema),
    };
  }

  private async record(
    input: ResolveToolBindingInput,
    action: string,
    outcome: 'SUCCESS' | 'DENIED',
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        organizationId: input.organizationId, actorUserId: input.actorUserId ?? null, action,
        resourceType: 'operation_tool_binding', resourceId, outcome, correlationId: input.correlationId, metadata,
      }),
    );
  }
}
