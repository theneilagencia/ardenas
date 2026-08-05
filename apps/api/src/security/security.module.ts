/**
 * Arden.AS API — módulo de segurança de plataforma (ARDEN-PRD-001.1D).
 *
 * Provê o preflight criptográfico compartilhado (API/worker/CLI reutilizam a MESMA
 * lógica). `ConnectorKeyProvider` é stateless (lê a config global) — provido aqui para o
 * preflight sem acoplar ao ConnectorsModule. `PrismaService` e `APP_CONFIG` são globais.
 */

import { Module } from '@nestjs/common';
import { ConnectorKeyProvider } from '../connectors/vault/connector-key-provider';
import { ConnectorMasterKeyPreflightService } from './connector-master-key-preflight.service';

@Module({
  providers: [ConnectorKeyProvider, ConnectorMasterKeyPreflightService],
  exports: [ConnectorMasterKeyPreflightService],
})
export class SecurityModule {}
