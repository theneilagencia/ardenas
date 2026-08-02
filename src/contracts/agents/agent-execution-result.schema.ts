/**
 * Arden.AS — API v1 · resultado de execução, geração de modelo (interno), sinais de
 * segurança e configuração da etapa `agent.execute` (ARDEN-BE-007.1).
 *
 * Tipos INTERNOS da runtime (sem SDK: nenhum import de Anthropic/OpenAI/Bedrock/
 * Vertex). Representação serializável usada pelas interfaces arquiteturais. Invariantes
 * de resultado são reforçadas por testes. A etapa `agent.execute` referencia uma versão
 * PUBLICADA — sem prompt livre, sem modelId livre, sem provider livre, sem tool fora da
 * versão, sem segredo.
 */

import { z } from 'zod';
import { jsonSchemaContract } from '../connectors/connector-keys';
import { agentDefinitionId, agentVersionId, correlationId } from '../common/identifiers';
import {
  modelProviderKey,
  modelProviderVersion,
  modelId,
  modelFinishReason,
  agentExecutionStatus,
  agentSecuritySignalCode,
  agentSecuritySignalSeverity,
  agentSecuritySignalSource,
} from './agent-keys';
import { agentUsage } from './agent-usage.schema';
import { modelMessage } from './agent-prompt.schema';
import { modelToolDefinition, modelToolCall } from './agent-tool-policy.schema';

// ── Geração de modelo (interno, sem SDK) ────────────────────────────────────────
export const modelGenerationRequest = z.object({
  providerKey: modelProviderKey,
  providerVersion: modelProviderVersion,
  modelId,
  systemInstructions: z.string().min(1).max(20_000),
  messages: z.array(modelMessage).min(1).max(200),
  tools: z.array(modelToolDefinition).max(50),
  outputSchema: jsonSchemaContract.optional(),
  maximumInputTokens: z.number().int().positive().max(1_000_000),
  maximumOutputTokens: z.number().int().positive().max(200_000),
  correlationId,
});
export type ModelGenerationRequest = z.infer<typeof modelGenerationRequest>;

export const modelGenerationResult = z.object({
  /** Id do provider — NÃO exposto automaticamente no frontend. */
  providerRequestId: z.string().max(200).optional(),
  finishReason: modelFinishReason,
  text: z.string().optional(),
  structuredOutput: z.unknown().optional(),
  toolCalls: z.array(modelToolCall).max(50),
  usage: agentUsage,
});
export type ModelGenerationResult = z.infer<typeof modelGenerationResult>;

// ── Sinais de segurança (prompt injection) — contrato e evidência futura ────────
export const agentSecuritySignal = z.object({
  code: agentSecuritySignalCode,
  severity: agentSecuritySignalSeverity,
  source: agentSecuritySignalSource,
  blocked: z.boolean(),
});
export type AgentSecuritySignal = z.infer<typeof agentSecuritySignal>;

// ── Resultado da execução do agente ─────────────────────────────────────────────
export const agentExecutionResult = z.object({
  status: agentExecutionStatus,
  output: z.unknown().optional(),
  errorCode: z.string().max(120).optional(),
  errorSummary: z.string().max(500).optional(),
  usage: agentUsage,
  modelCallCount: z.number().int().min(0),
  toolCallCount: z.number().int().min(0),
  turnCount: z.number().int().min(0),
  evidenceReferenceIds: z.array(z.string().min(1).max(128)).max(200),
  durationMs: z.number().int().min(0),
});
export type AgentExecutionResult = z.infer<typeof agentExecutionResult>;

/**
 * Verifica as invariantes de um `AgentExecutionResult`:
 * SUCCEEDED exige output; FAILED exige erro; UNKNOWN não é sucesso; contadores ≥ 0.
 * Retorna a lista de violações (vazia = válido).
 */
export function agentExecutionResultInvariants(result: AgentExecutionResult): string[] {
  const problems: string[] = [];
  if (result.status === 'SUCCEEDED' && result.output === undefined) {
    problems.push('SUCCEEDED exige output presente.');
  }
  if (result.status === 'FAILED' && !result.errorCode) {
    problems.push('FAILED exige errorCode.');
  }
  // UNKNOWN nunca vira sucesso: por construção do enum já é distinto; garantimos que
  // não carrega semântica de sucesso silencioso (sem output tratado como aceito).
  if (result.status === 'UNKNOWN' && result.output !== undefined && !result.errorCode) {
    problems.push('UNKNOWN não pode apresentar output aceito sem erro (evita sucesso silencioso).');
  }
  for (const [k, v] of [
    ['modelCallCount', result.modelCallCount],
    ['toolCallCount', result.toolCallCount],
    ['turnCount', result.turnCount],
    ['durationMs', result.durationMs],
  ] as const) {
    if (v < 0) problems.push(`${k} não pode ser negativo.`);
  }
  return problems;
}

// ── Configuração da etapa `agent.execute` ───────────────────────────────────────
/**
 * Payload da etapa de operação que invoca um agente. Referencia uma versão PUBLICADA
 * (validado no servidor). Sem prompt livre, sem modelId/provider livre, sem tool fora
 * da versão, sem segredo. Mapeamentos usam a DSL declarativa existente (validada na
 * fase futura), representados aqui como documentos serializáveis.
 */
export const agentExecuteStepConfiguration = z.object({
  agentDefinitionId,
  agentVersionId,
  inputMapping: z.unknown(),
  outputMapping: z.unknown(),
  timeoutMs: z.number().int().positive().max(3_600_000).optional(),
});
export type AgentExecuteStepConfiguration = z.infer<typeof agentExecuteStepConfiguration>;
