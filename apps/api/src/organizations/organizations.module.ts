/** Arden.AS API — módulo de organizações (ARDEN-BE-002). */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuthzModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
