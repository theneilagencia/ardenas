/**
 * Arden.AS API — teste do rate limiter de webhook (ARDEN-BE-006.7).
 */

import { describe, expect, it } from 'vitest';
import { WebhookRateLimiter } from './webhook-rate-limiter';

describe('WebhookRateLimiter', () => {
  it('permite dentro do limite e bloqueia ao exceder (por token+ip)', () => {
    const rl = new WebhookRateLimiter();
    const t0 = 1_000_000;
    let allowed = 0;
    for (let i = 0; i < 200; i++) if (rl.check('hash', '1.2.3.4', t0 + i)) allowed++;
    expect(allowed).toBe(120); // MAX_PER_WINDOW
  });

  it('janela desliza: após 60s libera novamente', () => {
    const rl = new WebhookRateLimiter();
    const t0 = 2_000_000;
    for (let i = 0; i < 120; i++) rl.check('h', 'ip', t0);
    expect(rl.check('h', 'ip', t0)).toBe(false);
    expect(rl.check('h', 'ip', t0 + 61_000)).toBe(true);
  });

  it('chaves distintas (ip diferente) não compartilham contagem', () => {
    const rl = new WebhookRateLimiter();
    for (let i = 0; i < 120; i++) rl.check('h', 'ip-a', 3_000_000);
    expect(rl.check('h', 'ip-a', 3_000_000)).toBe(false);
    expect(rl.check('h', 'ip-b', 3_000_000)).toBe(true);
  });
});
