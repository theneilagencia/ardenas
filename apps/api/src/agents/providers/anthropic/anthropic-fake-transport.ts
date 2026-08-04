/**
 * Arden.AS API — transporte FAKE do Anthropic (ARDEN-BE-008.3 §13).
 *
 * Determinístico, OFFLINE, sem SDK e sem rede. Usa os mesmos tipos internos de transporte.
 * Cobre os cenários canônicos (sucesso estruturado, inválido, reparável, max_tokens, erros
 * e incertezas). Registra o número de chamadas e o COMPRIMENTO da apiKey recebida (nunca o
 * valor). Suporta AbortSignal e uma fila de cenários (para retry).
 */

import { Injectable } from '@nestjs/common';
import type { AnthropicTransport, AnthropicTransportExecutionContext } from './anthropic-transport.port';
import { AnthropicTransportException } from './anthropic-transport.port';
import { ANTHROPIC_STRUCTURED_OUTPUT_TOOL } from './anthropic-request-mapper';
import type { AnthropicTransportRequest, AnthropicTransportResponse } from './anthropic-transport.types';

export type FakeAnthropicScenario =
  | 'structured_success'
  | 'structured_invalid'
  | 'structured_repairable'
  | 'max_tokens'
  | 'rate_limit'
  | 'authentication_error'
  | 'permission_error'
  | 'invalid_request'
  | 'not_found'
  | 'overloaded'
  | 'internal_error'
  | 'timeout_before_send'
  | 'timeout_after_send'
  | 'connection_reset'
  | 'malformed_response'
  | 'aborted';

const REPAIR_MARKER = '[arden:repair]';

/** Extrai o texto de um conteúdo de mensagem (string simples OU blocos de request). */
function messageText(content: import('./anthropic-transport.types').AnthropicTransportMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((b) => (b.type === 'text' ? b.text : b.type === 'tool_result' ? b.content : ''))
    .join('\n');
}

@Injectable()
export class FakeAnthropicTransport implements AnthropicTransport {
  private queue: FakeAnthropicScenario[] = [];
  private fallback: FakeAnthropicScenario = 'structured_success';

  /** Requisições recebidas (para asserts e contagem de chamadas). */
  readonly calls: AnthropicTransportRequest[] = [];
  /** COMPRIMENTO da última apiKey recebida — comprova recebimento SEM guardar o valor. */
  lastApiKeyLength = 0;
  /** Quantas vezes um AbortSignal já abortado foi observado. */
  abortedObserved = 0;

  /** Define o cenário padrão (usado quando a fila esvazia). */
  setDefault(scenario: FakeAnthropicScenario): void {
    this.fallback = scenario;
  }

  /** Enfileira cenários consumidos em ordem (ex.: ['rate_limit','structured_success']). */
  enqueue(...scenarios: FakeAnthropicScenario[]): void {
    this.queue.push(...scenarios);
  }

  reset(): void {
    this.queue = [];
    this.fallback = 'structured_success';
    this.calls.length = 0;
    this.lastApiKeyLength = 0;
    this.abortedObserved = 0;
  }

  async createMessage(
    request: AnthropicTransportRequest,
    context: AnthropicTransportExecutionContext,
  ): Promise<AnthropicTransportResponse> {
    this.calls.push(request);
    // Comprova recebimento da credencial sem imprimir/persistir o valor.
    this.lastApiKeyLength = context.apiKey.length;
    if (context.signal?.aborted) {
      this.abortedObserved += 1;
      throw new AnthropicTransportException({ providerErrorClass: 'APIUserAbortError', httpStatus: null }, 'Requisição cancelada.');
    }

    const scenario = this.queue.shift() ?? this.fallback;
    const repairing = request.messages.some((m) => messageText(m.content).includes(REPAIR_MARKER));
    return this.run(scenario, request, repairing);
  }

