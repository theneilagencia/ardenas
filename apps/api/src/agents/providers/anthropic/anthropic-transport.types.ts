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

/**
 * Bloco de conteúdo de REQUEST (ARDEN-BE-008.5). Espelha o protocolo Anthropic de tool use:
 * `text`, `tool_use` (turno assistant sintetizado), `tool_result` (turno user de continuação).
 * NUNCA carrega segredo/credencial. O `tool_use` sintetizado usa input mínimo (o input bruto
 * do modelo não é repersistido — §19/§20); serve só para casar `tool_use_id` na continuação.
 */
export type AnthropicRequestContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface AnthropicTransportMessage {
  role: AnthropicRole;
  /** String simples (texto) OU blocos (tool_use/tool_result) para turns com ferramentas. */
  content: string | AnthropicRequestContentBlock[];
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
