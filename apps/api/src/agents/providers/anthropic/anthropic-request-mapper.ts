/**
 * Arden.AS API — mapeamento request canônico → transporte Anthropic (ARDEN-BE-008.1).
 *
 * PURO. `ModelGenerationRequest` (canônico) → `AnthropicTransportRequest` (interno).
 * NÃO mapeia organizationId, credenciais, policies completas, audit ou segredo para o
 * payload. Structured output = tool forçada (input_schema = outputSchema). Nenhum SDK;
 * nenhuma chamada real. Rejeita modelId fora da allowlist.
 */

import type { ModelGenerationRequest, ModelMessage } from '@arden/contracts';
import { isAllowedAnthropicModelId } from '@arden/contracts';
import type {
  AnthropicTransportRequest,
  AnthropicTransportMessage,
  AnthropicTransportToolDefinition,
} from './anthropic-transport.types';

/** Nome da tool sintética que força a saída estruturada. */
export const ANTHROPIC_STRUCTURED_OUTPUT_TOOL = 'arden_structured_output' as const;

function flattenContent(m: ModelMessage): string {
  return m.content
    .map((c) => (c.type === 'TEXT' ? (c.text ?? '') : JSON.stringify(c.data ?? c.text ?? null)))
    .join('\n');
}

function mapRole(role: ModelMessage['role']): AnthropicTransportMessage['role'] {
  // Anthropic aceita só user/assistant; SYSTEM vai no campo `system`; TOOL → user.
  return role === 'ASSISTANT' ? 'assistant' : 'user';
}

export interface AnthropicRequestMapperOptions {
  /** Parâmetros de geração da ModelConfiguration (não do request de execução). */
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

export class AnthropicRequestMapper {
  map(request: ModelGenerationRequest, opts: AnthropicRequestMapperOptions = {}): AnthropicTransportRequest {
    if (!isAllowedAnthropicModelId(request.modelId)) {
      throw new Error(`modelId não allowlisted para anthropic.direct: ${request.modelId}`);
    }

    // SYSTEM-role messages (se houver) são dobradas no system; nunca em `messages`.
    const systemExtra = request.messages.filter((m) => m.role === 'SYSTEM').map(flattenContent);
    const system = [request.systemInstructions, ...systemExtra].filter(Boolean).join('\n\n');

    const messages: AnthropicTransportMessage[] = request.messages
      .filter((m) => m.role !== 'SYSTEM')
      .map((m) => ({ role: mapRole(m.role), content: flattenContent(m) }));

    const tools: AnthropicTransportToolDefinition[] = (request.tools ?? []).map((t) => ({
      name: t.alias,
      description: t.description,
      input_schema: t.inputSchema as Record<string, unknown>,
    }));

    const out: AnthropicTransportRequest = {
      model: request.modelId,
      system,
      messages,
      max_tokens: request.maximumOutputTokens,
      metadata: { correlationId: request.correlationId },
    };
    if (opts.temperature !== undefined) out.temperature = opts.temperature;
    if (opts.topP !== undefined) out.top_p = opts.topP;
    if (opts.stopSequences && opts.stopSequences.length > 0) out.stop_sequences = opts.stopSequences;

    // Structured output via tool forçada (mecanismo do primeiro slice).
    if (request.outputSchema) {
      tools.push({ name: ANTHROPIC_STRUCTURED_OUTPUT_TOOL, description: 'Structured output', input_schema: request.outputSchema as Record<string, unknown> });
      out.tool_choice = { type: 'tool', name: ANTHROPIC_STRUCTURED_OUTPUT_TOOL };
    }
    if (tools.length > 0) out.tools = tools;
    return out;
  }
}
