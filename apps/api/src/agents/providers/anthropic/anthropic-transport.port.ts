/**
 * Arden.AS API — porta de transporte Anthropic (ARDEN-BE-008.3).
 *
 * Interface INTERNA entre o AnthropicModelProvider e o transporte concreto (SDK real ou
 * fake). O SDK só existe atrás desta porta. A credencial (apiKey) chega apenas no contexto
 * de execução, em memória, e NUNCA é persistida/retornada/logada. Nenhum tipo do SDK cruza
 * esta interface.
 */

import type { AnthropicTransportRequest, AnthropicTransportResponse, AnthropicTransportError } from './anthropic-transport.types';

/** Token de DI do transporte (permite override por transporte fake em testes). */
export const ANTHROPIC_TRANSPORT = 'ARDEN_ANTHROPIC_TRANSPORT' as const;

/** Contexto de execução do transporte — plaintext apenas em memória. */
export interface AnthropicTransportExecutionContext {
  /** API key resolvida do cofre (memória). NUNCA persistida/retornada/logada. */
  apiKey: string;
  timeoutMs: number;
  /** Retries do SDK (mantido 0 — a política de retry é do adapter). */
  maximumRetries: number;
  signal?: AbortSignal;
  correlationId: string;
}

export interface AnthropicTransport {
  createMessage(
    request: AnthropicTransportRequest,
    context: AnthropicTransportExecutionContext,
  ): Promise<AnthropicTransportResponse>;
}

/**
 * Exceção de transporte — carrega a classificação `AnthropicTransportError` (classe do SDK
 * + status + fase), sem vazar o objeto do SDK. A mensagem é sempre segura (sem body/segredo).
 */
export class AnthropicTransportException extends Error {
  constructor(
    readonly transportError: AnthropicTransportError,
    message = 'Falha de transporte do provider.',
  ) {
    super(message);
    this.name = 'AnthropicTransportException';
  }
}
