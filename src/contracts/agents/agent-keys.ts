/**
 * Arden.AS — API v1 · chaves e enums do runtime de agentes (ARDEN-BE-007.1).
 *
 * Fonte canônica das chaves ESTÁVEIS do domínio de agentes: status, capabilities de
 * provider, papéis de mensagem, finish reasons, risco de tool, status de tool call,
 * status de resultado, sinais de segurança e a action key de execução. Catálogo
 * FECHADO — validado por enum (nunca texto livre), sem código dinâmico e sem SDK.
 *
 * NENHUMA chave aqui carrega segredo, URL, classe executora ou objeto de SDK. A
 * relação canônica é: OperationVersion → OperationStep → actionKey `agent.execute`
 * → AgentVersion publicada. Não existe execução direta de agente/modelo.
 */

import { z } from 'zod';

// ── Ciclo de vida ───────────────────────────────────────────────────────────────
/** Status do agente. `REVOKED` é terminal. */
export const agentStatus = z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'REVOKED']);
export type AgentStatus = z.infer<typeof agentStatus>;

/** Status de uma versão de agente. Publicada é imutável; `RETIRED` não volta. */
export const agentVersionStatus = z.enum(['DRAFT', 'PUBLISHED', 'RETIRED']);
export type AgentVersionStatus = z.infer<typeof agentVersionStatus>;

/** Status de uma configuração de modelo. `REVOKED` é terminal. */
export const modelConfigurationStatus = z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'REVOKED']);
export type ModelConfigurationStatus = z.infer<typeof modelConfigurationStatus>;

// ── Provider de modelo (infraestrutura substituível) ────────────────────────────
/** Chave estável do provider (catálogo fechado nesta fase). */
export const modelProviderKey = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, {
  message: 'providerKey deve ser um slug estável (ex.: internal.test-model).',
});
export type ModelProviderKey = z.infer<typeof modelProviderKey>;

export const modelProviderVersion = z.string().min(1).max(32);
export type ModelProviderVersion = z.infer<typeof modelProviderVersion>;

export const modelProviderStatus = z.enum(['ACTIVE', 'DEPRECATED', 'DISABLED']);
export type ModelProviderStatus = z.infer<typeof modelProviderStatus>;

/** Capacidades declaradas pelo provider (catálogo fechado). */
export const modelProviderCapability = z.enum([
  'STRUCTURED_OUTPUT',
  'TOOL_CALLING',
  'STREAMING',
  'VISION',
  'PROMPT_CACHING',
]);
export type ModelProviderCapability = z.infer<typeof modelProviderCapability>;

/** Identificador do modelo dentro do provider (não vem livre do request de execução). */
export const modelId = z.string().min(1).max(200);
export type ModelId = z.infer<typeof modelId>;

// ── Mensagens e geração ─────────────────────────────────────────────────────────
/** Papéis de mensagem. SYSTEM nunca vem do input externo; TOOL só de execução server-side. */
export const modelMessageRole = z.enum(['SYSTEM', 'USER', 'ASSISTANT', 'TOOL']);
export type ModelMessageRole = z.infer<typeof modelMessageRole>;

/** Tipo de conteúdo permitido. Sem HTML executável, sem anexos nesta fase. */
export const modelMessageContentType = z.enum(['TEXT', 'JSON', 'TOOL_RESULT']);
export type ModelMessageContentType = z.infer<typeof modelMessageContentType>;

/** Razão de término da geração do modelo. */
export const modelFinishReason = z.enum(['STOP', 'TOOL_CALL', 'MAX_TOKENS', 'CONTENT_FILTER', 'ERROR']);
export type ModelFinishReason = z.infer<typeof modelFinishReason>;

// ── Ferramentas (o modelo propõe; o servidor valida e executa) ──────────────────
/** Risco de uma ferramenta exposta ao modelo (espelha `connectorToolRiskLevel`). */
export const agentToolRiskLevel = z.enum([
  'READ',
  'WRITE',
  'DESTRUCTIVE',
  'FINANCIAL',
  'SECURITY_CRITICAL',
]);
export type AgentToolRiskLevel = z.infer<typeof agentToolRiskLevel>;

