/**
 * Arden.AS API — rate limit BÁSICO do endpoint público de webhook (ARDEN-BE-006.7).
 *
 * Janela deslizante EM PROCESSO (sem infraestrutura externa nova), por
 * `tokenHash + IP sanitizado`. Não confia em X-Forwarded-For arbitrário. Excesso →
 * RATE_LIMITED (resposta pública mínima, não revela a existência do endpoint).
 */

import { Injectable } from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const MAX_KEYS = 10_000;

@Injectable()
export class WebhookRateLimiter {
  private readonly hits = new Map<string, number[]>();

  /** Retorna `true` se DENTRO do limite; `false` se excedeu. `now` injetável. */
  check(tokenHash: string, ip: string, now = Date.now()): boolean {
    const key = `${tokenHash}:${ip}`;
    const cutoff = now - WINDOW_MS;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length >= MAX_PER_WINDOW) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > MAX_KEYS) this.evict(cutoff);
    return true;
  }

  private evict(cutoff: number): void {
    for (const [k, v] of this.hits) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) this.hits.delete(k);
      else this.hits.set(k, fresh);
    }
  }
}
