/**
 * Arden.AS — casos de uso do domínio de agentes (ARDEN-BE-007.7).
 *
 * Única porta da camada de aplicação para agentes/versões/configurações de
 * modelo/providers/resultados/uso. O tenant vem SEMPRE do `RequestContext`
 * (sessão ativa) — nunca de formulário. Concorrência otimista via
 * `expectedRevision` fornecido pela UI. Defesa de UX por `assertPermission`
 * (o backend revalida). A API v1 é a fonte de verdade: custo/avaliação/usage
 * chegam prontos do servidor e NUNCA são recalculados aqui.
 */

import type {
  AgentCommandRequest,
  AgentDefinition,
  AgentOperationalResult,
  AgentUsageBucket,
  AgentVersion,
  CreateAgentRequest,
  CreateAgentVersionRequest,
  CreateModelConfigurationRequest,
  ModelConfiguration,
  ModelConfigurationCommandRequest,
  ModelProviderDefinition,
  PublishAgentVersionRequest,
  RetireAgentVersionRequest,
  UpdateAgentRequest,
  UpdateAgentVersionRequest,
  UpdateModelConfigurationRequest,
} from '@/contracts';
import type {
  AgentUsageInput,
  CursorPage,
  ListAgentResultsInput,
  ListAgentsInput,
  ListModelConfigurationsInput,
} from '@/services/contracts';
import { getServices } from '@/services/service-container';
import { toRepositoryError } from '@/services/errors';
import { assertPermission, type RequestContext } from '../request-context';

const agents = () => getServices().agents;

async function guarded<T>(ctx: RequestContext, permission: Parameters<typeof assertPermission>[1], run: () => Promise<T>): Promise<T> {
  assertPermission(ctx, permission);
  try {
    return await run();
  } catch (err) {
    throw toRepositoryError(err);
  }
}

// ── Definições ────────────────────────────────────────────────────────────────
export function listAgents(ctx: RequestContext, input: ListAgentsInput = {}): Promise<CursorPage<AgentDefinition>> {
  return guarded(ctx, 'agent.view', () => agents().listAgents(input));
}
export function getAgent(ctx: RequestContext, agentId: string, signal?: AbortSignal): Promise<AgentDefinition> {
  return guarded(ctx, 'agent.view', () => agents().getAgent(agentId, signal));
}
export function createAgent(ctx: RequestContext, body: CreateAgentRequest): Promise<AgentDefinition> {
  return guarded(ctx, 'agent.create', () => agents().createAgent(body));
}
export function updateAgent(ctx: RequestContext, agentId: string, body: UpdateAgentRequest): Promise<AgentDefinition> {
  return guarded(ctx, 'agent.edit', () => agents().updateAgent(agentId, body));
}
export function suspendAgent(ctx: RequestContext, agentId: string, body: AgentCommandRequest): Promise<AgentDefinition> {
  return guarded(ctx, 'agent.suspend', () => agents().suspendAgent(agentId, body));
}
export function reactivateAgent(ctx: RequestContext, agentId: string, body: AgentCommandRequest): Promise<AgentDefinition> {
  return guarded(ctx, 'agent.suspend', () => agents().reactivateAgent(agentId, body));
}
export function revokeAgent(ctx: RequestContext, agentId: string, body: AgentCommandRequest): Promise<AgentDefinition> {
  return guarded(ctx, 'agent.revoke', () => agents().revokeAgent(agentId, body));
}

// ── Versões ───────────────────────────────────────────────────────────────────
export function listAgentVersions(ctx: RequestContext, agentId: string, cursor?: string, limit?: number): Promise<CursorPage<AgentVersion>> {
  return guarded(ctx, 'agent.view', () => agents().listAgentVersions(agentId, cursor, limit));
}
export function getAgentVersion(ctx: RequestContext, agentId: string, agentVersionId: string, signal?: AbortSignal): Promise<AgentVersion> {
  return guarded(ctx, 'agent.view', () => agents().getAgentVersion(agentId, agentVersionId, signal));
}
export function createAgentVersion(ctx: RequestContext, agentId: string, body: CreateAgentVersionRequest): Promise<AgentVersion> {
  return guarded(ctx, 'agent.edit', () => agents().createAgentVersion(agentId, body));
}
export function updateAgentVersion(ctx: RequestContext, agentId: string, agentVersionId: string, body: UpdateAgentVersionRequest): Promise<AgentVersion> {
  return guarded(ctx, 'agent.edit', () => agents().updateAgentVersion(agentId, agentVersionId, body));
}
export function publishAgentVersion(ctx: RequestContext, agentId: string, agentVersionId: string, body: PublishAgentVersionRequest): Promise<AgentVersion> {
  return guarded(ctx, 'agent.publish', () => agents().publishAgentVersion(agentId, agentVersionId, body));
}
export function retireAgentVersion(ctx: RequestContext, agentId: string, agentVersionId: string, body: RetireAgentVersionRequest): Promise<AgentVersion> {
  return guarded(ctx, 'agent.publish', () => agents().retireAgentVersion(agentId, agentVersionId, body));
}

