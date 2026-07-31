/** Arden.AS API — módulo de idempotência (ARDEN-BE-001). */

import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';

@Module({
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
