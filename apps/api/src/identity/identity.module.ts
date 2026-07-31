/** Arden.AS API — módulo de identidade (ARDEN-BE-002). */

import { Module } from '@nestjs/common';
import { IdentityProviderModule } from './identity-provider.module';
import { IdentityAuditService } from './identity-audit.service';
import { UserProvisioningService } from './user-provisioning.service';

@Module({
  imports: [IdentityProviderModule],
  providers: [IdentityAuditService, UserProvisioningService],
  exports: [IdentityAuditService, UserProvisioningService, IdentityProviderModule],
})
export class IdentityModule {}
