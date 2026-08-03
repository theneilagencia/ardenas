/**
 * Arden.AS API — tipos de transporte INTERNOS do Anthropic (ARDEN-BE-008.1).
 *
 * Tipos PRÓPRIOS do Arden que espelham o formato Messages da Anthropic (VERIFIED do
 * SDK oficial v0.115.0), MAS não importam nem vazam nenhum tipo do SDK. O adapter
 * fala apenas estes tipos + os canônicos. Nenhuma chamada real; nenhum SDK; a
 * implementação de transporte concreta (HTTP/SDK) só chega no 008.3.
 */

/** Papel de mensagem no formato Messages (subset seguro). */
export type AnthropicRole = 'user' | 'assistant';

export interface AnthropicTransportMessage {
  role: AnthropicRole;
  content: string;
}

/** Definição de tool no formato Anthropic (só schema/descrição — nunca segredo). */
export interface AnthropicTransportToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type AnthropicToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string }
  | { type: 'none' };

/** Request de transporte (interno). Base URL/credencial NÃO ficam aqui. */
export interface AnthropicTransportRequest {
  model: string;
  system: string;
  messages: AnthropicTransportMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  tools?: AnthropicTransportToolDefinition[];
  tool_choice?: AnthropicToolChoice;
  /** Metadados seguros (nunca organizationId/segredo/policy). */
  metadata?: { correlationId: string };
}

/** Bloco de conteúdo da resposta (subset VERIFIED: text/tool_use). */
export type AnthropicTransportContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

/** Uso reportado pela Anthropic (nomes VERIFIED). */
export interface AnthropicTransportUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** StopReason VERIFIED do SDK. */
export type AnthropicStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use'
  | 'pause_turn'
  | 'refusal'
  | 'model_context_window_exceeded';

/** Resposta de transporte (interna). `id` bruto fica interno (persistido só como hash). */
export interface AnthropicTransportResponse {
  id: string;
  stop_reason: AnthropicStopReason | null;
  content: AnthropicTransportContentBlock[];
  usage: AnthropicTransportUsage;
}

/** Erro de transporte (classe do SDK + status), sem vazar objeto do SDK. */
export interface AnthropicTransportError {
  providerErrorClass: string;
  httpStatus: number | null;
  /** Retry-After em ms, quando fornecido pelo provider. */
  retryAfterMs?: number | null;
  /**
   * Fase da falha (ARDEN-BE-008.3): `BEFORE_SEND` = a requisição comprovadamente NÃO
   * foi enviada (conexão nunca estabelecida) → seguro retriar (não incerto). `AFTER_SEND`
   * ou ausente = a requisição pode ter sido processada → INCERTO (não retria). O SDK real
   * não distingue com segurança, então reporta `AFTER_SEND` (conservador).
   */
  phase?: 'BEFORE_SEND' | 'AFTER_SEND';
}
