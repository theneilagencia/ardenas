/**
 * Arden.AS API — adapter Prisma da porta de recriptografia (ARDEN-PRD-001.1D).
 *
 * COMPARE-AND-SET real: a atualização só ocorre se `id` ainda estiver com o
 * `keyVersion` e o `encryptedSecret` lidos (WHERE inclui os dois). Alteração concorrente
 * → 0 linhas afetadas → o serviço marca `skippedConcurrentChange`. Só toca material
 * criptográfico; nunca dados funcionais.
 */

import type {
  ReencryptionDb,
  ReencryptableCredentialRow,
} from './connector-credential-reencryption.service';

/** Subconjunto do PrismaClient usado (facilita teste e evita acoplar ao tipo completo). */
export interface ReencryptionPrismaLike {
  connectionCredentialVersion: {
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    count(args: unknown): Promise<number>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
}

export class PrismaReencryptionDb implements ReencryptionDb {
  constructor(private readonly prisma: ReencryptionPrismaLike) {}

  private eligibleWhere(primaryVersion: string, sourceVersion?: string) {
    return {
      status: 'ACTIVE',
      encryptedSecret: { not: null },
      nonce: { not: null },
      authTag: { not: null },
      keyVersion: sourceVersion ? sourceVersion : { not: primaryVersion },
      ...(sourceVersion ? {} : {}),
    };
  }

  async countEligible(primaryVersion: string, sourceVersion?: string): Promise<number> {
    // Quando sourceVersion === primaryVersion, nada é elegível.
    if (sourceVersion && sourceVersion === primaryVersion) return 0;
    return this.prisma.connectionCredentialVersion.count({ where: this.eligibleWhere(primaryVersion, sourceVersion) });
  }

  async distinctReferencedVersions(): Promise<string[]> {
    const rows = (await this.prisma.connectionCredentialVersion.findMany({
      where: { status: 'ACTIVE', keyVersion: { not: null } },
      distinct: ['keyVersion'],
      select: { keyVersion: true },
    })) as Array<{ keyVersion: string | null }>;
    return rows.map((r) => r.keyVersion).filter((v): v is string => !!v);
  }

  async findEligibleBatch(primaryVersion: string, limit: number, sourceVersion?: string): Promise<ReencryptableCredentialRow[]> {
    if (sourceVersion && sourceVersion === primaryVersion) return [];
    const rows = (await this.prisma.connectionCredentialVersion.findMany({
      where: this.eligibleWhere(primaryVersion, sourceVersion),
      select: { id: true, organizationId: true, connectionId: true, encryptedSecret: true, nonce: true, authTag: true, keyVersion: true },
      orderBy: { id: 'asc' },
      take: limit,
    })) as Array<{ id: string; organizationId: string; connectionId: string; encryptedSecret: string | null; nonce: string | null; authTag: string | null; keyVersion: string | null }>;
    return rows
      .filter((r) => r.encryptedSecret && r.nonce && r.authTag && r.keyVersion)
      .map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        connectionId: r.connectionId,
        encryptedSecret: r.encryptedSecret as string,
        nonce: r.nonce as string,
        authTag: r.authTag as string,
        keyVersion: r.keyVersion as string,
      }));
  }

  async casReencrypt(input: {
    id: string;
    expectedKeyVersion: string;
    expectedCiphertext: string;
    newCiphertext: string;
    newNonce: string;
    newAuthTag: string;
    newKeyVersion: string;
    algorithm: string;
  }): Promise<number> {
    const res = await this.prisma.connectionCredentialVersion.updateMany({
      where: {
        id: input.id,
        status: 'ACTIVE',
        keyVersion: input.expectedKeyVersion,
        encryptedSecret: input.expectedCiphertext, // guarda CAS: estado inalterado
      },
      data: {
        encryptedSecret: input.newCiphertext,
        nonce: input.newNonce,
        authTag: input.newAuthTag,
        keyVersion: input.newKeyVersion,
        algorithm: input.algorithm,
      },
    });
    return res.count;
  }
}
