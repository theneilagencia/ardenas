/**
 * Arden.AS API — testes do content hash da versão de agente (ARDEN-BE-007.2 §21).
 */

import { describe, expect, it } from 'vitest';
import { computeAgentVersionContentHash, type AgentVersionHashInput } from './agent-content-hash';

const base: AgentVersionHashInput = {
  objective: 'classificar leads',
  systemInstructions: 'Você classifica leads.',
  modelConfigurationId: 'cfg_1',
  inputSchema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } } },
  outputSchema: { type: 'object' },
  contextPolicy: { includeExecutionInput: true, maximumInputTokens: 8000 },
  executionPolicy: { maximumTurns: 1 },
  toolPolicy: { allowedAliases: [] },
  evaluationPolicy: { requireValidOutputSchema: true },
  costPolicy: { maximumInputTokens: 8000 },
};

describe('computeAgentVersionContentHash', () => {
  it('é determinístico: mesma semântica com ordem de chaves diferente → mesmo hash', () => {
    const reordered: AgentVersionHashInput = {
      costPolicy: { maximumInputTokens: 8000 },
      evaluationPolicy: { requireValidOutputSchema: true },
      toolPolicy: { allowedAliases: [] },
      executionPolicy: { maximumTurns: 1 },
      contextPolicy: { maximumInputTokens: 8000, includeExecutionInput: true },
      outputSchema: { type: 'object' },
      inputSchema: { type: 'object', properties: { b: { type: 'number' }, a: { type: 'string' } } },
      modelConfigurationId: 'cfg_1',
      systemInstructions: 'Você classifica leads.',
      objective: 'classificar leads',
    };
    expect(computeAgentVersionContentHash(reordered)).toBe(computeAgentVersionContentHash(base));
  });

  it('muda quando um campo funcional muda', () => {
    expect(computeAgentVersionContentHash({ ...base, objective: 'outro' })).not.toBe(computeAgentVersionContentHash(base));
    expect(computeAgentVersionContentHash({ ...base, systemInstructions: 'x' })).not.toBe(computeAgentVersionContentHash(base));
    expect(computeAgentVersionContentHash({ ...base, modelConfigurationId: 'cfg_2' })).not.toBe(computeAgentVersionContentHash(base));
    expect(computeAgentVersionContentHash({ ...base, executionPolicy: { maximumTurns: 2 } })).not.toBe(computeAgentVersionContentHash(base));
  });

  it('é um hex SHA-256 de 64 caracteres', () => {
    expect(computeAgentVersionContentHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
