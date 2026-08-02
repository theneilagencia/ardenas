/**
 * Arden.AS API — validação de destino contra SSRF (ARDEN-BE-006.5).
 *
 * Pipeline: parse URL → protocolo → userinfo → host allowlist → porta → resolução DNS
 * (todos os A/AAAA) → classificação de CADA IP → pinning ao IP validado. Bloqueia
 * loopback, redes privadas, link-local, metadata, multicast, etc. (a menos que a
 * política de desenvolvimento permita explicitamente). Erros são SANITIZADOS/genéricos.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import {
  protocolNotAllowed, hostNotAllowed, privateNetworkDenied, ssrfBlocked,
} from '../../common/errors/api-error';
import { classifyIp } from './ip-classifier';
import type { SecureHttpPolicy } from './secure-http.types';

export interface ValidatedTarget {
  url: URL;
  host: string;
  port: number;
  /** IP validado ao qual a conexão será FIXADA (anti-DNS-rebinding). */
  pinnedIp: string;
  family: 4 | 6;
}

function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

function hostAllowed(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase();
  return allowed.some((entry) => {
    // `*` isolado = curinga total (apenas política de desenvolvimento; a segurança
    // real vem da classificação de IP, nunca só da allowlist de host).
    if (entry === '*') return true;
    const e = entry.toLowerCase().replace(/^\*\./, '.');
    if (e.startsWith('.')) return h === e.slice(1) || h.endsWith(e);
    return h === e || h.endsWith(`.${e}`);
  });
}

function assertIpAllowed(ip: string, policy: SecureHttpPolicy): void {
  const { category } = classifyIp(ip);
  if (category === 'public') return;
  if (category === 'loopback' && policy.allowLoopback) return;
  if (category === 'link_local' && policy.allowLinkLocal) return;
  if ((category === 'private' || category === 'cgnat' || category === 'ula') && policy.allowPrivateNetworks) return;
  // metadata/multicast/broadcast/unspecified/reserved/invalid → SEMPRE bloqueado.
  if (category === 'private' || category === 'cgnat' || category === 'ula' || category === 'loopback' || category === 'link_local') {
    throw privateNetworkDenied();
  }
  throw ssrfBlocked();
}

/** Valida e resolve o destino, fixando ao IP validado. Lança erro tipado se inseguro. */
export async function validateTarget(rawUrl: string, policy: SecureHttpPolicy): Promise<ValidatedTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw ssrfBlocked();
  }
  // Protocolo (só os permitidos; sem file/ftp/gopher/data/etc.).
  const scheme = url.protocol.replace(':', '');
  if (scheme !== 'http' && scheme !== 'https') throw protocolNotAllowed();
  if (!policy.allowedProtocols.includes(scheme as 'http' | 'https')) throw protocolNotAllowed();
  // Credenciais embutidas na URL → bloqueado.
  if (url.username || url.password) throw ssrfBlocked();

  const host = stripBrackets(url.hostname);
  if (!host) throw ssrfBlocked();
  if (!hostAllowed(host, policy.allowedHosts)) throw hostNotAllowed();

  // Porta efetiva.
  const port = url.port ? Number(url.port) : scheme === 'https' ? 443 : 80;
  if (!policy.allowedPorts.includes(port)) throw protocolNotAllowed();

  // Path prefix (quando restrito).
  if (policy.allowedPathPrefixes && policy.allowedPathPrefixes.length > 0) {
    if (!policy.allowedPathPrefixes.some((p) => url.pathname.startsWith(p))) throw ssrfBlocked();
  }

  // Resolução DNS: host literal resolve para si; senão, TODOS os A/AAAA.
  let addresses: Array<{ address: string; family: number }>;
  if (isIP(host)) {
    addresses = [{ address: host, family: isIP(host) }];
  } else {
    try {
      addresses = await lookup(host, { all: true });
    } catch {
      throw ssrfBlocked();
    }
  }
  if (addresses.length === 0) throw ssrfBlocked();
  // TODOS os IPs resolvidos devem ser permitidos (impede round-robin p/ IP privado).
  for (const a of addresses) assertIpAllowed(a.address, policy);

  const pinned = addresses[0];
  return { url, host, port, pinnedIp: pinned.address, family: (isIP(pinned.address) as 4 | 6) || 4 };
}
