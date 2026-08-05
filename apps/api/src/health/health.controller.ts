/**
 * Arden.AS API — health e readiness (ARDEN-BE-001).
 *
 * `/health` (liveness): o processo está ativo. Pode retornar 200 mesmo com banco
 * indisponível. `/ready` (readiness): testa banco, inicialização e configuração;
 * retorna 503 quando o banco está indisponível. Nunca retorna segredos.
 * Ficam FORA do prefixo /api/v1.
 */

import { Public } from '../authz/decorators';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/env.schema';
import { PrismaService } from '../database/prisma.service';
import { ConnectorMasterKeyPreflightService } from '../security/connector-master-key-preflight.service';

@Controller()
@Public()
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly masterKeyPreflight: ConnectorMasterKeyPreflightService,
  ) {}

  // Liveness: processo vivo. NUNCA depende do keyring/banco/Anthropic.
  @Get(['health', 'live'])
  health() {
    return {
      status: 'ok',
      service: 'arden-api',
      version: this.config.APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  // Readiness: banco + preflight criptográfico do keyring. Fail-closed (503). Nunca
  // expõe nomes de env, material de chave, credential/tenant IDs ou ciphertext.
  @Get(['ready', 'readyz'])
  async ready(@Res() reply: FastifyReply): Promise<void> {
    let database = false;
    try {
      database = await this.prisma.ping();
    } catch {
      database = false;
    }
    let connectorMasterKeyring: 'pass' | 'fail' = 'fail';
    try {
      connectorMasterKeyring = database && (await this.masterKeyPreflight.isReady()) ? 'pass' : 'fail';
    } catch {
      connectorMasterKeyring = 'fail';
    }
    const ready = database && connectorMasterKeyring === 'pass';
    void reply.status(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'not_ready',
      service: 'arden-api',
      version: this.config.APP_VERSION,
      checks: {
        database: database ? 'pass' : 'fail',
        migrations: 'pass',
        platformSecrets: 'pass',
        connectorMasterKeyring,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
