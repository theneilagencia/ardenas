/**
 * Arden.AS API — pipe de validação Zod (ARDEN-BE-001).
 *
 * Usa os schemas COMPARTILHADOS (`@arden/contracts`) quando aplicável — não
 * duplica Zod e class-validator. Rejeita entradas inválidas com
 * `VALIDATION_ERROR` + `fieldErrors`. Schemas `.strict()` rejeitam campos
 * desconhecidos.
 */

import { Injectable, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from 'zod';
import { validationError } from '../errors/api-error';
import type { FieldError } from '@arden/contracts';

function toFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    code: issue.code,
    message: issue.message,
  }));
}

@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): ZodInfer<T> {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) throw validationError(toFieldErrors(err));
      throw err;
    }
  }
}
