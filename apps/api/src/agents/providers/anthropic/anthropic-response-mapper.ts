/**
 * Arden.AS API — mapeamento transporte Anthropic → resultado canônico (ARDEN-BE-008.1).
 *
 * PURO. `AnthropicTransportResponse` → `ModelGenerationResult`. StopReason VERIFIED →
 * `finishReason` canônico. Usage mapeado só do que a Anthropic reporta (ausente ≠ 0
 * medido). `id` bruto NÃO é exposto — o runtime persiste só o hash. Structured output
 * vem da tool sintética forçada. Nenhum SDK; nenhuma chamada real.
 */

import type { ModelGenerationResult, ModelToolCall } from '@arden/contracts';
import { ANTHROPIC_PROVIDER_KEY } from '@arden/contracts';
import type { AnthropicTransportResponse, AnthropicStopReason } from './anthropic-transport.types';
import { ANTHROPIC_STRUCTURED_OUTPUT_TOOL } from './anthropic-request-mapper';

type CanonicalFinish = ModelGenerationResult['finishReason'];

/** Tabela VERIFIED StopReason → finishReason canônico. */
export function mapAnthropicStopReason(stop: AnthropicStopReason | null): CanonicalFinish {
  switch (stop) {
    case 'end_turn':
    case 'stop_sequence':
    case 'pause_turn':
      return 'STOP';
    case 'max_tokens':
    case 'model_context_window_exceeded':
      return 'MAX_TOKENS';
    case 'tool_use':
      return 'TOOL_CALL';
    case 'refusal':
      return 'CONTENT_FILTER';
    default:
      return 'ERROR';
  }
}

export class AnthropicResponseMapper {
  map(response: AnthropicTransportResponse, modelId: string): ModelGenerationResult {
    let text: string | undefined;
    let structuredOutput: unknown;
    const toolCalls: ModelToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text = (text ? `${text}\n` : '') + block.text;
      } else if (block.type === 'tool_use') {
        if (block.name === ANTHROPIC_STRUCTURED_OUTPUT_TOOL) {
          structuredOutput = block.input;
        } else {
          toolCalls.push({ id: block.id, alias: block.name, input: block.input });
        }
      }
    }

    // Structured output via tool sintética forçada: `stop_reason=tool_use` significa
    // "saída estruturada completa", NÃO uma tool call de execução. Nesse caso o finish é
    // STOP (sem tools reais) — não roteia para o pipeline de tools do runtime (008.3).
    let finishReason = mapAnthropicStopReason(response.stop_reason);
    if (structuredOutput !== undefined && toolCalls.length === 0 && finishReason === 'TOOL_CALL') {
      finishReason = 'STOP';
    }

    const u = response.usage;
    return {
      providerRequestId: response.id, // interno; runtime persiste apenas hash.
      finishReason,
      text,
      structuredOutput,
      toolCalls,
      usage: {
        providerKey: ANTHROPIC_PROVIDER_KEY,
        modelId,
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        // cache_read → cachedInputTokens. cache_creation (WRITE) NÃO é dobrado aqui
        // (sem campo canônico) — cobrado via rate card de cache-write. Ver docs.
        cachedInputTokens: u.cache_read_input_tokens ?? undefined,
        toolCallCount: toolCalls.length,
        modelCallCount: 1,
        durationMs: 0, // medido pelo runtime, não pelo provider.
      },
    };
  }
}
