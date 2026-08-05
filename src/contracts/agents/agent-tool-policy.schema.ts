/**
 * Arden.AS — API v1 · política de ferramentas do agente + contratos de tool call
 * (ARDEN-BE-007.1).
 *
 * O modelo PROPÕE tool calls por `alias`; o servidor VALIDA (alias allowlistado na
 * versão + existente na operação) e EXECUTA (reuso do `ExternalToolExecutor` de
 * 006.6). O modelo nunca vê `connectionId`, credencial, URL, headers, executor ou
 * `organizationToolBindingId`. `allowDestructive/Financial/SecurityCritical` são
 * `false` por default. A autoridade final permanece no BE-004.
 */

import { z } from 'zod';
import { jsonSchemaContract } from '../connectors/connector-keys';
import { agentToolRiskLevel, agentAuthorityClass, agentToolCallStatus } from './agent-keys';

const toolAlias = z.string().min(1).max(60);

// ── Política (pertence à AgentVersion) ──────────────────────────────────────────
export const agentToolPolicy = z
  .object({
    /** Aliases permitidos — devem existir na operação (validado no servidor). */
    allowedAliases: z.array(toolAlias).max(50),
    /** Teto de chamadas por alias (opcional). */
    maximumCallsPerAlias: z.record(z.number().int().min(0).max(100)).optional(),
    allowRead: z.boolean(),
    allowWrite: z.boolean(),
    allowDestructive: z.boolean(),
    allowFinancial: z.boolean(),
    allowSecurityCritical: z.boolean(),
    /** Classes que exigem autorização humana (reusa `ActionAuthorization`/approval). */
    requireAuthorizationFor: z.array(agentAuthorityClass).max(4),
  })
  .superRefine((policy, ctx) => {
    if (policy.maximumCallsPerAlias) {
      for (const alias of Object.keys(policy.maximumCallsPerAlias)) {
        if (!policy.allowedAliases.includes(alias)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['maximumCallsPerAlias', alias],
            message: `alias "${alias}" não está em allowedAliases.`,
          });
        }
      }
    }
  });
export type AgentToolPolicy = z.infer<typeof agentToolPolicy>;

/** Default seguro: nada perigoso liberado; write exige autorização. */
export const AGENT_TOOL_POLICY_SAFE_DEFAULT: z.input<typeof agentToolPolicy> = {
  allowedAliases: [],
  allowRead: true,
  allowWrite: false,
  allowDestructive: false,
  allowFinancial: false,
  allowSecurityCritical: false,
  requireAuthorizationFor: ['WRITE', 'DESTRUCTIVE', 'FINANCIAL', 'SECURITY_CRITICAL'],
};

// ── Definição de tool exposta ao MODELO (superfície mínima e segura) ────────────
/**
 * O que o modelo vê de uma ferramenta: apenas `alias`, descrição segura, schema de
 * input e risco. NUNCA `connectionId`, credencial, URL, headers, executor, binding id
 * ou segredos de provider.
 */
export const modelToolDefinition = z.object({
  alias: toolAlias,
  description: z.string().min(1).max(500),
  inputSchema: jsonSchemaContract,
  riskLevel: agentToolRiskLevel,
});
export type ModelToolDefinition = z.infer<typeof modelToolDefinition>;

// ── Tool call proposta pelo modelo ──────────────────────────────────────────────
export const modelToolCall = z.object({
  id: z.string().min(1).max(120),
  alias: toolAlias,
  input: z.unknown(),
});
export type ModelToolCall = z.infer<typeof modelToolCall>;

// ── Resultado interno da tool call (resolvido no servidor) ──────────────────────
export const agentToolCallResult = z.object({
  toolCallId: z.string().min(1).max(120),
  alias: toolAlias,
  status: agentToolCallStatus,
  output: z.unknown().optional(),
  errorCode: z.string().max(120).optional(),
  errorSummary: z.string().max(500).optional(),
  evidenceReferenceIds: z.array(z.string().min(1).max(128)).max(100),
});
export type AgentToolCallResult = z.infer<typeof agentToolCallResult>;
