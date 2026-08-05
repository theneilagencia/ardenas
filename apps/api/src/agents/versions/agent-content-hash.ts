/**
 * Arden.AS API — content hash determinístico da versão de agente (ARDEN-BE-007.2 §21).
 *
 * Inclui APENAS o conteúdo funcional: objective, systemInstructions,
 * modelConfigurationId, input/output schema e as cinco políticas. Exclui IDs próprios,
 * timestamps, revision, status, createdBy e publishedAt. Ordem de chaves não importa
 * (canonicalização recursiva) → mesma semântica gera o mesmo hash.
 */

import { stableHash } from '../hashing/stable-hash';

export interface AgentVersionHashInput {
  objective: string;
  systemInstructions: string;
  modelConfigurationId: string;
  inputSchema: unknown;
  outputSchema: unknown;
  contextPolicy: unknown;
  executionPolicy: unknown;
  toolPolicy: unknown;
  evaluationPolicy: unknown;
  costPolicy: unknown;
}

/** SHA-256 canônico do conteúdo funcional da versão. */
export function computeAgentVersionContentHash(input: AgentVersionHashInput): string {
  return stableHash({
    objective: input.objective,
    systemInstructions: input.systemInstructions,
    modelConfigurationId: input.modelConfigurationId,
    inputSchema: input.inputSchema,
    outputSchema: input.outputSchema,
    contextPolicy: input.contextPolicy,
    executionPolicy: input.executionPolicy,
    toolPolicy: input.toolPolicy,
    evaluationPolicy: input.evaluationPolicy,
    costPolicy: input.costPolicy,
  });
}
