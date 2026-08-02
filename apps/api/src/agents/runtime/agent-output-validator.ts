/**
 * Arden.AS API — validação de saída estruturada (ARDEN-BE-007.3 §16).
 * Reutiliza o validador JSON Schema determinístico do BE-006.6. Output inválido NUNCA
 * é sucesso; excesso de bytes reprova. Sem execução de código, sem `$ref`.
 */

import { Injectable } from '@nestjs/common';
import type { AgentOutputValidationResult } from '@arden/contracts';
import { validateAgainstSchema } from '../../connectors/tools/json-schema-validator';

export interface AgentOutputValidationInputV1 {
  schema: Record<string, unknown>;
  rawOutput: unknown;
  maximumOutputBytes: number;
  repairAttemptCount: number;
}

@Injectable()
export class AgentOutputValidatorV1 {
  validate(input: AgentOutputValidationInputV1): AgentOutputValidationResult {
    const bytes = Buffer.byteLength(JSON.stringify(input.rawOutput ?? null), 'utf8');
    if (bytes > input.maximumOutputBytes) {
      return {
        valid: false,
        validationErrors: [{ path: '', code: 'OUTPUT_TOO_LARGE', message: `saída excede ${input.maximumOutputBytes} bytes` }],
        repairAttemptCount: input.repairAttemptCount,
      };
    }
    const violations = validateAgainstSchema(input.rawOutput, input.schema);
    if (violations.length > 0) {
      return {
        valid: false,
        validationErrors: violations.map((v) => ({ path: v.path, code: 'SCHEMA_VIOLATION', message: v.message })),
        repairAttemptCount: input.repairAttemptCount,
      };
    }
    return { valid: true, acceptedOutput: input.rawOutput, repairAttemptCount: input.repairAttemptCount };
  }
}