// ── Providers de modelo (catálogo público) ──────────────────────────────────────
export function listModelProviders(ctx: RequestContext, signal?: AbortSignal): Promise<ModelProviderDefinition[]> {
  return guarded(ctx, 'model_provider.view', () => agents().listModelProviders(signal));
}
export function getModelProvider(ctx: RequestContext, providerKey: string, signal?: AbortSignal): Promise<ModelProviderDefinition> {
  return guarded(ctx, 'model_provider.view', () => agents().getModelProvider(providerKey, signal));
}

// ── Configurações de modelo ──────────────────────────────────────────────────────
export function listModelConfigurations(ctx: RequestContext, input: ListModelConfigurationsInput = {}): Promise<CursorPage<ModelConfiguration>> {
  return guarded(ctx, 'model_configuration.view', () => agents().listModelConfigurations(input));
}
export function getModelConfiguration(ctx: RequestContext, configurationId: string, signal?: AbortSignal): Promise<ModelConfiguration> {
  return guarded(ctx, 'model_configuration.view', () => agents().getModelConfiguration(configurationId, signal));
}
export function createModelConfiguration(ctx: RequestContext, body: CreateModelConfigurationRequest): Promise<ModelConfiguration> {
  return guarded(ctx, 'model_configuration.create', () => agents().createModelConfiguration(body));
}
export function updateModelConfiguration(ctx: RequestContext, configurationId: string, body: UpdateModelConfigurationRequest): Promise<ModelConfiguration> {
  return guarded(ctx, 'model_configuration.edit', () => agents().updateModelConfiguration(configurationId, body));
}
export function activateModelConfiguration(ctx: RequestContext, configurationId: string, body: ModelConfigurationCommandRequest): Promise<ModelConfiguration> {
  return guarded(ctx, 'model_configuration.edit', () => agents().activateModelConfiguration(configurationId, body));
}
export function suspendModelConfiguration(ctx: RequestContext, configurationId: string, body: ModelConfigurationCommandRequest): Promise<ModelConfiguration> {
  return guarded(ctx, 'model_configuration.edit', () => agents().suspendModelConfiguration(configurationId, body));
}
export function revokeModelConfiguration(ctx: RequestContext, configurationId: string, body: ModelConfigurationCommandRequest): Promise<ModelConfiguration> {
  return guarded(ctx, 'model_configuration.revoke', () => agents().revokeModelConfiguration(configurationId, body));
}

// ── Resultados operacionais + uso (somente leitura) ──────────────────────────────
export function listAgentResults(ctx: RequestContext, input: ListAgentResultsInput = {}): Promise<CursorPage<AgentOperationalResult>> {
  return guarded(ctx, 'agent.view', () => agents().listAgentResults(input));
}
export function getAgentResult(ctx: RequestContext, resultId: string, signal?: AbortSignal): Promise<AgentOperationalResult> {
  return guarded(ctx, 'agent.view', () => agents().getAgentResult(resultId, signal));
}
export function getAgentUsage(ctx: RequestContext, input: AgentUsageInput, signal?: AbortSignal): Promise<AgentUsageBucket[]> {
  return guarded(ctx, 'agent.cost.view', () => agents().getAgentUsage(input, signal));
}
export function getExecutionAgentUsage(ctx: RequestContext, executionRunId: string, signal?: AbortSignal): Promise<AgentOperationalResult[]> {
  return guarded(ctx, 'agent.view', () => agents().getExecutionAgentUsage(executionRunId, signal));
}
