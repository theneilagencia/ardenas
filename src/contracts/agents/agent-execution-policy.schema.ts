/**
 * Arden.AS — API v1 · política de execução do agente (ARDEN-BE-007.1).
 *
 * Limites OBRIGATÓRIOS do loop do agente. Sem execução ilimitada, sem loop infinito.
 * Quando `toolCallingAllowed=false`, `maximumToolCalls` DEVE ser 0. Complementa (não
 * substitui) o Gradiente de Autoridade (BE-004) e o timeout do step (BE-005).
 */

import { z } from 'zod';
import { agentTimeoutBehavior } from './agent-keys';

export const agentExecutionPolicy = z
  .object({
    maximumTurns: z.number().int().positive().max(50),
    maximumToolCalls: z.number().int().min(0).max(100),
    maximumDurationMs: z.number().int().positive().max(3_600_000),
    maximumInputTokens: z.number().int().positive().max(1_000_000),
    maximumOutputTokens: z.number().int().positive().max(200_000),
    structuredOutputRequired: z.boolean(),
    toolCallingAllowed: z.boolean(),
    retryInvalidOutput: z.boolean(),
    maximumOutputRepairAttempts: z.number().int().min(0).max(5),
    timeoutBehavior: agentTimeoutBehavior,
    unknownResultBehavior: agentTimeoutBehavior,
  })
  .superRefine((policy, ctx) => {
    if (!policy.toolCallingAllowed && policy.maximumToolCalls !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximumToolCalls'],
        message: 'toolCallingAllowed=false exige maximumToolCalls=0.',
      });
    }
    if (!policy.retryInvalidOutput && policy.maximumOutputRepairAttempts !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximumOutputRepairAttempts'],
        message: 'retryInvalidOutput=false exige maximumOutputRepairAttempts=0.',
      });
    }
  });
export type AgentExecutionPolicy = z.infer<typeof agentExecutionPolicy>;

/** Default do vertical slice: 1 turno, sem tool calling, structured output obrigatório. */
export const AGENT_EXECUTION_POLICY_SLICE_DEFAULT = {
  maximumTurns: 1,
  maximumToolCalls: 0,
  maximumDurationMs: 60_000,
  maximumInputTokens: 8_000,
  maximumOutputTokens: 2_000,
  structuredOutputRequired: true,
  toolCallingAllowed: false,
  retryInvalidOutput: true,
  maximumOutputRepairAttempts: 1,
  timeoutBehavior: 'FAIL',
  unknownResultBehavior: 'FAIL',
} as const;
