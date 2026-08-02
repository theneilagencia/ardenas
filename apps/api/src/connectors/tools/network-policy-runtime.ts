/**
 * Arden.AS API — política de rede efetiva de RUNTIME para execução (ARDEN-BE-006.6).
 *
 * Deriva a `SecureHttpPolicy` (superset de runtime) a partir das fontes declarativas
 * (template do conector + política da conexão + overrides do binding). Em PRODUÇÃO a
 * política é FORÇADA a https-only, sem redes privadas/loopback/link-local — nenhum
 * valor armazenado pode afrouxar isso. `http`/loopback só existem fora de produção
 * (servidores locais de teste), nunca por default de produção.
 */

import { PRODUCTION_NETWORK_POLICY_DEFAULTS } from '@arden/contracts';
import type { SecureHttpPolicy } from '../http/secure-http.types';

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : fallback;
}

function numberArray(value: unknown, fallback: number[]): number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number') ? (value as number[]) : fallback;
}

/**
 * Constrói a política efetiva de runtime. `nodeEnv==='production'` força https-only e
 * bloqueia toda rede privada/loopback/link-local independentemente do armazenado.
 */
export function buildSecureHttpPolicy(
  sources: { template?: unknown; connectionPolicy?: unknown; overrides?: unknown },
  nodeEnv: string,
): SecureHttpPolicy {
  const merged = { ...PRODUCTION_NETWORK_POLICY_DEFAULTS, ...asObject(sources.template), ...asObject(sources.connectionPolicy), ...asObject(sources.overrides) } as Record<string, unknown>;
  const isProd = nodeEnv === 'production';

  const rawProtocols = stringArray(merged.allowedProtocols, ['https']).filter((p) => p === 'http' || p === 'https') as Array<'http' | 'https'>;
  const allowedProtocols: Array<'http' | 'https'> = isProd ? ['https'] : (rawProtocols.length ? rawProtocols : ['https']);

  return {
    allowedProtocols,
    allowedHosts: stringArray(merged.allowedHosts, []),
    allowedPorts: numberArray(merged.allowedPorts, [443]),
    allowedPathPrefixes: Array.isArray(merged.allowedPathPrefixes) ? stringArray(merged.allowedPathPrefixes, []) : undefined,
    allowRedirects: bool(merged.allowRedirects, false),
    maximumRedirects: num(merged.maximumRedirects, 0),
    allowPrivateNetworks: isProd ? false : bool(merged.allowPrivateNetworks, false),
    allowLoopback: isProd ? false : bool(merged.allowLoopback, false),
    allowLinkLocal: isProd ? false : bool(merged.allowLinkLocal, false),
    maximumRequestBytes: num(merged.maximumRequestBytes, 1_048_576),
    maximumResponseBytes: num(merged.maximumResponseBytes, 5_242_880),
    timeoutMs: num(merged.timeoutMs, 15_000),
  };
}
