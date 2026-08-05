/**
 * Arden.AS — barrel dos contratos do provider Anthropic (ARDEN-BE-008.1).
 * Tipos ESPECÍFICOS do provider (borda). NÃO registrados no OpenAPI (registry.ts)
 * — não expostos como superfície HTTP genérica. CONTRACT_ONLY: não executável.
 */

export * from './anthropic-provider-keys';
export * from './anthropic-model-catalog.schema';
export * from './anthropic-rate-card.schema';
export * from './anthropic-credential.schema';
export * from './anthropic-connection.schema';
export * from './anthropic-model-configuration.schema';
export * from './anthropic-errors';
