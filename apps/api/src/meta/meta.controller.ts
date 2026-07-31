/**
 * Arden.AS API — endpoint técnico de metadados (ARDEN-BE-001).
 * `GET /api/v1/meta`: versão da API, versão da aplicação, ambiente e commit SHA
 * (quando disponível). Sem informações sensíveis. Não é endpoint de negócio.
 */

import { Public } from '../authz/decorators';
import { Controller, Get, Inject } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/env.schema';

const API_VERSION = 'v1';

@Controller('meta')
@Public()
export class MetaController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  meta() {
    return {
      apiVersion: API_VERSION,
      appVersion: this.config.APP_VERSION,
      environment: this.config.NODE_ENV,
      commit: this.config.GIT_SHA || null,
    };
  }
}
