/**
 * Arden.AS — taxonomia de erros do Anthropic → códigos canônicos (ARDEN-BE-008.1).
 *
 * Mapeia as classes de erro VERIFIED do SDK oficial (v0.115.0) para os códigos
 * canônicos JÁ existentes do BE-007 (sem novos códigos → OpenAPI sem diff). Resultado
 * incerto → UNKNOWN (nunca sucesso). Nenhuma chamada real; tabela pura.
 */

/** Códigos canônicos reutilizados (nenhum novo código criado nesta fase). */
export type AnthropicMappedErrorCode =
  | 'MODEL_PROVIDER_ERROR'
  | 'MODEL_RATE_LIMITED'
  | 'MODEL_CONTENT_FILTERED'
  | 'MODEL_RESULT_UNKNOWN'
  | 'AGENT_TIMEOUT';

export interface AnthropicErrorMapping {
  /** Nome da classe de erro do SDK oficial (VERIFIED). */
  providerErrorClass: string;
  httpStatus: number | null;
  ardenCode: AnthropicMappedErrorCode;
  retryable: boolean;
  /** Verdadeiro quando o resultado é semanticamente incerto (não vira sucesso). */
  unknown: boolean;
  /** Seguro para expor ao usuário final (sem detalhe interno do provider). */
  public: boolean;
}

/**
 * Matriz de mapeamento. HTTP 4xx de validação/permissão NÃO é retryable; 429/5xx/
 * conexão são retryable com backoff; abort não retria; resposta malformada → UNKNOWN.
 */
export const ANTHROPIC_ERROR_MATRIX: readonly AnthropicErrorMapping[] = Object.freeze([
  { providerErrorClass: 'AuthenticationError', httpStatus: 401, ardenCode: 'MODEL_PROVIDER_ERROR', retryable: false, unknown: false, public: false },
  { providerErrorClass: 'PermissionDeniedError', httpStatus: 403, ardenCode: 'MODEL_PROVIDER_ERROR', retryable: false, unknown: false, public: false },
  { providerErrorClass: 'BadRequestError', httpStatus: 400, ardenCode: 'MODEL_PROVIDER_ERROR', retryable: false, unknown: false, public: false },
  { providerErrorClass: 'NotFoundError', httpStatus: 404, ardenCode: 'MODEL_PROVIDER_ERROR', retryable: false, unknown: false, public: false },
  { providerErrorClass: 'ConflictError', httpStatus: 409, ardenCode: 'MODEL_PROVIDER_ERROR', retryable: false, unknown: false, public: false },
  { providerErrorClass: 'UnprocessableEntityError', httpStatus: 422, ardenCode: 'MODEL_PROVIDER_ERROR', retryable: false, unknown: false, public: false },
  { providerErrorClass: 'RateLimitError', httpStatus: 429, ardenCode: 'MODEL_RATE_LIMITED', retryable: true, unknown: false, public: true },
  { providerErrorClass: 'InternalServerError', httpStatus: 500, ardenCode: 'MODEL_PROVIDER_ERROR', retryable: true, unknown: false, public: false },
  { providerErrorClass: 'APIConnectionTimeoutError', httpStatus: null, ardenCode: 'AGENT_TIMEOUT', retryable: true, unknown: true, public: true },
  { providerErrorClass: 'APIConnectionError', httpStatus: null, ardenCode: 'MODEL_PROVIDER_ERROR', retryable: true, unknown: true, public: false },
  { providerErrorClass: 'APIUserAbortError', httpStatus: null, ardenCode: 'MODEL_PROVIDER_ERROR', retryable: false, unknown: false, public: false },
  { providerErrorClass: 'MalformedResponse', httpStatus: null, ardenCode: 'MODEL_RESULT_UNKNOWN', retryable: false, unknown: true, public: false },
]);

/** Content filter (finishReason refusal/content) → filtro tipado. Mapeado no response-mapper. */
export const ANTHROPIC_CONTENT_FILTER_CODE: AnthropicMappedErrorCode = 'MODEL_CONTENT_FILTERED';

export function mapAnthropicErrorClass(providerErrorClass: string): AnthropicErrorMapping {
  return (
    ANTHROPIC_ERROR_MATRIX.find((m) => m.providerErrorClass === providerErrorClass) ?? {
      providerErrorClass,
      httpStatus: null,
      ardenCode: 'MODEL_PROVIDER_ERROR',
      retryable: false,
      unknown: true,
      public: false,
    }
  );
}
