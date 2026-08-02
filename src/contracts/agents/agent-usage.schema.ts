/**
 * Arden.AS — API v1 · consumo e custo do agente (ARDEN-BE-007.1).
 *
 * Registro de consumo por execução/chamada de modelo. Inteiros não negativos; moeda
 * ISO quando presente; custo estimado pode ser nulo. O `providerRequestId` não é
 * exposto automaticamente no frontend. NÃO implementa billing nesta fase.
 */

import { z } from 'zod';
import { modelProviderKey, modelId } from './agent-keys';
import { currencyCode } from './agent-cost-policy.schema';

export const agentUsage = z.object({
  providerKey: modelProviderKey,
  modelId,
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  cachedInputTokens: z.number().int().min(0).optional(),
  cachedOutputTokens: z.number().int().min(0).optional(),
  toolCallCount: z.number().int().min(0),
  modelCallCount: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  estimatedCostMinor: z.number().int().min(0).nullable().optional(),
  currency: currencyCode.nullable().optional(),
});
export type AgentUsage = z.infer<typeof agentUsage>;

/** Consumo zerado (ponto de partida para acumulação). */
export function zeroAgentUsage(providerKey: string, model: string): AgentUsage {
  return {
    providerKey,
    modelId: model,
    inputTokens: 0,
    outputTokens: 0,
    toolCallCount: 0,
    modelCallCount: 0,
    durationMs: 0,
    estimatedCostMinor: null,
    currency: null,
  };
}
