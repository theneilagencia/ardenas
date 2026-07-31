/**
 * Arden.AS API — endpoints de sessão (ARDEN-BE-002).
 * Implementa os contratos do ARDEN-FE-003. Requer autenticação (não é público).
 * Nunca retorna token/segredo. Rate limit específico aplicado.
 */

import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  switchOrganizationRequest,
  type SessionContext,
  type SwitchOrganizationRequest,
} from '@arden/contracts';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { CurrentContext, type AuthenticatedRequestContext } from '../identity/request-context';
import { SessionService } from './session.service';

@Controller('session')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class SessionController {
  constructor(private readonly session: SessionService) {}

  @Get()
  async get(@CurrentContext() ctx: AuthenticatedRequestContext): Promise<{ data: SessionContext }> {
    return { data: await this.session.getSession(ctx) };
  }

  @Post('refresh')
  async refresh(
    @CurrentContext() ctx: AuthenticatedRequestContext,
  ): Promise<{ data: SessionContext }> {
    return { data: await this.session.refresh(ctx) };
  }

  @Post('switch-organization')
  async switchOrganization(
    @CurrentContext() ctx: AuthenticatedRequestContext,
    @Body(new ZodValidationPipe(switchOrganizationRequest)) body: SwitchOrganizationRequest,
  ): Promise<{ data: SessionContext }> {
    return { data: await this.session.switchOrganization(ctx, body.organizationId) };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentContext() ctx: AuthenticatedRequestContext): Promise<void> {
    await this.session.logout(ctx);
  }
}