/** Classes de autoridade que podem exigir autorização humana (subconjunto do risco). */
export const agentAuthorityClass = z.enum(['WRITE', 'DESTRUCTIVE', 'FINANCIAL', 'SECURITY_CRITICAL']);
export type AgentAuthorityClass = z.infer<typeof agentAuthorityClass>;

/** Status de uma tool call resolvida pelo servidor. `UNKNOWN` nunca vira sucesso. */
export const agentToolCallStatus = z.enum([
  'SUCCEEDED',
  'FAILED',
  'DENIED',
  'REQUIRES_APPROVAL',
  'UNKNOWN',
]);
export type AgentToolCallStatus = z.infer<typeof agentToolCallStatus>;

// ── Resultado da execução do agente ─────────────────────────────────────────────
/** Status final. `SUCCEEDED` exige output válido; `UNKNOWN` nunca vira sucesso. */
export const agentExecutionStatus = z.enum([
  'SUCCEEDED',
  'FAILED',
  'SUSPENDED',
  'REQUIRES_APPROVAL',
  'UNKNOWN',
]);
export type AgentExecutionStatus = z.infer<typeof agentExecutionStatus>;

/** Comportamento ao atingir um limite (execução/custo). */
export const agentLimitBehavior = z.enum(['FAIL', 'SUSPEND', 'REQUIRE_APPROVAL']);
export type AgentLimitBehavior = z.infer<typeof agentLimitBehavior>;

/** Comportamento de timeout / resultado desconhecido (subconjunto). */
export const agentTimeoutBehavior = z.enum(['FAIL', 'SUSPEND']);
export type AgentTimeoutBehavior = z.infer<typeof agentTimeoutBehavior>;

// ── Avaliação ───────────────────────────────────────────────────────────────────
/** Chaves canônicas de verificações determinísticas (catálogo fechado; sem código). */
export const agentDeterministicCheckKey = z.enum([
  'output.schema_valid',
  'output.required_paths_present',
  'output.forbidden_paths_absent',
  'output.completion_criteria_met',
  'output.evidence_referenced',
]);
export type AgentDeterministicCheckKey = z.infer<typeof agentDeterministicCheckKey>;

// ── Sinais de segurança (prompt injection) — contrato e evidência futura ────────
export const agentSecuritySignalCode = z.enum([
  'PROMPT_OVERRIDE_ATTEMPT',
  'SECRET_EXFILTRATION_ATTEMPT',
  'UNAUTHORIZED_TOOL_REQUEST',
  'TENANT_BOUNDARY_ATTEMPT',
  'SYSTEM_INSTRUCTION_DISCLOSURE_ATTEMPT',
  'UNTRUSTED_CONTENT_INSTRUCTION',
]);
export type AgentSecuritySignalCode = z.infer<typeof agentSecuritySignalCode>;

export const agentSecuritySignalSeverity = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type AgentSecuritySignalSeverity = z.infer<typeof agentSecuritySignalSeverity>;

export const agentSecuritySignalSource = z.enum([
  'EXECUTION_INPUT',
  'DOCUMENT',
  'TOOL_RESULT',
  'WEBHOOK',
  'MODEL_OUTPUT',
]);
export type AgentSecuritySignalSource = z.infer<typeof agentSecuritySignalSource>;

// ── Action key de execução (única nesta fase) ───────────────────────────────────
/**
 * Action key do executor de agente. ÚNICA adicionada nesta fase. Roteia (fase futura)
 * para o `AgentStepExecutor` via DI no `StepExecutorRegistry` — nunca por classe vinda
 * do banco. NÃO existe `model.generate`, `model.chat`, `agent.run` nem `agent.evaluate`
 * (avaliação ocorre DENTRO de `agent.execute` no primeiro vertical slice).
 */
export const AGENT_EXECUTE_ACTION_KEY = 'agent.execute' as const;

// Nota: a lista `AGENT_EXECUTOR_ACTION_KEYS` e o guard `isAgentExecutorActionKey`
// canônicos (tipados por `ExecutorActionKey`) vivem em `../executions` — junto do
// enum `executorActionKey` do motor de execução (BE-005). Não duplicar aqui.
