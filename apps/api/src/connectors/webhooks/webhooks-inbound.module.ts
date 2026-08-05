/**
 * Arden.AS API — módulo do webhook de ENTRADA (ARDEN-BE-006.7).
 *
 * Isola o controller público e o serviço de entrada, importando o ConnectorsModule
 * (repos/serviços de webhook, cofre) e o ExecutionsModule (criação de execução pelo
 * motor do BE-005). Fica em um módulo próprio para evitar dependência circular entre
 * ConnectorsModule e ExecutionsModule.
 */

import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { ConnectorsModule } from '../connectors.module';
import { ExecutionsModule } from '../../executions/executions.module';
import { WebhookInboundController } from './webhook-inbound.controller';
import { WebhookInboundService } from './webhook-inbound.service';

@Module({
  imports: [ConnectorsModule, ExecutionsModule, AuditModule],
  controllers: [WebhookInboundController],
  providers: [WebhookInboundService],
})
export class WebhooksInboundModule {}
