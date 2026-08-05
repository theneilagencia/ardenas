/**
 * Arden.AS — repositório de agentes/modelos/resultados sobre a API v1 (ARDEN-BE-007.7).
 *
 * Implementa `AgentsRepository` contra o backend v1 REAL (ARDEN-BE-007.1–.6).
 * API-ONLY: sem fallback para mock/IndexedDB — sem organização ativa lança erro
 * tipado. A API v1 é a ÚNICA fonte de verdade: custo/avaliação/usage vêm prontos
 * do servidor; o cliente nunca recalcula. Segredo/prompt/instrução nunca são lidos
 * de volta aqui — o adaptador só repassa o que a API retorna (e ela nunca ecoa
 * segredo). Concorrência otimista via `expectedRevision` fornecido pela UI.
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
  AgentsRepository,
  AgentUsageInput,
  CursorPage,
  ListAgentResultsInput,
  ListAgentsInput,
  ListModelConfigurationsInput,
} from '@/services/contracts';
import { ArdenRepositoryError, toRepositoryError } from '@/services/errors';
import { getActiveOrganizationId } from '@/services/session/active-context';
import type { ArdenApiV1Client, ClientPage } from './generated/api-v1-client';

function requireOrg(): string {
  const orgId = getActiveOrganizationId();
  if (!orgId) {
    throw new ArdenRepositoryError('UNAVAILABLE', 'Sem organização ativa na sessão (modo api).');
  }
  return orgId;
}

/** Chave de idempotência opaca (>=8 chars), fresca a cada ação do usuário. NUNCA contém segredo. */
function idem(): string {
  return `agent-${crypto.randomUUID()}`;
}

function toCursorPage<T>(page: ClientPage<T>): CursorPage<T> {
  return { items: page.data, cursor: page.pagination.nextCursor, hasNextPage: page.pagination.hasNextPage };
}

