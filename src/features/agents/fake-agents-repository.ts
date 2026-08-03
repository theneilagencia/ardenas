/**
 * Arden.AS — repositório de agentes FAKE para testes de componente (ARDEN-BE-007.7).
 * Reflete a forma da OpenAPI real (mesmos tipos de contrato). Sem rede, sem mock
 * funcional em produção — usado apenas nos testes.
 */

import type {
  AgentDefinition,
  AgentOperationalResult,
  AgentUsageBucket,
  AgentVersion,
  ModelConfiguration,
  ModelProviderDefinition,
} from '@/contracts';
import {
  AGENT_CONTEXT_POLICY_SAFE_DEFAULT,
  AGENT_EXECUTION_POLICY_SLICE_DEFAULT,
  AGENT_TOOL_POLICY_SAFE_DEFAULT,
  AGENT_EVALUATION_POLICY_SAFE_DEFAULT,
  AGENT_COST_POLICY_SAFE_DEFAULT,
} from '@/contracts';
import type { AgentsRepository, CursorPage } from '@/services/contracts';
import { ArdenRepositoryError } from '@/services/errors';

const page = <T>(items: T[]): CursorPage<T> => ({ items, cursor: null, hasNextPage: false });
const NOW = '2026-08-03T00:00:00.000Z';

export function makeAgent(over: Partial<AgentDefinition> = {}): AgentDefinition {
  return { id: 'ag1', organizationId: 'org1', key: 'classifier', name: 'Classificador', description: null, status: 'ACTIVE', currentPublishedVersionId: 'v1', createdByUserId: 'u1', revision: 2, createdAt: NOW, updatedAt: NOW, ...over };
}
export function makeVersion(over: Partial<AgentVersion> = {}): AgentVersion {
  return {
    id: 'v1', organizationId: 'org1', agentDefinitionId: 'ag1', versionNumber: 1, status: 'PUBLISHED',
    objective: 'Classificar leads', systemInstructions: 'Instruções seguras.', modelConfigurationId: 'cfg1',
    inputSchema: { type: 'object', properties: {}, required: [] }, outputSchema: { type: 'object', properties: {}, required: [] },
    contextPolicy: AGENT_CONTEXT_POLICY_SAFE_DEFAULT,
    executionPolicy: AGENT_EXECUTION_POLICY_SLICE_DEFAULT as AgentVersion['executionPolicy'],
    toolPolicy: AGENT_TOOL_POLICY_SAFE_DEFAULT as AgentVersion['toolPolicy'],
    evaluationPolicy: AGENT_EVALUATION_POLICY_SAFE_DEFAULT as AgentVersion['evaluationPolicy'],
    costPolicy: AGENT_COST_POLICY_SAFE_DEFAULT as AgentVersion['costPolicy'],
    createdByUserId: 'u1', revision: 3, createdAt: NOW, publishedAt: NOW, retiredAt: null, ...over,
  };
}
export function makeResult(over: Partial<AgentOperationalResult> = {}): AgentOperationalResult {
  return {
    id: 'r1', organizationId: 'org1', executionRunId: 'run1', executionStepId: 'st1', operationId: 'op1', operationVersionId: 'ov1',
    agentDefinitionId: 'ag1', agentVersionId: 'v1', status: 'SUCCEEDED', outputValidationStatus: 'VALID',
    evaluationStatus: 'PASSED', governanceStatus: 'WITHIN_LIMITS',
    usageSummary: { providerKey: 'internal.test-model', modelId: 'test/structured-success', modelCallCount: 1, toolCallCount: 0, turnCount: 1, repairAttemptCount: 0, approvalCount: 0, securitySignalCount: 0, inputTokens: 100, outputTokens: 16, cachedInputTokens: 0, cachedOutputTokens: 0, durationMs: 10 },
    costSummary: { estimatedCostMinor: 0, currency: 'USD', rateCardId: 'rc1', warningCode: null },
    evaluationSummary: { status: 'PASSED', policyHash: 'h', checks: [] },
    outputHash: 'oh', contextHash: 'ch', evidenceReferenceIds: [], startedAt: NOW, completedAt: NOW, durationMs: 10, createdAt: NOW, ...over,
  };
}
export function makeConfig(over: Partial<ModelConfiguration> = {}): ModelConfiguration {
  return { id: 'cfg1', organizationId: 'org1', providerKey: 'internal.test-model', providerVersion: '1', name: 'Config teste', description: null, modelId: 'test/structured-success', credentialConnectionId: null, parameters: { maximumOutputTokens: 512, temperature: 0.2 }, status: 'ACTIVE', createdByUserId: 'u1', revision: 1, createdAt: NOW, updatedAt: NOW, ...over };
}
export function makeProvider(over: Partial<ModelProviderDefinition> = {}): ModelProviderDefinition {
  return { key: 'internal.test-model', name: 'Provider de teste', description: null, version: '1', capabilities: ['STRUCTURED_OUTPUT'], productionAllowed: false, systemManaged: true, status: 'ACTIVE', ...over } as ModelProviderDefinition;
}

