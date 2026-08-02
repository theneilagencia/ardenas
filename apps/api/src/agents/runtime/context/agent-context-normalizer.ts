/**
 * Arden.AS API — normalização + redação de fontes de contexto (ARDEN-BE-007.4).
 *
 * PURO (sem I/O). Converte o valor bruto de uma fonte numa estrutura plana e
 * serializável, REJEITANDO tipos perigosos ou não determinísticos: Buffer, stream,
 * função, symbol, BigInt e referências circulares. Em seguida redige campos sensíveis
 * (reaproveita o `SensitiveDataRedactor` central) e computa os hashes de conteúdo
 * (antes/depois da redação). Nunca lança para conteúdo inválido — sinaliza `ok:false`.
 */

import { Injectable } from '@nestjs/common';
import { sensitiveDataRedactor } from '../../../common/redaction/sensitive-data-redactor';
import { stableHash } from '../../hashing/stable-hash';
import type { NormalizedContextSource, RawContextSource } from './agent-context.types';

export type NormalizationResult =
  | { ok: true; value: unknown; empty: boolean }
  | { ok: false; reason: 'NON_SERIALIZABLE' | 'CIRCULAR' };

const MAX_DEPTH = 64;

/**
 * Clona o valor produzindo APENAS JSON-serializável (string/number finito/boolean/null,
 * arrays e objetos planos). `undefined` é descartado. Qualquer outro tipo → inválido.
 */
export function normalizeValue(input: unknown): NormalizationResult {
  const seen = new WeakSet<object>();
  let empty = true;

  const walk = (value: unknown, depth: number): { ok: true; value: unknown } | { ok: false; reason: 'NON_SERIALIZABLE' | 'CIRCULAR' } => {
    if (depth > MAX_DEPTH) return { ok: false, reason: 'CIRCULAR' };
    if (value === null) return { ok: true, value: null };

    const t = typeof value;
    if (t === 'string') {
      if ((value as string).length > 0) empty = false;
      return { ok: true, value };
    }
    if (t === 'boolean') {
      empty = false;
      return { ok: true, value };
    }
    if (t === 'number') {
      if (!Number.isFinite(value as number)) return { ok: false, reason: 'NON_SERIALIZABLE' };
      empty = false;
      return { ok: true, value };
    }
    if (t === 'undefined') return { ok: true, value: undefined };
    // bigint, symbol, function → proibidos e não determinísticos/serializáveis.
    if (t === 'bigint' || t === 'symbol' || t === 'function') return { ok: false, reason: 'NON_SERIALIZABLE' };

    // A partir daqui é object. Rejeita Buffer/TypedArray/stream/Date-like binários.
    if (value instanceof Date) {
      empty = false;
      return { ok: true, value: value.toISOString() };
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return { ok: false, reason: 'NON_SERIALIZABLE' };
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return { ok: false, reason: 'NON_SERIALIZABLE' };
    // Streams e objetos "richos" com métodos de I/O.
    if (typeof (value as { pipe?: unknown }).pipe === 'function') return { ok: false, reason: 'NON_SERIALIZABLE' };

    if (seen.has(value as object)) return { ok: false, reason: 'CIRCULAR' };
    seen.add(value as object);

    if (Array.isArray(value)) {
      const out: unknown[] = [];
      for (const item of value) {
        const r = walk(item, depth + 1);
        if (!r.ok) return r;
        out.push(r.value === undefined ? null : r.value);
      }
      empty = empty && out.length === 0;
      return { ok: true, value: out };
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) {
      // Objetos de classe (ex.: instâncias com métodos) não são fontes de contexto válidas.
      return { ok: false, reason: 'NON_SERIALIZABLE' };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = walk(v, depth + 1);
      if (!r.ok) return r;
      if (r.value !== undefined) {
        out[k] = r.value;
        empty = false;
      }
    }
    return { ok: true, value: out };
  };

  const result = walk(input, 0);
  if (!result.ok) return result;
  return { ok: true, value: result.value, empty };
}

@Injectable()
export class AgentContextNormalizer {
  /**
   * Normaliza + redige uma fonte crua. Retorna `null` quando o conteúdo é inválido
   * (não serializável/circular) ou vazio — o chamador decide a exclusão.
   */
  normalize(raw: RawContextSource): { source: NormalizedContextSource | null; reason?: 'SOURCE_INVALID' | 'SOURCE_EMPTY' } {
    const normalized = normalizeValue(raw.value);
    if (!normalized.ok) return { source: null, reason: 'SOURCE_INVALID' };
    if (normalized.empty) return { source: null, reason: 'SOURCE_EMPTY' };

    const originalHash = stableHash(normalized.value ?? null);
    const redactedValue = sensitiveDataRedactor.redactObject(normalized.value ?? null);
    const redactedHash = stableHash(redactedValue ?? null);
    const bytes = Buffer.byteLength(JSON.stringify(redactedValue ?? null), 'utf8');

    return {
      source: {
        kind: raw.kind,
        ref: raw.ref,
        label: raw.label,
        producerActionKey: raw.producerActionKey,
        redactedValue,
        originalHash,
        redactedHash,
        bytes,
      },
    };
  }
}
