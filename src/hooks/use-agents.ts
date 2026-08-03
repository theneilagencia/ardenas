/**
 * Arden.AS — hooks do domínio de agentes (ARDEN-BE-007.7).
 *
 * Única porta da UI para agentes/versões/configurações de modelo/providers/
 * resultados/uso: consomem a camada de aplicação (que usa o repositório API v1)
 * passando o `RequestContext` derivado da SESSÃO ATIVA. O tenant nunca é digitado
 * num formulário — vem sempre da sessão. A API v1 é a fonte de verdade: custo,
 * avaliação e usage chegam prontos do servidor e nunca são recalculados aqui.
 * Nenhum prompt/instrução/segredo é colocado em cache — as respostas da API não
 * ecoam segredo, e os formulários mantêm rascunho só em memória transitória.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AgentCommandRequest,
  CreateAgentRequest,
  CreateAgentVersionRequest,
  CreateModelConfigurationRequest,
  ModelConfigurationCommandRequest,
  PublishAgentVersionRequest,
  RetireAgentVersionRequest,
  UpdateAgentRequest,
  UpdateAgentVersionRequest,
  UpdateModelConfigurationRequest,
} from '@/contracts';
import type { ArdenRepositoryError } from '@/services/errors';
import { ArdenRepositoryError as RepoError } from '@/services/errors';
import type {
  AgentUsageInput,
  ListAgentResultsInput,
  ListAgentsInput,
  ListModelConfigurationsInput,
} from '@/services/contracts';
import {
  activateModelConfiguration,
  createAgent,
  createAgentVersion,
  createModelConfiguration,
  getAgent,
  getAgentResult,
  getAgentVersion,
  getExecutionAgentUsage,
  getModelConfiguration,
  listAgentResults,
  listAgentVersions,
  listAgents,
  listModelConfigurations,
  listModelProviders,
  getAgentUsage,
  publishAgentVersion,
  reactivateAgent,
  retireAgentVersion,
  revokeAgent,
  revokeModelConfiguration,
  suspendAgent,
  suspendModelConfiguration,
  updateAgent,
  updateAgentVersion,
  updateModelConfiguration,
  type RequestContext,
} from '@/application';
import { useTenant } from '@/app/tenant-context';
import { useRequestContext } from './use-session';

const AGENTS_KEY = 'agents';
const AGENT_KEY = 'agent';
const AGENT_VERSIONS_KEY = 'agent-versions';
const AGENT_VERSION_KEY = 'agent-version';
const MODEL_PROVIDERS_KEY = 'model-providers';
const MODEL_CONFIGS_KEY = 'model-configurations';
const MODEL_CONFIG_KEY = 'model-configuration';
const AGENT_RESULTS_KEY = 'agent-results';
const AGENT_RESULT_KEY = 'agent-result';
const AGENT_USAGE_KEY = 'agent-usage';
const EXECUTION_USAGE_KEY = 'execution-agent-usage';

function noTenant(): RepoError {
  return new RepoError('UNAVAILABLE', 'Nenhuma organização ativa na sessão.');
}
function requireCtx(ctx: RequestContext | null): RequestContext {
  if (!ctx) throw noTenant();
  return ctx;
}
function useOrgCtx() {
  const { activeOrganization } = useTenant();
  const ctx = useRequestContext();
  return { organizationId: activeOrganization?.id ?? '', ctx, enabled: !!activeOrganization?.id && !!ctx };
}
const asError = (e: unknown): ArdenRepositoryError | null => (e as ArdenRepositoryError) ?? null;

// ── Agentes ─────────────────────────────────────────────────────────────────────
export function useAgents(filters: ListAgentsInput = {}) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [AGENTS_KEY, organizationId, filters],
    queryFn: () => listAgents(requireCtx(ctx), filters),
    enabled,
  });
  return { agents: q.data?.items ?? [], hasNextPage: q.data?.hasNextPage ?? false, cursor: q.data?.cursor ?? null, isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}

export function useAgent(agentId?: string) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [AGENT_KEY, organizationId, agentId],
    queryFn: () => getAgent(requireCtx(ctx), agentId as string),
    enabled: enabled && !!agentId,
  });
  return { agent: q.data, isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}

function useAgentsInvalidator() {
  const qc = useQueryClient();
  return (agentId?: string) => {
    void qc.invalidateQueries({ queryKey: [AGENTS_KEY] });
    if (agentId) void qc.invalidateQueries({ queryKey: [AGENT_KEY] });
  };
}

export function useCreateAgent() {
  const ctx = useRequestContext();
  const invalidate = useAgentsInvalidator();
  return useMutation({ mutationFn: (body: CreateAgentRequest) => createAgent(requireCtx(ctx), body), onSuccess: (a) => invalidate(a.id) });
}
export function useUpdateAgent() {
  const ctx = useRequestContext();
  const invalidate = useAgentsInvalidator();
  return useMutation({ mutationFn: ({ agentId, body }: { agentId: string; body: UpdateAgentRequest }) => updateAgent(requireCtx(ctx), agentId, body), onSuccess: (a) => invalidate(a.id) });
}
export function useSuspendAgent() {
  const ctx = useRequestContext();
  const invalidate = useAgentsInvalidator();
  return useMutation({ mutationFn: ({ agentId, body }: { agentId: string; body: AgentCommandRequest }) => suspendAgent(requireCtx(ctx), agentId, body), onSuccess: (a) => invalidate(a.id) });
}
export function useReactivateAgent() {
  const ctx = useRequestContext();
  const invalidate = useAgentsInvalidator();
  return useMutation({ mutationFn: ({ agentId, body }: { agentId: string; body: AgentCommandRequest }) => reactivateAgent(requireCtx(ctx), agentId, body), onSuccess: (a) => invalidate(a.id) });
}
export function useRevokeAgent() {
  const ctx = useRequestContext();
  const invalidate = useAgentsInvalidator();
  return useMutation({ mutationFn: ({ agentId, body }: { agentId: string; body: AgentCommandRequest }) => revokeAgent(requireCtx(ctx), agentId, body), onSuccess: (a) => invalidate(a.id) });
}

// ── Versões ───────────────────────────────────────────────────────────────────
export function useAgentVersions(agentId?: string) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [AGENT_VERSIONS_KEY, organizationId, agentId],
    queryFn: () => listAgentVersions(requireCtx(ctx), agentId as string),
    enabled: enabled && !!agentId,
  });
  return { versions: q.data?.items ?? [], isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}
export function useAgentVersion(agentId?: string, agentVersionId?: string) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [AGENT_VERSION_KEY, organizationId, agentId, agentVersionId],
    queryFn: () => getAgentVersion(requireCtx(ctx), agentId as string, agentVersionId as string),
    enabled: enabled && !!agentId && !!agentVersionId,
  });
  return { version: q.data, isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}
function useVersionsInvalidator() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [AGENT_VERSIONS_KEY] });
    void qc.invalidateQueries({ queryKey: [AGENT_VERSION_KEY] });
    void qc.invalidateQueries({ queryKey: [AGENT_KEY] });
    void qc.invalidateQueries({ queryKey: [AGENTS_KEY] });
  };
}
export function useCreateAgentVersion() {
  const ctx = useRequestContext();
  const invalidate = useVersionsInvalidator();
  return useMutation({ mutationFn: ({ agentId, body }: { agentId: string; body: CreateAgentVersionRequest }) => createAgentVersion(requireCtx(ctx), agentId, body), onSuccess: invalidate });
}
export function useUpdateAgentVersion() {
  const ctx = useRequestContext();
  const invalidate = useVersionsInvalidator();
  return useMutation({ mutationFn: ({ agentId, agentVersionId, body }: { agentId: string; agentVersionId: string; body: UpdateAgentVersionRequest }) => updateAgentVersion(requireCtx(ctx), agentId, agentVersionId, body), onSuccess: invalidate });
}
export function usePublishAgentVersion() {
  const ctx = useRequestContext();
  const invalidate = useVersionsInvalidator();
  return useMutation({ mutationFn: ({ agentId, agentVersionId, body }: { agentId: string; agentVersionId: string; body: PublishAgentVersionRequest }) => publishAgentVersion(requireCtx(ctx), agentId, agentVersionId, body), onSuccess: invalidate });
}
export function useRetireAgentVersion() {
  const ctx = useRequestContext();
  const invalidate = useVersionsInvalidator();
  return useMutation({ mutationFn: ({ agentId, agentVersionId, body }: { agentId: string; agentVersionId: string; body: RetireAgentVersionRequest }) => retireAgentVersion(requireCtx(ctx), agentId, agentVersionId, body), onSuccess: invalidate });
}

// ── Providers de modelo (público) ─────────────────────────────────────────────
export function useModelProviders() {
  const { ctx } = useOrgCtx();
  const q = useQuery({
    queryKey: [MODEL_PROVIDERS_KEY],
    queryFn: () => listModelProviders(requireCtx(ctx)),
    enabled: !!ctx,
  });
  return { providers: q.data ?? [], isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}

// ── Configurações de modelo ────────────────────────────────────────────────────
export function useModelConfigurations(filters: ListModelConfigurationsInput = {}) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [MODEL_CONFIGS_KEY, organizationId, filters],
    queryFn: () => listModelConfigurations(requireCtx(ctx), filters),
    enabled,
  });
  return { configurations: q.data?.items ?? [], isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}
export function useModelConfiguration(configurationId?: string) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [MODEL_CONFIG_KEY, organizationId, configurationId],
    queryFn: () => getModelConfiguration(requireCtx(ctx), configurationId as string),
    enabled: enabled && !!configurationId,
  });
  return { configuration: q.data, isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}
function useConfigsInvalidator() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [MODEL_CONFIGS_KEY] });
    void qc.invalidateQueries({ queryKey: [MODEL_CONFIG_KEY] });
  };
}
export function useCreateModelConfiguration() {
  const ctx = useRequestContext();
  const invalidate = useConfigsInvalidator();
  return useMutation({ mutationFn: (body: CreateModelConfigurationRequest) => createModelConfiguration(requireCtx(ctx), body), onSuccess: invalidate });
}
export function useUpdateModelConfiguration() {
  const ctx = useRequestContext();
  const invalidate = useConfigsInvalidator();
  return useMutation({ mutationFn: ({ configurationId, body }: { configurationId: string; body: UpdateModelConfigurationRequest }) => updateModelConfiguration(requireCtx(ctx), configurationId, body), onSuccess: invalidate });
}
export function useActivateModelConfiguration() {
  const ctx = useRequestContext();
  const invalidate = useConfigsInvalidator();
  return useMutation({ mutationFn: ({ configurationId, body }: { configurationId: string; body: ModelConfigurationCommandRequest }) => activateModelConfiguration(requireCtx(ctx), configurationId, body), onSuccess: invalidate });
}
export function useSuspendModelConfiguration() {
  const ctx = useRequestContext();
  const invalidate = useConfigsInvalidator();
  return useMutation({ mutationFn: ({ configurationId, body }: { configurationId: string; body: ModelConfigurationCommandRequest }) => suspendModelConfiguration(requireCtx(ctx), configurationId, body), onSuccess: invalidate });
}
export function useRevokeModelConfiguration() {
  const ctx = useRequestContext();
  const invalidate = useConfigsInvalidator();
  return useMutation({ mutationFn: ({ configurationId, body }: { configurationId: string; body: ModelConfigurationCommandRequest }) => revokeModelConfiguration(requireCtx(ctx), configurationId, body), onSuccess: invalidate });
}

// ── Resultados operacionais + uso (somente leitura) ──────────────────────────────
export function useAgentResults(filters: ListAgentResultsInput = {}) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [AGENT_RESULTS_KEY, organizationId, filters],
    queryFn: () => listAgentResults(requireCtx(ctx), filters),
    enabled,
  });
  return { results: q.data?.items ?? [], hasNextPage: q.data?.hasNextPage ?? false, cursor: q.data?.cursor ?? null, isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}
export function useAgentResult(resultId?: string) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [AGENT_RESULT_KEY, organizationId, resultId],
    queryFn: () => getAgentResult(requireCtx(ctx), resultId as string),
    enabled: enabled && !!resultId,
  });
  return { result: q.data, isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}
export function useAgentUsage(input: AgentUsageInput) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [AGENT_USAGE_KEY, organizationId, input],
    queryFn: () => getAgentUsage(requireCtx(ctx), input),
    enabled,
  });
  return { buckets: q.data ?? [], isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}
export function useExecutionAgentUsage(executionRunId?: string) {
  const { organizationId, ctx, enabled } = useOrgCtx();
  const q = useQuery({
    queryKey: [EXECUTION_USAGE_KEY, organizationId, executionRunId],
    queryFn: () => getExecutionAgentUsage(requireCtx(ctx), executionRunId as string),
    enabled: enabled && !!executionRunId,
  });
  return { results: q.data ?? [], isLoading: q.isLoading, error: asError(q.error), refetch: q.refetch };
}
