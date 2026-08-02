/**
 * Arden.AS API — tipos do cliente HTTP seguro (ARDEN-BE-006.5).
 *
 * `SecureHttpPolicy` é a política EFETIVA de RUNTIME (superset do contrato). O
 * contrato `ConnectorNetworkPolicy` é https-only e restritivo; `http` só é permitido
 * por política de desenvolvimento EXPLÍCITA, nunca por default de produção.
 */

import type { ConnectorNetworkPolicy } from '@arden/contracts';

export type SecureHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface SecureHttpPolicy {
  allowedProtocols: Array<'http' | 'https'>;
  allowedHosts: string[];
  allowedPorts: number[];
  allowedPathPrefixes?: string[];
  allowRedirects: boolean;
  maximumRedirects: number;
  allowPrivateNetworks: boolean;
  allowLoopback: boolean;
  allowLinkLocal: boolean;
  maximumRequestBytes: number;
  maximumResponseBytes: number;
  timeoutMs: number;
}

/** Deriva a política efetiva do contrato (produção: só https, restritiva). */
export function fromConnectorNetworkPolicy(policy: ConnectorNetworkPolicy): SecureHttpPolicy {
  return { ...policy, allowedProtocols: [...policy.allowedProtocols] };
}

export interface SecureHttpRequest {
  url: string;
  method: SecureHttpMethod;
  headers?: Record<string, string>;
  /** Corpo já serializado (string). Sem streaming ilimitado nesta fase. */
  body?: string;
  /** Idempotency-Key opcional (repassada ao provedor quando aplicável). */
  idempotencyKey?: string;
}

export interface SecureHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** URL final efetivamente chamada (após redirects validados). */
  finalUrl: string;
}

export interface ConnectorExecutionContext {
  organizationId: string;
  correlationId: string;
  connectionId?: string;
  toolBindingId?: string;
}

export interface SecureHttpClient {
  execute(request: SecureHttpRequest, policy: SecureHttpPolicy, context: ConnectorExecutionContext): Promise<SecureHttpResponse>;
}

/** Token de injeção do cliente HTTP seguro. */
export const SECURE_HTTP_CLIENT = Symbol('SECURE_HTTP_CLIENT');
