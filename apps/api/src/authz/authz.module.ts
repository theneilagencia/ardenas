/**
 * Arden.AS API — módulo de autorização (ARDEN-BE-002).
 * Registra os guards GLOBAIS na ordem: autenticação → usuário ativo →
 * organização → permissão. Guards separados e testáveis (sem guard monolítico).
 */

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IdentityModule } from '../identity/identity.module';
import { AuthorizationService } from './authorization.service';
import { AuthenticationGuard } from './guards/authentication.guard';
import { ActiveUserGuard } from './guards/active-user.guard';
import { OrganizationGuard } from './guards/organization.guard';
import { PermissionGuard } from './guards/permission.guard';

@Module({
  imports: [IdentityModule],
  providers: [
    AuthorizationService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: ActiveUserGuard },
    { provide: APP_GUARD, useClass: OrganizationGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AuthorizationService, IdentityModule],
})
export class AuthzModule {}
