/**
 * Arden.AS — API v1 · chaves e enums de conectores (ARDEN-BE-006).
 *
 * Fonte canônica das chaves ESTÁVEIS do catálogo: conectores de referência,
 * action keys externas e enums espelhados no futuro schema Prisma. Sem código
 * dinâmico: chaves são um catálogo fechado, validadas por enum (nunca texto livre).
 */

import { z } from 'zod';

// ── Conectores de referência (catálogo fechado) ────────────────────────────────
export const connectorKey = z.enum(['system.http', 'system.webhook', 'internal.test']);
export type ConnectorKey = z.infer<typeof connectorKey>;

/** Versão do conector (string estável, não vazia). */
export const connectorVersion = z.string().min(1).max(32);
export type ConnectorVersion = z.infer<typeof connectorVersion>;

/** Chave de ferramenta (não vazia; unicidade garantida no catálogo). */
export const toolKey = z.string().min(1).max(64);
export type ToolKey = z.infer<typeof toolKey>;

export const toolVersion = z.string().min(1).max(32);
export type ToolVersion = z.infer<typeof toolVersion>;

/**
 * Action keys EXTERNAS (ARDEN-BE-006). Namespace próprio, distinto dos executores
 * determinísticos internos do BE-005 (`system.noop`, `data.*`, …) — não altera a
 * taxonomia de execução existente. O worker (fase futura) resolve estas chaves para
 * o executor externo com DI; nunca há carregamento por nome livre.
 */
export const externalActionKey = z.enum([
  'external.http.request',
  'external.webhook.send',
  'connector.test.echo',
  'connector.test.failure',
  'connector.test.timeout',
  'connector.test.write',
  'connector.test.unknown',
  'connector.test.inject',
]);
export type ExternalActionKey = z.infer<typeof externalActionKey>;

// ── Enums de catálogo (espelham o futuro Prisma; MAIÚSCULAS) ────────────────────
export const connectorCategory = z.enum([
  'HTTP',
  'WEBHOOK',
  'DATABASE',
  'MESSAGING',
  'BUSINESS_SYSTEM',
  'INTERNAL_TEST',
]);
export type ConnectorCategory = z.infer<typeof connectorCategory>;

export const connectorStatus = z.enum(['ACTIVE', 'DEPRECATED', 'DISABLED']);
export type ConnectorStatus = z.infer<typeof connectorStatus>;

export const connectorToolRiskLevel = z.enum([
  'READ',
  'WRITE',
  'DESTRUCTIVE',
  'FINANCIAL',
  'SECURITY_CRITICAL',
]);
export type ConnectorToolRiskLevel = z.infer<typeof connectorToolRiskLevel>;

export const toolIdempotencyMode = z.enum(['NONE', 'OPTIONAL', 'REQUIRED', 'PROVIDER_NATIVE']);
export type ToolIdempotencyMode = z.infer<typeof toolIdempotencyMode>;

export const toolRetryMode = z.enum(['NEVER', 'SAFE', 'CONDITIONAL']);
export type ToolRetryMode = z.infer<typeof toolRetryMode>;

export const connectionStatus = z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'ERROR', 'REVOKED']);
export type ConnectionStatus = z.infer<typeof connectionStatus>;

export const connectionTestStatus = z.enum(['SUCCESS', 'FAILURE', 'NOT_TESTED']);
export type ConnectionTestStatus = z.infer<typeof connectionTestStatus>;

// `PENDING` (ARDEN-BE-006.3): a versão de credencial existe estruturalmente antes de
// o cofre (006.4) cifrar/ativar o segredo. Nenhum segredo é persistido em PENDING.
export const credentialStatus = z.enum(['PENDING', 'ACTIVE', 'SUPERSEDED', 'REVOKED']);
export type CredentialStatus = z.infer<typeof credentialStatus>;

export const webhookEndpointStatus = z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']);
export type WebhookEndpointStatus = z.infer<typeof webhookEndpointStatus>;

export const webhookSignatureScheme = z.enum(['HMAC_SHA256', 'STATIC_BEARER', 'NONE']);
export type WebhookSignatureScheme = z.infer<typeof webhookSignatureScheme>;

export const webhookDeliveryStatus = z.enum([
  'RECEIVED',
  'ACCEPTED',
  'REJECTED',
  'REPLAYED',
  'PROCESSED',
  'FAILED',
]);
export type WebhookDeliveryStatus = z.infer<typeof webhookDeliveryStatus>;

/**
 * Documento JSON Schema (configuração/credencial/input/output). Representação
 * SERIALIZÁVEL (objeto) armazenada no catálogo e projetada no banco/HTTP — nunca
 * `any`, nunca código. A validação em runtime dos valores contra este schema é uma
 * fase futura (ARDEN-BE-006.6).
 */
export const jsonSchemaContract = z.record(z.unknown());
export type JsonSchemaContract = z.infer<typeof jsonSchemaContract>;
