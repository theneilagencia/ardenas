/**
 * Arden.AS API — pipeline de recriptografia de credenciais (ARDEN-PRD-001.1D).
 *
 * Migra ciphertext de credenciais cifradas com uma versão ANTIGA da master key para a
 * versão PRIMARY atual, SEM indisponibilidade e SEM tocar em dados funcionais
 * (organizationId, connectionId, versionNumber, status, ownership, metadata de negócio).
 *
 * Fluxo por registro: seleciona elegível → decifra com a versão registrada → cifra com a
 * PRIMARY → atualiza por COMPARE-AND-SET (só se o estado lido ainda vale) → descarta
 * plaintext. Idempotente (registros já em PRIMARY são ignorados), retomável (deriva do
 * estado do banco), tolerante a concorrência (alteração concorrente → skip, nunca
 * sobrescreve o vencedor). Nenhum plaintext/ciphertext/segredo em log ou retorno.
 */

import { buildAad, decrypt, encrypt, VAULT_ALGORITHM } from '../connectors/vault/aes-gcm';
import { ConnectorKeyProvider } from '../connectors/vault/connector-key-provider';

/** Linha mínima necessária (só material criptográfico + identidade técnica). */
export interface ReencryptableCredentialRow {
  id: string;
  organizationId: string;
  connectionId: string;
  encryptedSecret: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
}

/** Porta de banco estreita — implementada por Prisma (prod) e por um fake (unit). */
export interface ReencryptionDb {
  /** Conta credenciais ACTIVE com material presente e keyVersion != primária. */
  countEligible(primaryVersion: string, sourceVersion?: string): Promise<number>;
  /** Versões de keyVersion efetivamente referenciadas por credenciais ACTIVE. */
  distinctReferencedVersions(): Promise<string[]>;
  /** Um lote de linhas elegíveis (ACTIVE, material presente, keyVersion != primária). */
  findEligibleBatch(primaryVersion: string, limit: number, sourceVersion?: string): Promise<ReencryptableCredentialRow[]>;
  /**
   * COMPARE-AND-SET: atualiza o material SÓ se `id` ainda estiver com o `keyVersion` e o
   * `encryptedSecret` lidos (estado inalterado). Retorna a contagem afetada (0 ou 1).
   */
  casReencrypt(input: {
    id: string;
    expectedKeyVersion: string;
    expectedCiphertext: string;
    newCiphertext: string;
    newNonce: string;
    newAuthTag: string;
    newKeyVersion: string;
    algorithm: string;
  }): Promise<number>;
}

export type ReencryptionSkipReason =
  | 'UNKNOWN_KEY_VERSION'
  | 'AUTHENTICATION_FAILED'
  | 'MALFORMED_CIPHERTEXT'
  | 'CONCURRENT_CHANGE'
  | 'DATABASE_ERROR';

export interface ReencryptionInspection {
  primaryKeyVersion: string;
  referencedVersions: string[];
  eligibleCount: number;
  missingVersions: string[];
}

export interface ReencryptionBatchResult {
  scanned: number;
  eligible: number;
  reencrypted: number;
  skippedAlreadyPrimary: number;
  skippedConcurrentChange: number;
  failed: number;
  failureReasons: Partial<Record<ReencryptionSkipReason, number>>;
  sourceVersions: string[];
  targetVersion: string;
  hasMore: boolean;
}

export class ConnectorCredentialReencryptionService {
  constructor(
    private readonly db: ReencryptionDb,
    private readonly keys: ConnectorKeyProvider,
  ) {}

  async inspect(input: { sourceVersion?: string } = {}): Promise<ReencryptionInspection> {
    const primary = this.keys.getCurrentKey().version;
    const referenced = await this.db.distinctReferencedVersions();
    const missing = referenced.filter((v) => {
      try {
        this.keys.getKey(v);
        return false;
      } catch {
        return true;
      }
    });
    const eligibleCount = await this.db.countEligible(primary, input.sourceVersion);
    return { primaryKeyVersion: primary, referencedVersions: [...referenced].sort(), eligibleCount, missingVersions: missing.sort() };
  }

  /** Processa UM lote (transações curtas, memória estável). Não retorna ciphertext. */
  async runBatch(input: { batchSize: number; sourceVersion?: string; dryRun?: boolean }): Promise<ReencryptionBatchResult> {
    const primary = this.keys.getCurrentKey();
    const limit = Math.max(1, Math.min(input.batchSize, 500));
    const rows = await this.db.findEligibleBatch(primary.version, limit, input.sourceVersion);
    const result: ReencryptionBatchResult = {
      scanned: rows.length,
      eligible: rows.length,
      reencrypted: 0,
      skippedAlreadyPrimary: 0,
      skippedConcurrentChange: 0,
      failed: 0,
      failureReasons: {},
      sourceVersions: [],
      targetVersion: primary.version,
      hasMore: rows.length === limit,
    };
    const sources = new Set<string>();

    for (const row of rows) {
      if (row.keyVersion === primary.version) {
        result.skippedAlreadyPrimary += 1;
        continue;
      }
      sources.add(row.keyVersion);
      // Decifra com a versão registrada.
      let plaintext: string;
      try {
        const oldKey = this.keys.getKey(row.keyVersion); // lança se versão desconhecida
        const oldAad = buildAad({ organizationId: row.organizationId, connectionId: row.connectionId, credentialVersionId: row.id, keyVersion: row.keyVersion });
        plaintext = decrypt({ ciphertext: row.encryptedSecret, nonce: row.nonce, authTag: row.authTag }, oldKey.key, oldAad);
      } catch (err) {
        this.recordFailure(result, classifyDecryptError(err));
        continue;
      }
      if (input.dryRun) {
        plaintext = ''; // descarta; dry-run não escreve
        result.reencrypted += 1; // "seria recriptografado"
        continue;
      }
      // Cifra com a PRIMARY (mesma AAD exceto keyVersion) e faz CAS.
      try {
        const newAad = buildAad({ organizationId: row.organizationId, connectionId: row.connectionId, credentialVersionId: row.id, keyVersion: primary.version });
        const envelope = encrypt(plaintext, primary.key, newAad);
        plaintext = ''; // descarta plaintext imediatamente
        const affected = await this.db.casReencrypt({
          id: row.id,
          expectedKeyVersion: row.keyVersion,
          expectedCiphertext: row.encryptedSecret,
          newCiphertext: envelope.ciphertext,
          newNonce: envelope.nonce,
          newAuthTag: envelope.authTag,
          newKeyVersion: primary.version,
          algorithm: VAULT_ALGORITHM,
        });
        if (affected === 1) result.reencrypted += 1;
        else result.skippedConcurrentChange += 1; // alteração concorrente venceu — não sobrescreve
      } catch {
        this.recordFailure(result, 'DATABASE_ERROR');
      }
    }
    result.sourceVersions = Array.from(sources).sort();
    return result;
  }

  private recordFailure(result: ReencryptionBatchResult, reason: ReencryptionSkipReason): void {
    result.failed += 1;
    result.failureReasons[reason] = (result.failureReasons[reason] ?? 0) + 1;
  }
}

function classifyDecryptError(err: unknown): ReencryptionSkipReason {
  const msg = err instanceof Error ? err.message : '';
  if (/version unavailable|32 bytes/i.test(msg)) return 'UNKNOWN_KEY_VERSION';
  // decipher.final() lança em auth tag/AAD inválida; JSON malformado etc.
  return 'AUTHENTICATION_FAILED';
}
