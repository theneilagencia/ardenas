/**
 * Arden.AS — API v1 · política de rede de conector (ARDEN-BE-006).
 *
 * CONTRATO da política de rede (allowlist + limites) usada pelo cliente HTTP seguro
 * (implementação em fase futura — aqui apenas o formato). Defaults de produção são
 * restritivos: só HTTPS, sem redirects, sem redes privadas/loopback/link-local.
 */

import { z } from 'zod';

export const connectorNetworkPolicy = z.object({
  /** Apenas `https` no contrato. `http` é decisão de política de desenvolvimento (runtime). */
  allowedProtocols: z.array(z.literal('https')).min(1),
  allowedHosts: z.array(z.string().min(1)).max(100),
  allowedPorts: z.array(z.number().int().min(1).max(65535)).max(20),
  allowedPathPrefixes: z.array(z.string()).max(100).optional(),
  allowRedirects: z.boolean(),
  maximumRedirects: z.number().int().min(0).max(10),
  allowPrivateNetworks: z.boolean(),
  allowLoopback: z.boolean(),
  allowLinkLocal: z.boolean(),
  maximumRequestBytes: z.number().int().min(0).max(52_428_800),
  maximumResponseBytes: z.number().int().min(0).max(52_428_800),
  timeoutMs: z.number().int().min(1).max(600_000),
});
export type ConnectorNetworkPolicy = z.infer<typeof connectorNetworkPolicy>;

/**
 * Defaults CONTRATUAIS de produção (§9 do plano). Restritivos por padrão. Servem de
 * base para `networkPolicyTemplate` do catálogo e para os testes de contrato.
 */
export const PRODUCTION_NETWORK_POLICY_DEFAULTS: ConnectorNetworkPolicy = {
  allowedProtocols: ['https'],
  allowedHosts: [],
  allowedPorts: [443],
  allowRedirects: false,
  maximumRedirects: 0,
  allowPrivateNetworks: false,
  allowLoopback: false,
  allowLinkLocal: false,
  maximumRequestBytes: 1_048_576,
  maximumResponseBytes: 5_242_880,
  timeoutMs: 15_000,
};
