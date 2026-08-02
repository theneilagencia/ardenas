/**
 * Arden.AS API — máquinas de estado de conectores (ARDEN-BE-006.3).
 *
 * Funções PURAS: definem TODAS as transições permitidas. Nenhuma mudança de estado
 * ocorre por PATCH genérico — toda transição passa por aqui, guardada por
 * `revision` no banco. Espelham os estados dos contratos (@arden/contracts).
 */

import type {
  ConnectionStatus,
  CredentialStatus,
  WebhookEndpointStatus,
  WebhookDeliveryStatus,
} from '@arden/contracts';

// ── Conexão ─────────────────────────────────────────────────────────────────────
export const CONNECTION_TERMINAL: ReadonlySet<ConnectionStatus> = new Set(['REVOKED']);
export const CONNECTION_TRANSITIONS: Readonly<Record<ConnectionStatus, readonly ConnectionStatus[]>> = {
  DRAFT: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['SUSPENDED', 'ERROR', 'REVOKED'],
  SUSPENDED: ['ACTIVE', 'REVOKED'],
  ERROR: ['ACTIVE', 'SUSPENDED', 'REVOKED'],
  REVOKED: [],
};
export function canTransitionConnection(from: ConnectionStatus, to: ConnectionStatus): boolean {
  return CONNECTION_TRANSITIONS[from]?.includes(to) ?? false;
}
export function isConnectionTerminal(status: ConnectionStatus): boolean {
  return CONNECTION_TERMINAL.has(status);
}

// ── Credencial ──────────────────────────────────────────────────────────────────
// Nenhum estado retorna a ACTIVE. PENDING prepara o ciclo do cofre (006.4).
export const CREDENTIAL_TERMINAL: ReadonlySet<CredentialStatus> = new Set(['REVOKED']);
export const CREDENTIAL_TRANSITIONS: Readonly<Record<CredentialStatus, readonly CredentialStatus[]>> = {
  PENDING: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['SUPERSEDED', 'REVOKED'],
  SUPERSEDED: ['REVOKED'],
  REVOKED: [],
};
export function canTransitionCredential(from: CredentialStatus, to: CredentialStatus): boolean {
  return CREDENTIAL_TRANSITIONS[from]?.includes(to) ?? false;
}
export function isCredentialTerminal(status: CredentialStatus): boolean {
  return CREDENTIAL_TERMINAL.has(status);
}

// ── Webhook endpoint ────────────────────────────────────────────────────────────
export const WEBHOOK_ENDPOINT_TERMINAL: ReadonlySet<WebhookEndpointStatus> = new Set(['REVOKED']);
export const WEBHOOK_ENDPOINT_TRANSITIONS: Readonly<Record<WebhookEndpointStatus, readonly WebhookEndpointStatus[]>> = {
  ACTIVE: ['SUSPENDED', 'REVOKED'],
  SUSPENDED: ['ACTIVE', 'REVOKED'],
  REVOKED: [],
};
export function canTransitionWebhookEndpoint(from: WebhookEndpointStatus, to: WebhookEndpointStatus): boolean {
  return WEBHOOK_ENDPOINT_TRANSITIONS[from]?.includes(to) ?? false;
}
export function isWebhookEndpointTerminal(status: WebhookEndpointStatus): boolean {
  return WEBHOOK_ENDPOINT_TERMINAL.has(status);
}

// ── Webhook delivery ────────────────────────────────────────────────────────────
export const WEBHOOK_DELIVERY_TERMINAL: ReadonlySet<WebhookDeliveryStatus> = new Set([
  'REJECTED',
  'REPLAYED',
  'PROCESSED',
  'FAILED',
]);
export const WEBHOOK_DELIVERY_TRANSITIONS: Readonly<Record<WebhookDeliveryStatus, readonly WebhookDeliveryStatus[]>> = {
  RECEIVED: ['ACCEPTED', 'REJECTED', 'REPLAYED'],
  ACCEPTED: ['PROCESSED', 'FAILED'],
  REJECTED: [],
  REPLAYED: [],
  PROCESSED: [],
  FAILED: [],
};
export function canTransitionWebhookDelivery(from: WebhookDeliveryStatus, to: WebhookDeliveryStatus): boolean {
  return WEBHOOK_DELIVERY_TRANSITIONS[from]?.includes(to) ?? false;
}
export function isWebhookDeliveryTerminal(status: WebhookDeliveryStatus): boolean {
  return WEBHOOK_DELIVERY_TERMINAL.has(status);
}
