/**
 * Arden.AS API — alocação determinística de orçamento de contexto (ARDEN-BE-007.4).
 *
 * PURO. Distribui um orçamento de bytes (após reservar instruções de sistema + objetivo +
 * margem de saída) entre as fontes, com TETO PERCENTUAL por categoria e um teto GLOBAL
 * corrente que garante `Σ incluídos ≤ disponível`. Deduplica fontes idênticas (mesmo
 * `redactedHash`) e trunca com segurança em fronteira UTF-8, preservando JSON válido.
 * Nunca acessa I/O. Se nem o reservado couber, sinaliza `BUDGET_EXCEEDED`.
 */

import { Injectable } from '@nestjs/common';
import type {
  BudgetedContextSource,
  ContextSourceKind,
  ExcludedContextSource,
  GuardedContextSource,
} from './agent-context.types';

/** Fração do orçamento disponível que cada categoria pode ocupar (teto por fonte-categoria). */
export const DEFAULT_KIND_FRACTION: Record<ContextSourceKind, number> = {
  EXECUTION_INPUT: 0.4,
  PREVIOUS_STEP_OUTPUT: 0.3,
  TOOL_RESULT: 0.2,
  LINKED_DOCUMENT: 0.2,
  OPERATION_METADATA: 0.05,
};

/** Ordem estável de prioridade de inclusão. */
const KIND_PRIORITY: Record<ContextSourceKind, number> = {
  EXECUTION_INPUT: 1,
  OPERATION_METADATA: 2,
  PREVIOUS_STEP_OUTPUT: 3,
  TOOL_RESULT: 4,
  LINKED_DOCUMENT: 5,
};

export interface BudgetAllocationInput {
  sources: GuardedContextSource[];
  availableBytes: number;
  kindFraction?: Record<ContextSourceKind, number>;
}

export interface BudgetAllocationResult {
  status: 'OK' | 'BUDGET_EXCEEDED';
  included: BudgetedContextSource[];
  excluded: ExcludedContextSource[];
  totalBytes: number;
  truncated: boolean;
}

/** Trunca uma string em `maxBytes` respeitando a fronteira de caractere UTF-8. */
export function truncateUtf8(str: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  const buf = Buffer.from(str, 'utf8');
  if (buf.length <= maxBytes) return str;
  let end = maxBytes;
  // Recua enquanto estiver no meio de um caractere multibyte (bytes de continuação 10xxxxxx).
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return buf.toString('utf8', 0, end);
}

/**
 * Trunca um valor serializável para caber em `cap` bytes, embrulhando o recorte num
 * envelope JSON válido `{ __ardenTruncated, omittedBytes, preview }`. Garante que a
 * serialização final (com escaping) não exceda `cap`.
 */
export function truncateValueToBytes(value: unknown, cap: number): { value: unknown; bytes: number } {
  const json = JSON.stringify(value ?? null);
  const full = Buffer.byteLength(json, 'utf8');
  if (full <= cap) return { value, bytes: full };

  // Reserva espaço para o esqueleto do envelope; encolhe o preview até caber com escaping.
  let previewBudget = Math.max(0, cap - 96);
  let preview = truncateUtf8(json, previewBudget);
  let wrapped = { __ardenTruncated: true, omittedBytes: full - Buffer.byteLength(preview, 'utf8'), preview };
  let bytes = Buffer.byteLength(JSON.stringify(wrapped), 'utf8');
  while (bytes > cap && preview.length > 0) {
    previewBudget = Math.max(0, previewBudget - Math.max(16, Math.ceil((bytes - cap) * 1.5)));
    preview = truncateUtf8(json, previewBudget);
    wrapped = { __ardenTruncated: true, omittedBytes: full - Buffer.byteLength(preview, 'utf8'), preview };
    bytes = Buffer.byteLength(JSON.stringify(wrapped), 'utf8');
  }
  return { value: wrapped, bytes };
}

@Injectable()
export class AgentContextBudgetAllocator {
  allocate(input: BudgetAllocationInput): BudgetAllocationResult {
    const fraction = input.kindFraction ?? DEFAULT_KIND_FRACTION;
    const available = Math.floor(input.availableBytes);
    const excluded: ExcludedContextSource[] = [];

    if (available <= 0) {
      return { status: 'BUDGET_EXCEEDED', included: [], excluded, totalBytes: 0, truncated: false };
    }

    // Ordem estável: prioridade de categoria, depois ordem de chegada.
    const ordered = input.sources
      .map((s, i) => ({ s, i }))
      .sort((a, b) => KIND_PRIORITY[a.s.kind] - KIND_PRIORITY[b.s.kind] || a.i - b.i)
      .map((x) => x.s);

    const seen = new Set<string>();
    const included: BudgetedContextSource[] = [];
    let remaining = available;
    let anyTruncated = false;

    for (const s of ordered) {
      if (seen.has(s.redactedHash)) {
        excluded.push({ kind: s.kind, ref: s.ref, reason: 'DUPLICATE_SOURCE' });
        continue;
      }
      const kindCap = Math.floor(available * (fraction[s.kind] ?? 0));
      const cap = Math.min(kindCap, remaining);
      if (cap <= 0) {
        excluded.push({ kind: s.kind, ref: s.ref, reason: 'BUDGET_EXCLUDED' });
        continue;
      }

      const fit = truncateValueToBytes(s.redactedValue, cap);
      const truncated = fit.bytes < Buffer.byteLength(JSON.stringify(s.redactedValue ?? null), 'utf8');
      seen.add(s.redactedHash);
      remaining -= fit.bytes;
      anyTruncated = anyTruncated || truncated;
      included.push({
        ...s,
        includedValue: fit.value,
        includedBytes: fit.bytes,
        truncated,
        isolated: s.decision === 'ALLOW_WITH_ISOLATION',
      });
    }

    return { status: 'OK', included, excluded, totalBytes: available - remaining, truncated: anyTruncated };
  }
}
