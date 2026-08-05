/**
 * Arden.AS — API v1 · saída estruturada do agente (ARDEN-BE-007.1).
 *
 * Contrato de validação de saída. Output inválido NUNCA é sucesso. Nesta fase apenas
 * contratos e testes — sem validação funcional de LLM. Pertence à versão do agente.
 */

import { z } from 'zod';
import { jsonSchemaContract } from '../connectors/connector-keys';

export const agentStructuredOutput = z.object({
  schema: jsonSchemaContract,
  /** Retém o output BRUTO do modelo (sanitizado) para evidência/depuração. */
  rawOutputRetained: z.boolean(),
  /** Retém o output ACEITO (validado). */
  acceptedOutputRetained: z.boolean(),
  maximumOutputBytes: z.number().int().positive().max(4_000_000),
  maximumRepairAttempts: z.number().int().min(0).max(5),
});
export type AgentStructuredOutput = z.infer<typeof agentStructuredOutput>;

/** Erro de validação de um caminho do output. */
export const agentOutputValidationError = z.object({
  path: z.string().max(200),
  code: z.string().max(120),
  message: z.string().max(500),
});
export type AgentOutputValidationError = z.infer<typeof agentOutputValidationError>;

/**
 * Resultado da validação de saída. `valid=false` jamais deve ser tratado como sucesso
 * pela runtime (ver `AGENT_OUTPUT_INVALID`).
 */
export const agentOutputValidationResult = z.object({
  valid: z.boolean(),
  acceptedOutput: z.unknown().optional(),
  validationErrors: z.array(agentOutputValidationError).max(200).optional(),
  repairAttemptCount: z.number().int().min(0),
});
export type AgentOutputValidationResult = z.infer<typeof agentOutputValidationResult>;
