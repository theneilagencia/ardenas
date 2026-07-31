/**
 * Arden.AS API — módulo de configuração (ARDEN-BE-001).
 * Valida o ambiente uma vez no bootstrap e provê o `AppConfig` tipado (token
 * APP_CONFIG). Global — disponível para toda a aplicação.
 */

import { Global, Module } from '@nestjs/common';
import { loadConfig, type AppConfig } from './env.schema';

export const APP_CONFIG = 'APP_CONFIG';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
