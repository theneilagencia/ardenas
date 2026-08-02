/**
 * Arden.AS API — classificação de IP para prevenção de SSRF (ARDEN-BE-006.5).
 *
 * Decisão baseada no IP FINAL (não em regex de hostname). Cobre IPv4 e IPv6,
 * desembrulha IPv4-mapped IPv6 e bloqueia loopback, redes privadas (RFC1918/CGNAT),
 * link-local, metadata services, multicast, broadcast, unspecified, ULA IPv6 e faixas
 * reservadas/documentação. Implementação NATIVA (node:net) — sem dependência nova.
 */

import { isIP } from 'node:net';

export type IpCategory =
  | 'public'
  | 'loopback'
  | 'private'
  | 'cgnat'
  | 'link_local'
  | 'metadata'
  | 'multicast'
  | 'broadcast'
  | 'unspecified'
  | 'ula'
  | 'reserved'
  | 'invalid';

export interface IpClassification {
  category: IpCategory;
  /** `true` só para `public` — qualquer outra categoria é bloqueada por padrão. */
  isPublic: boolean;
}

function classifyV4(octets: number[]): IpCategory {
  const [a, b] = octets;
  if (a === 0) return 'unspecified'; // 0.0.0.0/8
  if (a === 127) return 'loopback'; // 127.0.0.0/8
  if (a === 10) return 'private'; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return 'private'; // 172.16.0.0/12
  if (a === 192 && b === 168) return 'private'; // 192.168.0.0/16
  if (a === 169 && b === 254) return 'link_local'; // 169.254.0.0/16 (inclui 169.254.169.254 metadata)
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat'; // 100.64.0.0/10
  if (a >= 224 && a <= 239) return 'multicast'; // 224.0.0.0/4
  if (a >= 240) return 'reserved'; // 240.0.0.0/4 + 255.255.255.255
  // Faixas reservadas/documentação/benchmark.
  if (a === 192 && b === 0 && octets[2] === 0) return 'reserved'; // 192.0.0.0/24
  if (a === 192 && b === 0 && octets[2] === 2) return 'reserved'; // 192.0.2.0/24 (TEST-NET-1)
  if (a === 198 && (b === 18 || b === 19)) return 'reserved'; // 198.18.0.0/15
  if (a === 198 && b === 51 && octets[2] === 100) return 'reserved'; // 198.51.100.0/24
  if (a === 203 && b === 0 && octets[2] === 113) return 'reserved'; // 203.0.113.0/24
  return 'public';
}

/** Expande um IPv6 (com `::` e possível IPv4 embutido) para 16 bytes; null se inválido. */
function ipv6ToBytes(ip: string): number[] | null {
  let text = ip;
  const embedded: number[] = [];
  // IPv4 embutido nos últimos 32 bits (ex.: ::ffff:1.2.3.4).
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    if (isIP(tail) !== 4) return null;
    for (const p of tail.split('.')) embedded.push(Number(p));
    text = text.slice(0, lastColon + 1) + '0:0'; // substitui por 2 hextets placeholder
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string): number[] => (part ? part.split(':').map((h) => parseInt(h, 16)) : []);
  const head = parse(halves[0]);
  const back = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - back.length;
  if (missing < 0 && halves.length === 2) return null;
  const groups = halves.length === 2 ? [...head, ...Array(missing).fill(0), ...back] : head;
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  const bytes: number[] = [];
  for (const g of groups) {
    bytes.push((g >> 8) & 0xff, g & 0xff);
  }
  if (embedded.length === 4) {
    bytes[12] = embedded[0];
    bytes[13] = embedded[1];
    bytes[14] = embedded[2];
    bytes[15] = embedded[3];
  }
  return bytes;
}

function classifyV6(ip: string): IpClassification {
  const bytes = ipv6ToBytes(ip);
  if (!bytes) return { category: 'invalid', isPublic: false };
  // IPv4-mapped (::ffff:a.b.c.d) e IPv4-compatible (::a.b.c.d) → classifica o IPv4.
  const first10Zero = bytes.slice(0, 10).every((b) => b === 0);
  if (first10Zero && bytes[10] === 0xff && bytes[11] === 0xff) {
    return finalize(classifyV4(bytes.slice(12)));
  }
  if (bytes.every((b) => b === 0)) return { category: 'unspecified', isPublic: false };
  if (bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1) return { category: 'loopback', isPublic: false };
  if (bytes[0] === 0xff) return { category: 'multicast', isPublic: false }; // ff00::/8
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return { category: 'link_local', isPublic: false }; // fe80::/10
  if ((bytes[0] & 0xfe) === 0xfc) return { category: 'ula', isPublic: false }; // fc00::/7 (inclui metadata IPv6)
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return { category: 'reserved', isPublic: false }; // 2001:db8::/32
  return { category: 'public', isPublic: true };
}

function finalize(category: IpCategory): IpClassification {
  return { category, isPublic: category === 'public' };
}

/** Classifica um endereço IP (v4 ou v6). Categoria != 'public' ⇒ bloqueado. */
export function classifyIp(ip: string): IpClassification {
  const kind = isIP(ip);
  if (kind === 4) {
    const octets = ip.split('.').map(Number);
    if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return { category: 'invalid', isPublic: false };
    // Detecta metadata explicitamente para telemetria (169.254.169.254).
    if (ip === '169.254.169.254') return { category: 'metadata', isPublic: false };
    return finalize(classifyV4(octets));
  }
  if (kind === 6) return classifyV6(ip.toLowerCase());
  return { category: 'invalid', isPublic: false };
}