/** Fake configurável de `AgentsRepository`. Toggles de falha para estados de erro. */
export class FakeAgentsRepository implements AgentsRepository {
  agents: AgentDefinition[] = [makeAgent()];
  versions: AgentVersion[] = [makeVersion()];
  configs: ModelConfiguration[] = [makeConfig()];
  providers: ModelProviderDefinition[] = [makeProvider()];
  results: AgentOperationalResult[] = [makeResult()];
  usage: AgentUsageBucket[] = [];
  failListResults = false;
  publishedNotEditable = true;
  updateVersionCalls = 0;

  async listAgents() { return page(this.agents); }
  async getAgent(id: string) { const a = this.agents.find((x) => x.id === id); if (!a) throw new ArdenRepositoryError('NOT_FOUND', 'x'); return a; }
  async createAgent() { return makeAgent({ id: 'ag2', status: 'DRAFT', currentPublishedVersionId: null }); }
  async updateAgent(id: string) { return this.getAgent(id); }
  async suspendAgent(id: string) { return makeAgent({ id, status: 'SUSPENDED' }); }
  async reactivateAgent(id: string) { return makeAgent({ id, status: 'ACTIVE' }); }
  async revokeAgent(id: string) { return makeAgent({ id, status: 'REVOKED' }); }

  async listAgentVersions() { return page(this.versions); }
  async getAgentVersion(_a: string, vid: string) { const v = this.versions.find((x) => x.id === vid); if (!v) throw new ArdenRepositoryError('NOT_FOUND', 'x'); return v; }
  async createAgentVersion() { return makeVersion({ id: 'v2', status: 'DRAFT' }); }
  async updateAgentVersion(_a: string, vid: string) {
    this.updateVersionCalls += 1;
    const v = this.versions.find((x) => x.id === vid)!;
    if (this.publishedNotEditable && v.status !== 'DRAFT') throw new ArdenRepositoryError('CONFLICT', 'ALREADY_PUBLISHED');
    return v;
  }
  async publishAgentVersion(_a: string, vid: string) { return makeVersion({ id: vid, status: 'PUBLISHED' }); }
  async retireAgentVersion(_a: string, vid: string) { return makeVersion({ id: vid, status: 'RETIRED' }); }

  async listModelProviders() { return this.providers; }
  async getModelProvider(k: string) { return makeProvider({ key: k }); }

  async listModelConfigurations() { return page(this.configs); }
  async getModelConfiguration(id: string) { return makeConfig({ id }); }
  async createModelConfiguration() { return makeConfig({ id: 'cfg2', status: 'DRAFT' }); }
  async updateModelConfiguration(id: string) { return makeConfig({ id }); }
  async activateModelConfiguration(id: string) { return makeConfig({ id, status: 'ACTIVE' }); }
  async suspendModelConfiguration(id: string) { return makeConfig({ id, status: 'SUSPENDED' }); }
  async revokeModelConfiguration(id: string) { return makeConfig({ id, status: 'REVOKED' }); }

  async listAgentResults() { if (this.failListResults) throw new ArdenRepositoryError('UNAVAILABLE', 'x'); return page(this.results); }
  async getAgentResult(id: string) { const r = this.results.find((x) => x.id === id); if (!r) throw new ArdenRepositoryError('NOT_FOUND', 'x'); return r; }
  async getAgentUsage() { return this.usage; }
  async getExecutionAgentUsage() { return this.results; }
}
