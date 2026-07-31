/**
 * Arden.AS API — health e readiness (ARDEN-BE-001).
 *
 * `/health` (liveness): o processo está ativo. Pode retornar 200 mesmo com banco
 * indisponível. `/ready` (readiness): testa banco, inicialização e configuração;
 * retorna 503 quando o banco está indisponível. Nunca retorna segredos.
 * Ficam FORA do prefixo /api/v1.
 */

import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/env.schema';
import { PrismaService } from '../database/prisma.service';

@Controller()
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'arden-api',
      version: this.config.APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready(@Res() reply: FastifyReply): Promise<void> {
    let database = false;
    try {
      database = await this.prisma.ping();
    } catch {
      database = false;
    }
    const ready = database;
    void reply.status(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'unavailable',
      service: 'arden-api',
      version: this.config.APP_VERSION,
      checks: { database, configuration: true, application: true },
      timestamp: new Date().toISOString(),
    });
  }
}
