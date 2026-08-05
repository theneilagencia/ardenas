/**
 * Arden.AS API — mapeamento de resultado de tool → bloco Anthropic `tool_result` (ARDEN-BE-008.5
 * §22/§23/§24). PURO. O resultado canônico (já sanitizado/isolado pelo runtime 007.5) vira um
 * bloco `tool_result` que referencia o `tool_use_id` ORIGINAL. Defesa em profundidade na borda:
 * redação final de segredos + limite de tamanho. NUNCA é tratado como system instruction pelo
 * modelo — é dado não confiável. REQUIRES_APPROVAL nunca é enviado (a execução pausa antes).
 */

import type { AgentToolCallStatus } from '@arden/contracts';
import { sensitiveDataRedactor } from '../../../common/redaction/sensitive-data-redactor';
import type { AnthropicRequestContentBlock } from './anthropic-transport.types';
import { AnthropicToolMappingError } from './anthropic-tool-name-codec';

const MAX_RESULT_CONTENT_CHARS = 8_000;

export interface AnthropicToolResultInput {
  toolCallId: string;
  status: AgentToolCallStatus;
  /** Saída sanitizada (SUCCEEDED). */
  output?: unknown;
  errorCode?: string;
  errorSummary?: string;
}

export class AnthropicToolResultMapper {
  map(result: AnthropicToolResultInput): Extract<AnthropicRequestContentBlock, { type: 'tool_result' }> {
    const toolUseId = result.toolCallId;
    switch (result.status) {
      case 'SUCCEEDED':
        return { type: 'tool_result', tool_use_id: toolUseId, content: this.encode(result.output), is_error: false };
      case 'FAILED':
        return { type: 'tool_result', tool_use_id: toolUseId, content: this.safeError(result.errorCode ?? 'TOOL_FAILED', result.errorSummary), is_error: true };
      case 'DENIED':
        // Mensagem tipada mínima; sem revelar detalhes da política.
        return { type: 'tool_result', tool_use_id: toolUseId, content: 'Tool call denied by policy.', is_error: true };
      case 'UNKNOWN':
        // Resultado incerto: nunca sucesso; sem repetir automaticamente.
        return { type: 'tool_result', tool_use_id: toolUseId, content: 'Tool result uncertain.', is_error: true };
      case 'REQUIRES_APPROVAL':
      default:
        throw new AnthropicToolMappingError('AGENT_TOOL_NOT_ALLOWED', 'Resultado REQUIRES_APPROVAL não pode ser enviado ao modelo.');
    }
  }

  /** Serializa a saída sanitizada com redação final e clamp de tamanho. */
  private encode(output: unknown): string {
    const redacted = sensitiveDataRedactor.redactObject(output ?? null);
    const serialized = typeof redacted === 'string' ? redacted : JSON.stringify(redacted ?? null);
    return serialized.length > MAX_RESULT_CONTENT_CHARS ? serialized.slice(0, MAX_RESULT_CONTENT_CHARS) : serialized;
  }

  private safeError(code: string, summary?: string): string {
    const safe = summary && !/secret|token|password|key=/i.test(summary) ? summary : undefined;
    return JSON.stringify({ error: true, code, message: safe ?? 'Tool execution failed.' });
  }
}
