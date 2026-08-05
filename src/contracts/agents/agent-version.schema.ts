/**
 * Arden.AS — API v1 · versão de agente (ARDEN-BE-007.1).
 *
 * Espelha `OperationVersion`: DRAFT→PUBLISHED→RETIRED, imutável após publicação,
 * publicação transacional. `objective`, `systemInstructions` e TODAS as políticas
 * pertencem à VERSÃO — nunca vêm do request de execução (anti-prompt-injection e
 * reprodutibilidade). Nenhum segredo; nenhum modelo arbitrário do request; aliases de
 * tool são referências validadas contra a operação no servidor.
 */

import { z } from 'zod';
import { isoUtcDateTime } from '../common/timestamps';
import { jsonSchemaContract } from '../connectors/connector-keys';
import {
  agentVersionId,
  agentDefinitionId,
  modelConfigurationId,
  organizationId,
  userId,
} from '../common/identifiers';
import { agentVersionStatus } from './agent-keys';
import { agentContextPolicy } from './agent-context-policy.schema';
import { agentExecutionPolicy } from './agent-execution-policy.schema';
import { agentToolPolicy } from './agent-tool-policy.schema';
import { agentEvaluationPolicy } from './agent-evaluation-policy.schema';
import { agentCostPolicy } from './agent-cost-policy.schema';

/** Entidade (resposta). Sem segredo; políticas versionadas. */
export const agentVersion = z.object({
  id: agentVersionId,
  organizationId,
  agentDefinitionId,
  versionNumber: z.number().int().positive(),
  status: agentVersionStatus,
  objective: z.string().min(1).max(2000),
  systemInstructions: z.string().min(1).max(20_000),
  modelConfigurationId,
  inputSchema: jsonSchemaContract,
  outputSchema: jsonSchemaContract,
  contextPolicy: agentContextPolicy,
  executionPolicy: agentExecutionPolicy,
  toolPolicy: agentToolPolicy,
  evaluationPolicy: agentEvaluationPolicy,
  costPolicy: agentCostPolicy,
  createdByUserId: userId,
  revision: z.number().int().min(0),
  createdAt: isoUtcDateTime,
  publishedAt: isoUtcDateTime.nullable(),
  retiredAt: isoUtcDateTime.nullable(),
});
export type AgentVersion = z.infer<typeof agentVersion>;

/** Corpo editável do rascunho (definição da versão). */
export const agentVersionDefinition = z.object({
  objective: z.string().min(1).max(2000),
  systemInstructions: z.string().min(1).max(20_000),
  modelConfigurationId,
  inputSchema: jsonSchemaContract,
  outputSchema: jsonSchemaContract,
  contextPolicy: agentContextPolicy,
  executionPolicy: agentExecutionPolicy,
  toolPolicy: agentToolPolicy,
  evaluationPolicy: agentEvaluationPolicy,
  costPolicy: agentCostPolicy,
});
export type AgentVersionDefinition = z.infer<typeof agentVersionDefinition>;

// ── Requests ──────────────────────────────────────────────────────────────────
/** Cria um rascunho, copiando explicitamente outra versão quando pedido. */
export const createAgentVersionRequest = z.object({
  basedOnVersionId: agentVersionId.optional(),
  definition: agentVersionDefinition.optional(),
  changeSummary: z.string().max(1000).optional(),
});
export type CreateAgentVersionRequest = z.infer<typeof createAgentVersionRequest>;

/** Edita o rascunho. Só rascunho; concorrência via expectedRevision. */
export const updateAgentVersionRequest = z.object({
  definition: agentVersionDefinition,
  changeSummary: z.string().max(1000).optional(),
  expectedRevision: z.number().int().min(0),
});
export type UpdateAgentVersionRequest = z.infer<typeof updateAgentVersionRequest>;

/** Publicação: comando próprio, revisão esperada e resumo obrigatório. */
export const publishAgentVersionRequest = z.object({
  expectedRevision: z.number().int().min(0),
  changeSummary: z.string().min(1).max(1000),
});
export type PublishAgentVersionRequest = z.infer<typeof publishAgentVersionRequest>;

/** Retirada de uma versão publicada (não volta a publicada). */
export const retireAgentVersionRequest = z.object({
  expectedRevision: z.number().int().min(0),
  reason: z.string().max(400).optional(),
});
export type RetireAgentVersionRequest = z.infer<typeof retireAgentVersionRequest>;

export const listAgentVersionsQuery = z.object({
  status: agentVersionStatus.optional(),
  versionNumber: z.coerce.number().int().positive().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListAgentVersionsQuery = z.infer<typeof listAgentVersionsQuery>;
