/** Arden.AS API — módulo de sessão (ARDEN-BE-002). */

import { Module } from '@nestjs/common';
import { AuthzModule } from '../authz/authz.module';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

@Module({
  imports: [AuthzModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
