/** Arden.AS API — módulo meta (ARDEN-BE-001). */

import { Module } from '@nestjs/common';
import { MetaController } from './meta.controller';

@Module({
  controllers: [MetaController],
})
export class MetaModule {}