  private run(scenario: FakeAnthropicScenario, request: AnthropicTransportRequest, repairing: boolean): AnthropicTransportResponse {
    switch (scenario) {
      case 'structured_success':
        return this.structured(this.validOutput(request));
      case 'structured_repairable':
        return repairing ? this.structured(this.validOutput(request)) : this.structured({ __invalid: true });
      case 'structured_invalid':
        return this.structured({ __invalid: true });
      case 'max_tokens':
        return { id: 'msg_fake', stop_reason: 'max_tokens', content: [{ type: 'text', text: 'parcial' }], usage: { input_tokens: 40, output_tokens: 512 } };
      case 'rate_limit':
        throw new AnthropicTransportException({ providerErrorClass: 'RateLimitError', httpStatus: 429, retryAfterMs: 20 }, 'Rate limited.');
      case 'authentication_error':
        throw new AnthropicTransportException({ providerErrorClass: 'AuthenticationError', httpStatus: 401 }, 'Autenticação inválida.');
      case 'permission_error':
        throw new AnthropicTransportException({ providerErrorClass: 'PermissionDeniedError', httpStatus: 403 }, 'Permissão negada.');
      case 'invalid_request':
        throw new AnthropicTransportException({ providerErrorClass: 'BadRequestError', httpStatus: 400 }, 'Requisição inválida.');
      case 'not_found':
        throw new AnthropicTransportException({ providerErrorClass: 'NotFoundError', httpStatus: 404 }, 'Não encontrado.');
      case 'overloaded':
        throw new AnthropicTransportException({ providerErrorClass: 'InternalServerError', httpStatus: 529 }, 'Sobrecarregado.');
      case 'internal_error':
        throw new AnthropicTransportException({ providerErrorClass: 'InternalServerError', httpStatus: 500 }, 'Erro interno do provider.');
      case 'timeout_before_send':
        // Conexão nunca estabelecida → seguro retriar (não incerto).
        throw new AnthropicTransportException({ providerErrorClass: 'APIConnectionError', httpStatus: null, phase: 'BEFORE_SEND' }, 'Timeout antes do envio.');
      case 'timeout_after_send':
        // Requisição pode ter sido processada → INCERTO (não retria).
        throw new AnthropicTransportException({ providerErrorClass: 'APIConnectionTimeoutError', httpStatus: null, phase: 'AFTER_SEND' }, 'Timeout após envio.');
      case 'connection_reset':
        throw new AnthropicTransportException({ providerErrorClass: 'APIConnectionError', httpStatus: null, phase: 'AFTER_SEND' }, 'Conexão resetada após envio.');
      case 'malformed_response':
        throw new AnthropicTransportException({ providerErrorClass: 'MalformedResponse', httpStatus: null }, 'Resposta malformada.');
      case 'aborted':
        throw new AnthropicTransportException({ providerErrorClass: 'APIUserAbortError', httpStatus: null }, 'Cancelado.');
    }
  }

  private structured(input: unknown): AnthropicTransportResponse {
    return {
      id: 'msg_fake',
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'toolu_fake', name: ANTHROPIC_STRUCTURED_OUTPUT_TOOL, input }],
      usage: { input_tokens: 40, output_tokens: 24, cache_read_input_tokens: 8 },
    };
  }

  /** Produz um objeto minimamente válido para o outputSchema (schema walk raso; honra enum). */
  private validOutput(request: AnthropicTransportRequest): Record<string, unknown> {
    const schema = request.tools?.find((t) => t.name === ANTHROPIC_STRUCTURED_OUTPUT_TOOL)?.input_schema as
      | { properties?: Record<string, { type?: string; enum?: unknown[] }>; required?: string[] }
      | undefined;
    const out: Record<string, unknown> = {};
    const props = schema?.properties ?? {};
    for (const [key, def] of Object.entries(props)) {
      if (Array.isArray(def.enum) && def.enum.length > 0) out[key] = def.enum[0];
      else out[key] = def.type === 'number' || def.type === 'integer' ? 1 : def.type === 'boolean' ? true : `${key}-ok`;
    }
    return out;
  }
}
