/**
 * Arden.AS — API v1 · política de contexto do agente (ARDEN-BE-007.1).
 *
 * Declara as ÚNICAS fontes de contexto permitidas para montar o prompt de uma versão
 * de agente. Allowlist fechada: sem memória global, sem acesso a outro tenant, sem
 * leitura arbitrária de banco, sem environment variables, sem vault, sem prompts de
 * outros agentes e SEM todos os outputs por default. Pertence à `AgentVersion`.
 */

import { z } from 'zod';

const allowedKey = z.string().min(1).max(120);

export const agentContextPolicy = z.object({
  /** Inclui o input da etapa (canal de dado, não de instrução). */
  includeExecutionInput: z.boolean(),
  /** Inclui metadados seguros da operação (objetivo/etapa), nunca segredo. */
  includeOperationMetadata: z.boolean(),
  /** Saídas de etapas anteriores — allowlist explícita (nunca todas por default). */
  previousStepOutputs: z.object({
    enabled: z.boolean(),
    allowedStepKeys: z.array(allowedKey).max(100),
  }),
  /** Documentos vinculados — apenas por referência allowlistada. */
  linkedDocuments: z.object({
    enabled: z.boolean(),
    documentReferenceIds: z.array(allowedKey).max(100),
  }),
  /** Resultados de tools — apenas aliases allowlistados (existentes na operação). */
  toolResults: z.object({
    enabled: z.boolean(),
    allowedToolAliases: z.array(allowedKey).max(100),
  }),
  /** Tetos de contexto (positivos). */
  maximumContextBytes: z.number().int().positive().max(4_000_000),
  maximumInputTokens: z.number().int().positive().max(1_000_000),
  /** Redação de campos sensíveis antes de montar o prompt. */
  redactSensitiveFields: z.boolean(),
});
export type AgentContextPolicy = z.infer<typeof agentContextPolicy>;

/** Default seguro: mínimo de contexto, redação ligada, nenhuma fonte ampla. */
export const AGENT_CONTEXT_POLICY_SAFE_DEFAULT: AgentContextPolicy = {
  includeExecutionInput: true,
  includeOperationMetadata: true,
  previousStepOutputs: { enabled: false, allowedStepKeys: [] },
  linkedDocuments: { enabled: false, documentReferenceIds: [] },
  toolResults: { enabled: false, allowedToolAliases: [] },
  maximumContextBytes: 262_144,
  maximumInputTokens: 8_000,
  redactSensitiveFields: true,
};
