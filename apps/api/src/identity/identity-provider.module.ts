/**
 * Arden.AS API — módulo do provedor de identidade (ARDEN-BE-002).
 * Resolve o `IdentityProvider` por configuração (AUTH_PROVIDER), em UM só ponto.
 * Sem fallback silencioso: `fake` é bloqueado em production pela validação de env.
 */

import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/env.schema';
import { IDENTITY_PROVIDER, type IdentityProvider } from './identity.types';
import { SupabaseIdentityProvider } from './supabase-identity.provider';
import { FakeIdentityProvider } from './fake-identity.provider';

@Global()
@Module({
  providers: [
    {
      provide: IDENTITY_PROVIDER,
      useFactory: (config: AppConfig): IdentityProvider =>
        config.AUTH_PROVIDER === 'fake'
          ? new FakeIdentityProvider()
          : new SupabaseIdentityProvider(config),
      inject: [APP_CONFIG],
    },
  ],
  exports: [IDENTITY_PROVIDER],
})
export class IdentityProviderModule {}
