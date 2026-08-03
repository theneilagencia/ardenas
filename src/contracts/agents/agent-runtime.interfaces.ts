/**
 * Arden.AS — runtime de agentes · interfaces arquiteturais (ARDEN-BE-007.1).
 *
 * APENAS interfaces (type-only) e tokens de DI. SEM implementação, SEM SDK, SEM
 * registro no Nest nesta fase. As implementações concretas (provider real,
 * assembler, validator, evaluator, runtime, `AgentStepExecutor`) chegam em fases
 * futuras (007.3+), sob `apps/api`, e NUNCA por endpoint de execução direta —
 * exclusivamente pela etapa de operação `agent.execute`.
 *
 * Estas interfaces referenciam apenas os contratos serializáveis deste pacote; não
 * importam Anthropic, OpenAI, Bedrock ou Vertex.
 */

import type { JsonSchemaContract } from '../connectors/connector-keys';
import type { ModelGenerationRequest, ModelGenerationResult, AgentExecutionResult, AgentSecuritySignal } from './agent-execution-result.schema';
import type { AgentOutputValidationResult } from './agent-structured-output.schema';
import type { ModelMessage } from './agent-prompt.schema';
import type { ModelToolDefinition } from './agent-tool-policy.schema';
import type { AgentContextPolicy } from './agent-context-policy.schema';
import type { AgentEvaluationPolicy } from './agent-evaluation-policy.schema';

/**
 * Contexto de execução NÃO SECRETO passado ao provider (ARDEN-BE-008.3). Permite ao
 * provider comercial resolver a credencial tenant-scoped no cofre ANTES do transporte —
 * a credencial NUNCA trafega no `ModelGenerationRequest` nem no payload do provider.
 * Providers determinísticos (ex.: internal.test-model) ignoram o contexto.
 */
export interface ModelGenerationContext {
  organizationId: string;
  modelConfigurationId: string;
  /** Conexão que guarda a credencial no cofre (null quando o provider não exige). */
  credentialConnectionId: string | null;
  correlationId: string;
  /** Teto de duração efetivo da etapa (ms); 0 = sem teto de etapa. */
  deadlineMs?: number;
  /**
   * Marca uma chamada de SMOKE TEST controlado (ARDEN-BE-008.4). Só o comando de smoke
   * define isto; ESTABELECE a verificação da credencial e, por isso, não exige smoke prévio
   * (mas ainda exige ambiente não produtivo + organização allowlisted + confirmação).
   */
  smokeTest?: boolean;
}

/** Provider de modelo — infraestrutura substituível. */
export interface ModelProvider {
  generate(request: ModelGenerationRequest, context?: ModelGenerationContext): Promise<ModelGenerationResult>;
}

/** Resolve o provider concreto por chave+versão. */
export interface ModelProviderRegistry {
  get(providerKey: string, providerVersion: string): ModelProvider;
}

/** Entrada para montagem de contexto (tenant-scoped; filtrada por política). */
export interface AgentContextAssemblyInput {
  organizationId: string;
  contextPolicy: AgentContextPolicy;
  executionInput: unknown;
  correlationId: string;
}

/** Resultado da montagem de contexto (canais separados; sinais de segurança). */
export interface AgentContextAssemblyResult {
  systemInstructions: string;
  messages: ModelMessage[];
  tools: ModelToolDefinition[];
  securitySignals: AgentSecuritySignal[];
  contextBytes: number;
  estimatedInputTokens: number;
}

export interface AgentContextAssembler {
  assemble(input: AgentContextAssemblyInput): Promise<AgentContextAssemblyResult>;
}

/** Validação de saída estruturada. */
export interface AgentOutputValidationInput {
  schema: JsonSchemaContract;
  rawOutput: unknown;
  maximumOutputBytes: number;
}

export interface AgentOutputValidator {
  validate(input: AgentOutputValidationInput): Promise<AgentOutputValidationResult>;
}

/** Avaliação determinística (+ judge opcional advisory). */
export interface AgentEvaluationInput {
  policy: AgentEvaluationPolicy;
  acceptedOutput: unknown;
  evidenceReferenceIds: string[];
}

export interface AgentEvaluationResult {
  passed: boolean;
  failedCheckKeys: string[];
  advisoryNotes?: string[];
}

export interface AgentEvaluator {
  evaluate(input: AgentEvaluationInput): Promise<AgentEvaluationResult>;
}

/** Orquestra a execução de uma etapa de agente dentro de uma `ExecutionRun`. */
export interface AgentRuntimeExecutionInput {
  organizationId: string;
  agentDefinitionId: string;
  agentVersionId: string;
  executionInput: unknown;
  correlationId: string;
}

export interface AgentRuntime {
  execute(input: AgentRuntimeExecutionInput): Promise<AgentExecutionResult>;
}

// ── Tokens de DI (strings estáveis; sem provider registrado nesta fase) ─────────
export const MODEL_PROVIDER_REGISTRY = 'ARDEN_MODEL_PROVIDER_REGISTRY' as const;
export const AGENT_CONTEXT_ASSEMBLER = 'ARDEN_AGENT_CONTEXT_ASSEMBLER' as const;
export const AGENT_OUTPUT_VALIDATOR = 'ARDEN_AGENT_OUTPUT_VALIDATOR' as const;
export const AGENT_EVALUATOR = 'ARDEN_AGENT_EVALUATOR' as const;
export const AGENT_RUNTIME = 'ARDEN_AGENT_RUNTIME' as const;
