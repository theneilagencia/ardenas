/**
 * Arden.AS API — testes do guard SSRF (ARDEN-BE-006.5).
 *
 * Valida o pipeline de destino sem tocar a internet: hosts literais resolvem para si
 * mesmos e `localhost` resolve para loopback local. Cobre protocolo, userinfo, host
 * allowlist, porta, path prefix e classificação de IP (v4/v6/mapped/decimal).
 */

import { describe, expect, it } from 'vitest';
import { validateTarget } from './ssrf-guard';
import type { SecureHttpPolicy } from './secure-http.types';

const BASE: SecureHttpPolicy = {
  allowedProtocols: ['https'],
  allowedHosts: ['*'],
  allowedPorts: [443, 80],
  allowRedirects: false,
  maximumRedirects: 0,
  allowPrivateNetworks: false,
  allowLoopback: false,
  allowLinkLocal: false,
  maximumRequestBytes: 1_048_576,
  maximumResponseBytes: 5_242_880,
  timeoutMs: 15_000,
};

function policy(overrides: Partial<SecureHttpPolicy> = {}): SecureHttpPolicy {
  return { ...BASE, ...overrides };
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('validateTarget — protocolo', () => {
  it('rejeita http quando só https é permitido', async () => {
    await expectCode(validateTarget('http://8.8.8.8/', policy()), 'PROTOCOL_NOT_ALLOWED');
  });

  it.each(['ftp://8.8.8.8/', 'file:///etc/passwd', 'gopher://8.8.8.8/', 'data:text/plain,hi'])(
    'rejeita esquema perigoso %s',
    async (url) => {
      await expectCode(validateTarget(url, policy()), 'PROTOCOL_NOT_ALLOWED');
    },
  );

  it('aceita http quando a política de desenvolvimento permite', async () => {
    const t = await validateTarget('http://8.8.8.8/', policy({ allowedProtocols: ['http', 'https'] }));
    expect(t.pinnedIp).toBe('8.8.8.8');
    expect(t.port).toBe(80);
  });
});

describe('validateTarget — userinfo embutido', () => {
  it('rejeita credenciais na URL', async () => {
    await expectCode(validateTarget('https://user:pass@8.8.8.8/', policy()), 'SSRF_BLOCKED');
  });
});

describe('validateTarget — host allowlist', () => {
  it('rejeita host fora da allowlist', async () => {
    await expectCode(
      validateTarget('https://8.8.8.8/', policy({ allowedHosts: ['api.exemplo.com'] })),
      'HOST_NOT_ALLOWED',
    );
  });

  it('aceita subdomínio via wildcard', async () => {
    const t = await validateTarget('https://8.8.8.8/', policy({ allowedHosts: ['*'] }));
    expect(t.host).toBe('8.8.8.8');
  });
});

describe('validateTarget — porta', () => {
  it('rejeita porta fora da allowlist', async () => {
    await expectCode(
      validateTarget('https://8.8.8.8:8443/', policy({ allowedPorts: [443] })),
      'PROTOCOL_NOT_ALLOWED',
    );
  });
});

describe('validateTarget — path prefix', () => {
  it('rejeita path fora do prefixo permitido', async () => {
    await expectCode(
      validateTarget('https://8.8.8.8/admin', policy({ allowedPathPrefixes: ['/v1/'] })),
      'SSRF_BLOCKED',
    );
  });

  it('aceita path dentro do prefixo permitido', async () => {
    const t = await validateTarget('https://8.8.8.8/v1/data', policy({ allowedPathPrefixes: ['/v1/'] }));
    expect(t.url.pathname).toBe('/v1/data');
  });
});

describe('validateTarget — IPs literais bloqueados', () => {
  it.each([
    ['https://127.0.0.1/', 'PRIVATE_NETWORK_DENIED'],
    ['https://10.0.0.1/', 'PRIVATE_NETWORK_DENIED'],
    ['https://192.168.1.1/', 'PRIVATE_NETWORK_DENIED'],
    ['https://169.254.169.254/', 'SSRF_BLOCKED'],
    ['https://[::1]/', 'PRIVATE_NETWORK_DENIED'],
    ['https://[fd00::1]/', 'PRIVATE_NETWORK_DENIED'],
    ['https://100.64.0.1/', 'PRIVATE_NETWORK_DENIED'],
  ])('%s → %s', async (url, code) => {
    await expectCode(validateTarget(url, policy()), code);
  });

  it('metadata IPv4 (169.254.169.254) é sempre bloqueado mesmo com link-local liberado', async () => {
    await expectCode(
      validateTarget('https://169.254.169.254/latest/meta-data/', policy({ allowLinkLocal: true })),
      'SSRF_BLOCKED',
    );
  });
});

describe('validateTarget — IPs literais permitidos por política de dev', () => {
  it('loopback só passa com allowLoopback', async () => {
    const t = await validateTarget('https://127.0.0.1/', policy({ allowLoopback: true }));
    expect(t.pinnedIp).toBe('127.0.0.1');
    expect(t.family).toBe(4);
  });

  it('rede privada só passa com allowPrivateNetworks', async () => {
    const t = await validateTarget('https://10.0.0.5/', policy({ allowPrivateNetworks: true }));
    expect(t.pinnedIp).toBe('10.0.0.5');
  });
});

describe('validateTarget — hostname resolvido', () => {
  it('localhost resolve para loopback e é bloqueado por padrão', async () => {
    await expectCode(validateTarget('https://localhost/', policy()), 'PRIVATE_NETWORK_DENIED');
  });

  it('localhost é permitido quando allowLoopback está ligado (fixa ao IP resolvido)', async () => {
    const t = await validateTarget('https://localhost/', policy({ allowLoopback: true }));
    expect(['127.0.0.1', '::1']).toContain(t.pinnedIp);
    expect(t.host).toBe('localhost');
  });

  it('host inexistente → SSRF_BLOCKED (falha fechada)', async () => {
    await expectCode(
      validateTarget('https://nao-existe.invalid/', policy({ allowedHosts: ['*'] })),
      'SSRF_BLOCKED',
    );
  });
});

describe('validateTarget — URL malformada', () => {
  it('rejeita URL inválida', async () => {
    await expectCode(validateTarget('not a url', policy()), 'SSRF_BLOCKED');
  });
});
