/**
 * Arden.AS API — validação server-side de tool call proposta pelo modelo (ARDEN-BE-007.5).
 *
 * PURO. NÃO confia na validação do provider. Valida id/alias/allowlist/schema/tamanho/
 * limites e REJEITA propriedades de controle (tenant, connectionId, credential, endpoint,
 * URL absoluta, authorization…) e tipos não suportados/circular. Erros tipados e seguros.
 */

import { Injectable } from '@nestjs/common';
import type { AgentExecutionPolicy, AgentToolPolicy, ModelToolCall } from '@arden/contracts';
import { validateAgainstSchema } from '../../../connectors/tools/json-schema-validator';
import { normalizeValue } from '../context/agent-context-normalizer';
import type {
  AgentToolCallHistoryEntry,
  AgentToolCallValidationResult,
  ResolvedAgentToolDefinition,
} from './agent-tool.types';

/** Chaves de controle proibidas no input da tool (o servidor decide, não o modelo). */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'organizationid', 'organization_id', 'tenant', 'tenantid', 'tenant_id',
  'connectionid', 'connection_id', 'credential', 'credentials', 'credentialid',
  'actionauthorization', 'actionauthorizationid', 'authorization', 'authorizationid',
  'endpoint', 'endpointurl', 'url', 'host', 'headers', 'header',
  'networkpolicy', 'idempotencymode', 'idempotencykey', 'retrymode', 'timeoutms',
  'executor', 'connectorkey', 'providerconfig',
]);

/** Teto de bytes do input de UMA tool call. */
const MAX_TOOL_INPUT_BYTES = 32_768;

function scanForbidden(value: unknown, depth = 0): { forbiddenKey?: string; absoluteUrl?: boolean } {
  if (depth > 64) return {};
  if (typeof value === 'string') {
    return /^https?:\/\//i.test(value.trim()) ? { absoluteUrl: true } : {};
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const r = scanForbidden(item, depth + 1);
      if (r.forbiddenKey || r.absoluteUrl) return r;
    }
    return {};
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) return { forbiddenKey: k };
      const r = scanForbidden(v, depth + 1);
      if (r.forbiddenKey || r.absoluteUrl) return r;
    }
  }
  return {};
}

@Injectable()
export class AgentToolCallValidator {
  validate(input: {
    toolCall: ModelToolCall;
    resolvedTool: ResolvedAgentToolDefinition | null;
    executionPolicy: AgentExecutionPolicy;
    toolPolicy: AgentToolPolicy;
    priorCalls: AgentToolCallHistoryEntry[];
  }): AgentToolCallValidationResult {
    const { toolCall, resolvedTool, executionPolicy, toolPolicy, priorCalls } = input;

    // id presente e limitado (defensivo; o contrato também restringe).
    if (typeof toolCall.id !== 'string' || toolCall.id.length === 0 || toolCall.id.length > 120) {
      return { valid: false, code: 'AGENT_TOOL_CALL_INVALID', reason: 'toolCall.id ausente ou inválido.' };
    }
    // alias allowlistado + resolvido (existe/binding habilitado/tenant).
    if (typeof toolCall.alias !== 'string' || !toolPolicy.allowedAliases.includes(toolCall.alias) || !resolvedTool) {
      return { valid: false, code: 'AGENT_TOOL_NOT_ALLOWED', reason: 'Alias não permitido pela política do agente ou indisponível.' };
    }

    // Limite total de tool calls e por alias (a chamada excedente NÃO executa).
    if (priorCalls.length >= executionPolicy.maximumToolCalls) {
      return { valid: false, code: 'AGENT_TOOL_CALL_LIMIT_EXCEEDED', reason: 'Teto de tool calls atingido.' };
    }
    const perAlias = toolPolicy.maximumCallsPerAlias?.[toolCall.alias];
    if (typeof perAlias === 'number' && priorCalls.filter((c) => c.alias === toolCall.alias).length >= perAlias) {
      return { valid: false, code: 'AGENT_TOOL_CALL_LIMIT_EXCEEDED', reason: 'Teto de chamadas por alias atingido.' };
    }

    // Input: serializável, sem tipos perigosos/circular, dentro do teto de bytes.
    const normalized = normalizeValue(toolCall.input ?? {});
    if (!normalized.ok) {
      return { valid: false, code: 'AGENT_TOOL_CALL_INVALID', reason: `Input não serializável (${normalized.reason}).` };
    }
    const bytes = Buffer.byteLength(JSON.stringify(normalized.value ?? {}), 'utf8');
    if (bytes > MAX_TOOL_INPUT_BYTES) {
      return { valid: false, code: 'AGENT_TOOL_CALL_INVALID', reason: 'Input da tool excede o tamanho máximo.' };
    }

    // Propriedades de controle / URL absoluta proibidas (o servidor decide destino/auth).
    const scan = scanForbidden(normalized.value);
    if (scan.forbiddenKey) {
      return { valid: false, code: 'AGENT_TOOL_CALL_INVALID', reason: `Propriedade de controle proibida no input: ${scan.forbiddenKey}.` };
    }
    if (scan.absoluteUrl) {
      return { valid: false, code: 'AGENT_TOOL_CALL_INVALID', reason: 'URL absoluta não permitida no input da tool.' };
    }

    // Schema da ferramenta (input LÓGICO da tool).
    const violations = validateAgainstSchema(normalized.value, resolvedTool.inputSchema);
    if (violations.length > 0) {
      return { valid: false, code: 'AGENT_TOOL_CALL_INVALID', reason: 'Input não valida contra o schema da ferramenta.' };
    }

    return { valid: true };
  }
}
