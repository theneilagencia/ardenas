/**
 * Arden.AS API — módulo de documentação (ARDEN-BE-001).
 * Registra o DocsController apenas quando ENABLE_SWAGGER é verdadeiro.
 */

import { Module, type DynamicModule } from '@nestjs/common';
import { loadConfig } from '../config/env.schema';
import { DocsController } from './docs.controller';

@Module({})
export class DocsModule {
  static register(): DynamicModule {
    const enabled = loadConfig().ENABLE_SWAGGER;
    return {
      module: DocsModule,
      controllers: enabled ? [DocsController] : [],
    };
  }
}
