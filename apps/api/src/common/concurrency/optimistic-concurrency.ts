/**
 * Arden.AS API — concorrência otimista (ARDEN-BE-001).
 *
 * Utilitários e padrão para `revision` / `If-Match` / `VERSION_CONFLICT`. Ainda
 * NÃO aplicados a recursos de negócio (inexistentes). Os módulos futuros DEVERÃO
 * usar `assertRevision` antes de mutar um recurso versionado (ver
 * docs/backend/... e API_V1_IDEMPOTENCY_AND_CONCURRENCY.md).
 */

import { versionConflict } from '../errors/api-error';

/** Lê a revisão esperada de um header `If-Match` (número). */
export function parseIfMatch(header: unknown): number | undefined {
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.replace(/"/g, '').trim();
  if (!/^\d+$/.test(cleaned)) return undefined;
  return Number(cleaned);
}

/**
 * Garante que a revisão esperada corresponde à atual. Lança `VERSION_CONFLICT`
 * (409) com detalhes de revisão quando divergem. Padrão para todos os recursos
 * mutáveis com `revision`.
 */
export function assertRevision(params: {
  resourceType: string;
  resourceId: string;
  expectedRevision: number;
  currentRevision: number;
}): void {
  if (params.expectedRevision !== params.currentRevision) {
    throw versionConflict({
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      expectedRevision: params.expectedRevision,
      currentRevision: params.currentRevision,
    });
  }
}
