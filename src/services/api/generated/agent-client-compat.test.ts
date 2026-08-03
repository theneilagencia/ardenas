/**
 * Arden.AS — compatibilidade do cliente v1 com agentes (ARDEN-BE-007).
 * Prova que os tipos do contrato bastam para tipar um cliente das rotas de
 * agentes/versões/configurações/providers/resultados/uso. Sem servidor, sem
 * fallback local, sem endpoint direto de execução de agente.
 */

import { describe, expect, it } from 'vitest';
import type { ArdenApiV1Client } from './api-v1-client';
import type {
  AgentDefinition,
  AgentVersion,
  ModelConfiguration,
  ModelProviderDefinition,
  AgentOperationalResult,
  AgentUsageBucket,
} from '@/contracts';
import {
  AGENT_CONTEXT_POLICY_SAFE_DEFAULT,
  AGENT_EXECUTION_POLICY_SLICE_DEFAULT,
  AGENT_TOOL_POLICY_SAFE_DEFAULT,
  AGENT_EVALUATION_POLICY_SAFE_DEFAULT,
  AGENT_COST_POLICY_SAFE_DEFAULT,
} from '@/contracts';

const NOW = '2026-08-01T00:00:00.000Z';
const agent: AgentDefinition = { id: 'ag1', organizationId: 'org1', key: 'k', name: 'A', description: null, status: 'ACTIVE', currentPublishedVersionId: 'v1', createdByUserId: 'u1', revision: 1, createdAt: NOW, updatedAt: NOW };
const version: AgentVersion = {
  id: 'v1', organizationId: 'org1', agentDefinitionId: 'ag1', versionNumber: 1, status: 'PUBLISHED', objective: 'o', systemInstructions: 'i', modelConfigurationId: 'cfg1',
  inputSchema: {}, outputSchema: {}, contextPolicy: AGENT_CONTEXT_POLICY_SAFE_DEFAULT, executionPolicy: AGENT_EXECUTION_POLICY_SLICE_DEFAULT as AgentVersion['executionPolicy'],
  toolPolicy: AGENT_TOOL_POLICY_SAFE_DEFAULT as AgentVersion['toolPolicy'], evaluationPolicy: AGENT_EVALUATION_POLICY_SAFE_DEFAULT as AgentVersion['evaluationPolicy'],
  costPolicy: AGENT_COST_POLICY_SAFE_DEFAULT as AgentVersion['costPolicy'], createdByUserId: 'u1', revision: 1, createdAt: NOW, publishedAt: NOW, retiredAt: null,
};
const config: ModelConfiguration = { id: 'cfg1', organizationId: 'org1', providerKey: 'internal.test-model', providerVersion: '1', name: 'C', description: null, modelId: 'test/structured-success', credentialConnectionId: null, parameters: { maximumOutputTokens: 512 }, status: 'ACTIVE', createdByUserId: 'u1', revision: 1, createdAt: NOW, updatedAt: NOW };
const provider = { key: 'internal.test-model', name: 'P', description: null, version: '1', capabilities: ['STRUCTURED_OUTPUT'], productionAllowed: false, systemManaged: true, status: 'ACTIVE' } as ModelProviderDefinition;
const result: AgentOperationalResult = {
  id: 'r1', organizationId: 'org1', executionRunId: 'run1', executionStepId: 'st1', operationId: 'op1', operationVersionId: 'ov1', agentDefinitionId: 'ag1', agentVersionId: 'v1',
  status: 'SUCCEEDED', outputValidationStatus: 'VALID', evaluationStatus: 'PASSED', governanceStatus: 'WITHIN_LIMITS',
  usageSummary: { providerKey: 'internal.test-model', modelId: 'test/structured-success', modelCallCount: 1, toolCallCount: 0, turnCount: 1, repairAttemptCount: 0, approvalCount: 0, securitySignalCount: 0, inputTokens: 100, outputTokens: 16, cachedInputTokens: 0, cachedOutputTokens: 0, durationMs: 10 },
  costSummary: { estimatedCostMinor: 0, currency: 'USD', rateCardId: 'rc1', warningCode: null },
  evaluationSummary: { status: 'PASSED', policyHash: 'h', checks: [] }, outputHash: 'oh', contextHash: 'ch', evidenceReferenceIds: [], startedAt: NOW, completedAt: NOW, durationMs: 10, createdAt: NOW,
};
const bucket: AgentUsageBucket = { dimensionType: 'ORGANIZATION', dimensionId: 'org1', periodDate: '2026-08-01', providerKey: 'internal.test-model', modelId: 'test/structured-success', currency: 'USD', executionCount: 1, succeededCount: 1, failedCount: 0, suspendedCount: 0, unknownCount: 0, modelCallCount: 1, toolCallCount: 0, inputTokens: 100, outputTokens: 16, estimatedCostMinor: 0, durationMs: 10, approvalCount: 0, criticalSignalCount: 0 };

function fakeClient(): ArdenApiV1Client {
  const c = {
    listAgents: async () => ({ data: [agent], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } }),
    getAgent: async () => agent,
    publishAgentVersion: async () => version,
    listAgentVersions: async () => ({ data: [version], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } }),
    listModelProviders: async () => [provider],
    listModelConfigurations: async () => ({ data: [config], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } }),
    listAgentResults: async () => ({ data: [result], pagination: { cursor: null, nextCursor: null, hasNextPage: false, limit: 50 } }),
    getAgentUsage: async () => [bucket],
    getExecutionAgentUsage: async () => ({ executionRunId: 'run1', results: [result] }),
  } as Partial<ArdenApiV1Client>;
  return c as ArdenApiV1Client;
}

describe('cliente v1 ↔ agentes', () => {
  it('tipa agentes/versões/providers/configurações', async () => {
    const c = fakeClient();
    expect((await c.listAgents('org1', { limit: 50 })).data[0].status).toBe('ACTIVE');
    expect((await c.getAgent('org1', 'ag1')).currentPublishedVersionId).toBe('v1');
    expect((await c.publishAgentVersion('org1', 'ag1', 'v1', { expectedRevision: 1, changeSummary: 's' }, { idempotencyKey: 'k' })).status).toBe('PUBLISHED');
    expect((await c.listModelProviders())[0].productionAllowed).toBe(false);
    expect((await c.listModelConfigurations('org1', { limit: 50 })).data[0].modelId).toBe('test/structured-success');
  });
  it('tipa resultados e uso (custo conhecido = 0, não null)', async () => {
    const c = fakeClient();
    expect((await c.listAgentResults('org1', { limit: 50 })).data[0].costSummary.estimatedCostMinor).toBe(0);
    expect((await c.getAgentUsage('org1', { groupBy: 'ORGANIZATION' }))[0].executionCount).toBe(1);
    expect((await c.getExecutionAgentUsage('org1', 'run1')).results[0].evaluationStatus).toBe('PASSED');
  });
});
