/**
 * Arden.AS API — mapeamento de erro do Anthropic → código canônico (ARDEN-BE-008.1).
 * PURO. Usa a matriz VERIFIED dos contratos. Resultado incerto → UNKNOWN. Sem SDK.
 */

import { mapAnthropicErrorClass, type AnthropicErrorMapping } from '@arden/contracts';
import type { AnthropicTransportError } from './anthropic-transport.types';

export interface AnthropicMappedError extends AnthropicErrorMapping {
  retryAfterMs: number | null;
}

export class AnthropicErrorMapper {
  map(error: AnthropicTransportError): AnthropicMappedError {
    const base = mapAnthropicErrorClass(error.providerErrorClass);
    return { ...base, retryAfterMs: error.retryAfterMs ?? null };
  }
}