/** Repositório real (v1) do domínio de agentes. API-only — sem contraparte mock/IndexedDB. */
export function createApiV1AgentsRepository(client: ArdenApiV1Client): AgentsRepository {
  return {
    // ── Definições ─────────────────────────────────────────────────────────────
    async listAgents(input: ListAgentsInput = {}): Promise<CursorPage<AgentDefinition>> {
      const orgId = requireOrg();
      try {
        return toCursorPage(await client.listAgents(orgId, { ...input, limit: input.limit ?? 50 }));
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async getAgent(agentId, signal): Promise<AgentDefinition> {
      const orgId = requireOrg();
      try {
        return await client.getAgent(orgId, agentId, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async createAgent(body: CreateAgentRequest): Promise<AgentDefinition> {
      const orgId = requireOrg();
      try {
        return await client.createAgent(orgId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async updateAgent(agentId, body: UpdateAgentRequest): Promise<AgentDefinition> {
      const orgId = requireOrg();
      try {
        return await client.updateAgent(orgId, agentId, body);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async suspendAgent(agentId, body: AgentCommandRequest): Promise<AgentDefinition> {
      const orgId = requireOrg();
      try {
        return await client.suspendAgent(orgId, agentId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async reactivateAgent(agentId, body: AgentCommandRequest): Promise<AgentDefinition> {
      const orgId = requireOrg();
      try {
        return await client.reactivateAgent(orgId, agentId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async revokeAgent(agentId, body: AgentCommandRequest): Promise<AgentDefinition> {
      const orgId = requireOrg();
      try {
        return await client.revokeAgent(orgId, agentId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    // ── Versões ──────────────────────────────────────────────────────────────────
    async listAgentVersions(agentId, cursor, limit): Promise<CursorPage<AgentVersion>> {
      const orgId = requireOrg();
      try {
        return toCursorPage(await client.listAgentVersions(orgId, agentId, { cursor, limit: limit ?? 50 }));
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async getAgentVersion(agentId, agentVersionId, signal): Promise<AgentVersion> {
      const orgId = requireOrg();
      try {
        return await client.getAgentVersion(orgId, agentId, agentVersionId, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async createAgentVersion(agentId, body: CreateAgentVersionRequest): Promise<AgentVersion> {
      const orgId = requireOrg();
      try {
        return await client.createAgentVersion(orgId, agentId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async updateAgentVersion(agentId, agentVersionId, body: UpdateAgentVersionRequest): Promise<AgentVersion> {
      const orgId = requireOrg();
      try {
        return await client.updateAgentVersion(orgId, agentId, agentVersionId, body);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async publishAgentVersion(agentId, agentVersionId, body: PublishAgentVersionRequest): Promise<AgentVersion> {
      const orgId = requireOrg();
      try {
        return await client.publishAgentVersion(orgId, agentId, agentVersionId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async retireAgentVersion(agentId, agentVersionId, body: RetireAgentVersionRequest): Promise<AgentVersion> {
      const orgId = requireOrg();
      try {
        return await client.retireAgentVersion(orgId, agentId, agentVersionId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    // ── Providers de modelo (público) ─────────────────────────────────────────────
    async listModelProviders(signal): Promise<ModelProviderDefinition[]> {
      try {
        return await client.listModelProviders({ signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async listModelCatalog(providerKey, providerVersion, signal): Promise<import('@arden/contracts').ModelCatalogEntry[]> {
      try {
        return await client.listModelCatalog(providerKey, providerVersion, { signal });
      } catch (err) { throw toRepositoryError(err); }
    },
    async getModelProvider(providerKey, signal): Promise<ModelProviderDefinition> {
      try {
        return await client.getModelProvider(providerKey, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    // ── Configurações de modelo ────────────────────────────────────────────────────
    async listModelConfigurations(input: ListModelConfigurationsInput = {}): Promise<CursorPage<ModelConfiguration>> {
      const orgId = requireOrg();
      try {
        return toCursorPage(await client.listModelConfigurations(orgId, { ...input, limit: input.limit ?? 50 }));
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async getModelConfiguration(configurationId, signal): Promise<ModelConfiguration> {
      const orgId = requireOrg();
      try {
        return await client.getModelConfiguration(orgId, configurationId, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async createModelConfiguration(body: CreateModelConfigurationRequest): Promise<ModelConfiguration> {
      const orgId = requireOrg();
      try {
        return await client.createModelConfiguration(orgId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async updateModelConfiguration(configurationId, body: UpdateModelConfigurationRequest): Promise<ModelConfiguration> {
      const orgId = requireOrg();
      try {
        return await client.updateModelConfiguration(orgId, configurationId, body);
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async activateModelConfiguration(configurationId, body: ModelConfigurationCommandRequest): Promise<ModelConfiguration> {
      const orgId = requireOrg();
      try {
        return await client.activateModelConfiguration(orgId, configurationId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async suspendModelConfiguration(configurationId, body: ModelConfigurationCommandRequest): Promise<ModelConfiguration> {
      const orgId = requireOrg();
      try {
        return await client.suspendModelConfiguration(orgId, configurationId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async revokeModelConfiguration(configurationId, body: ModelConfigurationCommandRequest): Promise<ModelConfiguration> {
      const orgId = requireOrg();
      try {
        return await client.revokeModelConfiguration(orgId, configurationId, body, { idempotencyKey: idem() });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },

    // ── Resultados operacionais + uso (somente leitura) ────────────────────────────
    async listAgentResults(input: ListAgentResultsInput = {}): Promise<CursorPage<AgentOperationalResult>> {
      const orgId = requireOrg();
      try {
        return toCursorPage(await client.listAgentResults(orgId, { ...input, limit: input.limit ?? 50 }));
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async getAgentResult(resultId, signal): Promise<AgentOperationalResult> {
      const orgId = requireOrg();
      try {
        return await client.getAgentResult(orgId, resultId, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async getAgentUsage(input: AgentUsageInput, signal): Promise<AgentUsageBucket[]> {
      const orgId = requireOrg();
      try {
        return await client.getAgentUsage(orgId, input, { signal });
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
    async getExecutionAgentUsage(executionRunId, signal): Promise<AgentOperationalResult[]> {
      const orgId = requireOrg();
      try {
        const res = await client.getExecutionAgentUsage(orgId, executionRunId, { signal });
        return res.results;
      } catch (err) {
        throw toRepositoryError(err);
      }
    },
  };
}
