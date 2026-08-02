/**
 * Arden.AS API — resolução tenant-scoped do runtime de agente (ARDEN-BE-007.3 §6/§7).
 *
 * Valida operação/versão/etapa/agente/versão/configuração/provider e monta um
 * `ResolvedAgentRuntime` SEM segredo/credencial/SDK/provider client. IDs conhecidos não
 * concedem acesso: toda busca é `findFirst {id, organizationId}`. Provider de teste é
 * proibido em produção.
 */

import { Injectable } from '@nestjs/common';
import {
  agentContextPolicy,
  agentExecutionPolicy,
  agentToolPolicy,
  agentEvaluationPolicy,
  agentCostPolicy,
} from '@arden/contracts';
import { PrismaService } from '../../database/prisma.service';
import {
  agentNotFound,
  agentNotActive,
  agentRevoked,
  agentVersionNotFound,
  agentVersionNotPublished,
  modelConfigurationNotFound,
  modelConfigurationNotActive,
  modelProviderNotAvailable,
  modelProviderDisabled,
  executionNotAllowed,
} from '../../common/errors/api-error';
import { AgentDefinitionsRepository } from '../agents/agent-definitions.repository';
import { AgentVersionsRepository } from '../versions/agent-versions.repository';
import { ModelConfigurationsRepository } from '../model-configurations/model-configurations.repository';
import { ModelProviderDefinitionsRepository } from '../providers/model-providers.repository';
import type { AgentRuntimeResolver, ResolvedAgentRuntime } from './agent-runtime.types';

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? 'development') === 'production';
}

@Injectable()
export class AgentRuntimeResolverService implements AgentRuntimeResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentDefinitionsRepository,
    private readonly versions: AgentVersionsRepository,
    private readonly configs: ModelConfigurationsRepository,
    private readonly providers: ModelProviderDefinitionsRepository,
  ) {}

  async resolveForExecution(input: {
    organizationId: string;
    operationId: string;
    operationVersionId: string;
    agentDefinitionId: string;
    agentVersionId: string;
  }): Promise<ResolvedAgentRuntime> {
    const org = input.organizationId;

    // §7.1-3: operação do tenant + versão publicada da operação.
    const operation = await this.prisma.operation.findFirst({ where: { id: input.operationId, organizationId: org }, select: { id: true } });
    if (!operation) throw executionNotAllowed('Operação não encontrada para o tenant.');
    const opVersion = await this.prisma.operationVersion.findFirst({
      where: { id: input.operationVersionId, organizationId: org, operationId: input.operationId, status: 'published' },
      select: { id: true },
    });
    if (!opVersion) throw executionNotAllowed('Versão de operação não publicada.');

    // §7.6-11: agente ACTIVE + versão PUBLISHED do agente, tenant-scoped.
    const agent = await this.agents.findById(org, input.agentDefinitionId);
    if (!agent) throw agentNotFound();
    if (agent.status === 'REVOKED') throw agentRevoked();
    if (agent.status !== 'ACTIVE') throw agentNotActive();
    const version = await this.versions.findByIdForAgent(org, input.agentDefinitionId, input.agentVersionId);
    if (!version) throw agentVersionNotFound();
    if (version.status !== 'PUBLISHED') throw agentVersionNotPublished();
    if (!version.contentHash) throw agentVersionNotPublished('Versão sem content hash.');

    // §7.12-13: configuração de modelo ACTIVE do tenant.
    const config = await this.configs.findById(org, version.modelConfigurationId);
    if (!config) throw modelConfigurationNotFound();
    if (config.status !== 'ACTIVE') throw modelConfigurationNotActive();

    // §7.14-17: provider ACTIVE + permitido no ambiente (teste proibido em produção).
    const provider = await this.providers.findById(config.providerDefinitionId);
    if (!provider) throw modelProviderNotAvailable();
    if (provider.status !== 'ACTIVE') throw modelProviderDisabled();
    if (isProduction() && !provider.productionAllowed) throw modelProviderDisabled('Provider não permitido em produção.');

    // §7.19: políticas e schemas válidos (parse contra os contratos).
    const contextPolicy = agentContextPolicy.parse(version.contextPolicy);
    const executionPolicy = agentExecutionPolicy.parse(version.executionPolicy);
    const toolPolicy = agentToolPolicy.parse(version.toolPolicy);
    const evaluationPolicy = agentEvaluationPolicy.parse(version.evaluationPolicy);
    const costPolicy = agentCostPolicy.parse(version.costPolicy);

    return {
      agentDefinitionId: agent.id,
      agentVersionId: version.id,
      agentKey: agent.key,
      versionNumber: version.versionNumber,
      contentHash: version.contentHash,
      modelConfigurationId: config.id,
      providerKey: provider.key,
      providerVersion: provider.version,
      modelId: config.modelId,
      providerProductionAllowed: provider.productionAllowed,
      objective: version.objective,
      systemInstructions: version.systemInstructions,
      inputSchema: version.inputSchema as Record<string, unknown>,
      outputSchema: version.outputSchema as Record<string, unknown>,
      contextPolicy,
      executionPolicy,
      toolPolicy,
      evaluationPolicy,
      costPolicy,
    };
  }
}
