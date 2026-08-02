/**
 * Arden.AS API — erros de invocação de provider (ARDEN-BE-007.3).
 * O runtime classifica estes erros determinísticos em códigos de API (MODEL_/AGENT_).
 */

export type ModelProviderErrorKind =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'PROVIDER_ERROR'
  | 'UNSUPPORTED_MODEL'
  | 'UNKNOWN';

export class ModelProviderInvocationError extends Error {
  constructor(
    readonly kind: ModelProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ModelProviderInvocationError';
  }
}
