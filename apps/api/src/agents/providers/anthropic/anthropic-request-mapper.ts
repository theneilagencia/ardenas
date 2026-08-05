/**
 * Arden.AS API — mapeamento request canônico → transporte Anthropic (ARDEN-BE-008.1/008.5).
 *
 * PURO. `ModelGenerationRequest` (canônico) → `AnthropicTransportRequest` (interno). NÃO mapeia
 * organizationId, credenciais, policies completas, audit ou segredo para o payload. Structured
 * output = tool forçada (input_schema = outputSchema). Tool calling real (008.5): as tools são
 * mapeadas por `AnthropicToolDefinitionMapper` (interseção server-side do 007.5) e a continuação
 * é montada preservando `tool_use_id` — o turno assistant `tool_use` é SINTETIZADO a partir da
 * mensagem canônica TOOL e o resultado vira bloco `tool_result`. Nenhum SDK; nenhuma chamada real.
 */

import type { ModelGenerationRequest, ModelMessage } from '@arden/contracts';
import { isAllowedAnthropicModelId } from '@arden/contracts';
import type {
  AnthropicTransportRequest,
  AnthropicTransportMessage,
  AnthropicTransportToolDefinition,
  AnthropicRequestContentBlock,
  AnthropicToolChoice,
} from './anthropic-transport.types';
import type { AnthropicToolNameCodec } from './anthropic-tool-name-codec';
import { AnthropicToolResultMapper, type AnthropicToolResultInput } from './anthropic-tool-result-mapper';

/** Nome da tool sintética que força a saída estruturada. */
export const ANTHROPIC_STRUCTURED_OUTPUT_TOOL = 'arden_structured_output' as const;

function flattenContent(m: ModelMessage): string {
  return m.content
    .map((c) => (c.type === 'TEXT' ? (c.text ?? '') : JSON.stringify(c.data ?? c.text ?? null)))
    .join('\n');
}

function mapRole(role: ModelMessage['role']): AnthropicTransportMessage['role'] {
  // Anthropic aceita só user/assistant; SYSTEM vai no campo `system`; TOOL → tratado à parte.
  return role === 'ASSISTANT' ? 'assistant' : 'user';
}

export interface AnthropicRequestMapperOptions {
  /** Parâmetros de geração da ModelConfiguration (não do request de execução). */
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  /** Definições de tool já mapeadas (008.5). Quando presente, habilita o ramo de tool calling. */
  toolDefinitions?: AnthropicTransportToolDefinition[];
  /** Codec de nomes per-request (para sintetizar o turno assistant tool_use na continuação). */
  toolCodec?: AnthropicToolNameCodec;
  /** Estratégia INTERNA de tool_choice (§13). Nunca controlada pelo request externo. */
  toolChoice?: 'AUTO' | 'NONE' | 'REQUIRED';
}

export class AnthropicRequestMapper {
  private readonly resultMapper = new AnthropicToolResultMapper();

  map(request: ModelGenerationRequest, opts: AnthropicRequestMapperOptions = {}): AnthropicTransportRequest {
    if (!isAllowedAnthropicModelId(request.modelId)) {
      throw new Error(`modelId não allowlisted para anthropic.direct: ${request.modelId}`);
    }

    // SYSTEM-role messages (se houver) são dobradas no system; nunca em `messages`.
    const systemExtra = request.messages.filter((m) => m.role === 'SYSTEM').map(flattenContent);
    const system = [request.systemInstructions, ...systemExtra].filter(Boolean).join('\n\n');

    const messages = this.mapMessages(request.messages, opts.toolCodec);

    const tools: AnthropicTransportToolDefinition[] = [...(opts.toolDefinitions ?? [])];
    const hasRealTools = tools.length > 0;

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

    // Structured output via tool forçada. Com tools reais presentes, NÃO é possível forçar —
    // usa AUTO e o modelo escolhe uma tool real (→ TOOL_CALL) ou a de structured output (→ STOP).
    if (request.outputSchema) {
      tools.push({ name: ANTHROPIC_STRUCTURED_OUTPUT_TOOL, description: 'Structured output', input_schema: request.outputSchema as Record<string, unknown> });
      out.tool_choice = hasRealTools ? { type: 'auto' } : { type: 'tool', name: ANTHROPIC_STRUCTURED_OUTPUT_TOOL };
    } else if (hasRealTools) {
      out.tool_choice = this.toolChoiceFor(opts.toolChoice, tools);
    }

    if (tools.length > 0) out.tools = tools;
    return out;
  }

  /** §13: estratégia interna de tool_choice; nunca nome arbitrário vindo do request. */
  private toolChoiceFor(strategy: 'AUTO' | 'NONE' | 'REQUIRED' | undefined, tools: AnthropicTransportToolDefinition[]): AnthropicToolChoice {
    switch (strategy) {
      case 'NONE':
        return { type: 'none' };
      case 'REQUIRED':
        // `any`: o modelo DEVE usar alguma tool (usado só em fixture controlada de teste).
        return { type: 'any' };
      case 'AUTO':
      default:
        return tools.length > 0 ? { type: 'auto' } : { type: 'none' };
    }
  }

  /**
   * Mapeia mensagens canônicas para o transporte. TOOL → sintetiza o turno assistant `tool_use`
   * (id = toolCallId, input mínimo) seguido do turno user `tool_result` (preserva tool_use_id).
   */
  private mapMessages(canonical: readonly ModelMessage[], codec?: AnthropicToolNameCodec): AnthropicTransportMessage[] {
    const out: AnthropicTransportMessage[] = [];
    for (const m of canonical) {
      if (m.role === 'SYSTEM') continue;
      if (m.role === 'TOOL' && m.toolCallId) {
        const data = this.toolResultData(m);
        const alias = typeof data.alias === 'string' ? data.alias : undefined;
        const providerName = (alias && codec?.nameFor(alias)) || alias || 'arden_tool';
        const status = typeof data.status === 'string' ? (data.status as AnthropicToolResultInput['status']) : 'SUCCEEDED';
        const resultBlock = this.resultMapper.map({ toolCallId: m.toolCallId, status, output: data });
        // Turno assistant sintetizado: input mínimo (o input bruto NÃO é repersistido — §19/§20).
        out.push({ role: 'assistant', content: [{ type: 'tool_use', id: m.toolCallId, name: providerName, input: {} }] });
        out.push({ role: 'user', content: [resultBlock] });
        continue;
      }
      out.push({ role: mapRole(m.role), content: flattenContent(m) });
    }
    return out;
  }

  private toolResultData(m: ModelMessage): Record<string, unknown> {
    const block = m.content.find((c) => c.type === 'TOOL_RESULT') ?? m.content[0];
    const data = block?.data;
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  }
}

export type { AnthropicRequestContentBlock };
