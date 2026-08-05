/**
 * Arden.AS API — preflight criptográfico compartilhado (ARDEN-PRD-001.1D).
 *
 * Fonte ÚNICA de verdade para API, worker e CLI decidirem se o keyring é utilizável.
 * Valida que existe uma PRIMARY e que TODAS as versões de keyVersion referenciadas por
 * credenciais no banco estão disponíveis no keyring. Resultado IMUTÁVEL e SANITIZADO —
 * nunca contém material de chave, tenant ID ou credential ID.
 *
 * `status: MISSING_VERSIONS` ou `NO_PRIMARY` deve levar API/worker a NÃO ficarem ready
 * (fail-closed). Não decifra segredos.
 */

import { Injectable } from '@nestjs/common';
import { ConnectorKeyProvider } from '../connectors/vault/connector-key-provider';
import { PrismaService } from '../database/prisma.service';

export interface ConnectorMasterKeyPreflightResult {
  readonly primaryKeyVersion: string | null;
  readonly availableVersions: readonly string[];
  readonly referencedVersions: readonly string[];
  readonly missingVersions: readonly string[];
  readonly status: 'OK' | 'MISSING_VERSIONS' | 'NO_PRIMARY';
}

/** Porta de leitura das versões referenciadas (Prisma em prod; fake em unit). */
export interface ReferencedVersionsReader {
  distinctReferencedVersions(): Promise<string[]>;
}

export async function computeConnectorMasterKeyPreflight(
  keyring: { primaryVersion: string; availableVersions: string[]; hasPrimary: boolean },
  referenced: readonly string[],
): Promise<ConnectorMasterKeyPreflightResult> {
  const available = new Set(keyring.availableVersions);
  const referencedSorted = Array.from(new Set(referenced)).sort();
  const missing = referencedSorted.filter((v) => !available.has(v));
  let status: ConnectorMasterKeyPreflightResult['status'];
  if (!keyring.hasPrimary) status = 'NO_PRIMARY';
  else if (missing.length > 0) status = 'MISSING_VERSIONS';
  else status = 'OK';
  return {
    primaryKeyVersion: keyring.hasPrimary ? keyring.primaryVersion : null,
    availableVersions: keyring.availableVersions,
    referencedVersions: referencedSorted,
    missingVersions: missing,
    status,
  };
}

@Injectable()
export class ConnectorMasterKeyPreflightService {
  constructor(
    private readonly keys: ConnectorKeyProvider,
    private readonly prisma: PrismaService,
  ) {}

  private async referencedVersions(): Promise<string[]> {
    const rows = await this.prisma.connectionCredentialVersion.findMany({
      where: { status: 'ACTIVE', keyVersion: { not: null } },
      distinct: ['keyVersion'],
      select: { keyVersion: true },
    });
    return rows.map((r) => r.keyVersion).filter((v): v is string => !!v);
  }

  /** Preflight completo (keyring + banco). Fail-closed → status != OK. */
  async run(): Promise<ConnectorMasterKeyPreflightResult> {
    const referenced = await this.referencedVersions();
    return computeConnectorMasterKeyPreflight(this.keys.describeKeyring(), referenced);
  }

  /** Conveniência booleana para readiness. */
  async isReady(): Promise<boolean> {
    const r = await this.run();
    return r.status === 'OK';
  }
}
