/**
 * Arden.AS API — leitura de headers de comando (ARDEN-BE-003).
 * `Idempotency-Key` é OBRIGATÓRia nos comandos idempotentes do contrato
 * (create/duplicate/archive/version.create/publish). `If-Match` é opcional
 * (concorrência otimista alternativa a `expectedRevision`).
 */

import { validationError } from '../common/errors/api-error';

export function requireIdempotencyKey(header: unknown): string {
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== 'string' || raw.trim().length < 8) {
    throw validationError(
      [{ field: 'Idempotency-Key', code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Header Idempotency-Key (mínimo 8 caracteres) obrigatório.' }],
      'Idempotency-Key obrigatória.',
    );
  }
  return raw.trim();
}
