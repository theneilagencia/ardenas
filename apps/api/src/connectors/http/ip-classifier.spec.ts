/**
 * Arden.AS API — testes da classificação de IP (ARDEN-BE-006.5).
 *
 * Cobre IPv4, IPv6, IPv4-mapped e faixas privadas/loopback/link-local/metadata/
 * multicast/reservadas. A decisão é baseada no IP FINAL, não em regex de hostname.
 */

import { describe, expect, it } from 'vitest';
import { classifyIp } from './ip-classifier';

describe('classifyIp — IPv4 público', () => {
  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '52.94.236.248'])('%s → public', (ip) => {
    expect(classifyIp(ip)).toEqual({ category: 'public', isPublic: true });
  });
});

describe('classifyIp — IPv4 bloqueado', () => {
  it.each([
    ['0.0.0.0', 'unspecified'],
    ['127.0.0.1', 'loopback'],
    ['127.255.255.255', 'loopback'],
    ['10.0.0.1', 'private'],
    ['10.255.255.255', 'private'],
    ['172.16.0.1', 'private'],
    ['172.31.255.255', 'private'],
    ['192.168.1.1', 'private'],
    ['169.254.1.1', 'link_local'],
    ['169.254.169.254', 'metadata'],
    ['100.64.0.1', 'cgnat'],
    ['100.127.255.255', 'cgnat'],
    ['224.0.0.1', 'multicast'],
    ['239.255.255.255', 'multicast'],
    ['240.0.0.1', 'reserved'],
    ['255.255.255.255', 'reserved'],
    ['192.0.2.5', 'reserved'],
    ['198.18.0.1', 'reserved'],
    ['198.51.100.5', 'reserved'],
    ['203.0.113.5', 'reserved'],
  ])('%s → %s (não público)', (ip, category) => {
    const result = classifyIp(ip);
    expect(result.category).toBe(category);
    expect(result.isPublic).toBe(false);
  });

  it('172.15.x e 172.32.x são públicos (fora do /12)', () => {
    expect(classifyIp('172.15.0.1').category).toBe('public');
    expect(classifyIp('172.32.0.1').category).toBe('public');
  });
});

describe('classifyIp — IPv6', () => {
  it.each([
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['fe80::1', 'link_local'],
    ['fc00::1', 'ula'],
    ['fd00::1', 'ula'],
    ['ff02::1', 'multicast'],
    ['2001:db8::1', 'reserved'],
  ])('%s → %s', (ip, category) => {
    const result = classifyIp(ip);
    expect(result.category).toBe(category);
    expect(result.isPublic).toBe(false);
  });

  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888'])('%s → public', (ip) => {
    expect(classifyIp(ip).isPublic).toBe(true);
  });
});

describe('classifyIp — IPv4-mapped/compatible IPv6 desembrulhado', () => {
  it('::ffff:127.0.0.1 classifica como loopback', () => {
    expect(classifyIp('::ffff:127.0.0.1').category).toBe('loopback');
  });

  it('::ffff:169.254.169.254 é bloqueado (metadata via IPv6)', () => {
    expect(classifyIp('::ffff:169.254.169.254').isPublic).toBe(false);
  });

  it('::ffff:10.0.0.1 classifica como private', () => {
    expect(classifyIp('::ffff:10.0.0.1').category).toBe('private');
  });

  it('::ffff:8.8.8.8 continua público', () => {
    expect(classifyIp('::ffff:8.8.8.8').isPublic).toBe(true);
  });
});

describe('classifyIp — entradas inválidas', () => {
  it.each(['not-an-ip', '', '999.999.999.999', '10.0.0', 'http://8.8.8.8', '::gggg'])(
    '%s → invalid',
    (ip) => {
      expect(classifyIp(ip)).toEqual({ category: 'invalid', isPublic: false });
    },
  );
});
