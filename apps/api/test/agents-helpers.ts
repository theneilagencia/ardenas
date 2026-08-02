/**
 * Arden.AS API — utilitários de teste do runtime de agentes (ARDEN-BE-007.2).
 * Constroem definições de versão válidas a partir dos defaults seguros dos contratos.
 */

import {
  AGENT_CONTEXT_POLICY_SAFE_DEFAULT,
  AGENT_EXECUTION_POLICY_SLICE_DEFAULT,
  AGENT_TOOL_POLICY_SAFE_DEFAULT,
  AGENT_EVALUATION_POLICY_SAFE_DEFAULT,
  AGENT_COST_POLICY_SAFE_DEFAULT,
  type AgentVersionDefinition,
} from '@arden/contracts';

/** Definição válida mínima de uma versão de agente para publicação. */
export function validAgentVersionDefinition(
  modelConfigurationId: string,
  overrides: Partial<AgentVersionDefinition> = {},
): AgentVersionDefinition {
  return {
    objective: 'Classificar o lead recebido.',
    systemInstructions: 'Você classifica leads corporativos com base no input fornecido.',
    modelConfigurationId,
    inputSchema: { type: 'object', properties: { lead: { type: 'string' } }, required: ['lead'] },
    outputSchema: { type: 'object', properties: { grade: { type: 'string' } }, required: ['grade'] },
    contextPolicy: AGENT_CONTEXT_POLICY_SAFE_DEFAULT,
    executionPolicy: AGENT_EXECUTION_POLICY_SLICE_DEFAULT as AgentVersionDefinition['executionPolicy'],
    toolPolicy: AGENT_TOOL_POLICY_SAFE_DEFAULT as AgentVersionDefinition['toolPolicy'],
    evaluationPolicy: AGENT_EVALUATION_POLICY_SAFE_DEFAULT as AgentVersionDefinition['evaluationPolicy'],
    costPolicy: AGENT_COST_POLICY_SAFE_DEFAULT as AgentVersionDefinition['costPolicy'],
    ...overrides,
  };
}

/** Corpo de criação de configuração de modelo apontando para o provider de teste. */
export function testModelConfigurationBody(overrides: Record<string, unknown> = {}) {
  return {
    providerKey: 'internal.test-model',
    providerVersion: '1',
    name: 'Config de teste',
    modelId: 'test-deterministic',
    parameters: { maximumOutputTokens: 512, temperature: 0.2 },
    ...overrides,
  };
}
