/** Arden.AS API — módulo de health (ARDEN-BE-001). */

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
