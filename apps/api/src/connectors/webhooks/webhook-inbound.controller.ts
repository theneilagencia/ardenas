/**
 * Arden.AS API — controller PÚBLICO de webhook de entrada (ARDEN-BE-006.7).
 *
 * FINO. `@Public` (sem Bearer de sessão). NÃO aceita organizationId do cliente — o
 * tenant vem do endpoint persistido. Lê o RAW BODY (bytes originais, para HMAC),
 * limita o tamanho e delega toda a lógica ao `WebhookInboundService`. Resposta pública
 * mínima; erros não revelam tenant/assinatura/existência do endpoint.
 */

import { Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../authz/decorators';
import { requestTooLarge } from '../../common/errors/api-error';
import { WebhookInboundService } from './webhook-inbound.service';

@Controller('webhooks')
export class WebhookInboundController {
  constructor(private readonly inbound: WebhookInboundService) {}

  @Post(':endpointToken')
  @Public()
  @HttpCode(202)
  async receive(@Param('endpointToken') endpointToken: string, @Req() req: FastifyRequest & { rawBody?: Buffer }) {
    const raw = req.rawBody ?? (typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.from(req.body ? JSON.stringify(req.body) : ''));
    if (!Buffer.isBuffer(raw)) throw requestTooLarge();
    const ip = req.ip ?? 'unknown';
    const result = await this.inbound.receive(endpointToken, raw, req.headers as Record<string, string | string[] | undefined>, ip);
    return { data: result };
  }
}
