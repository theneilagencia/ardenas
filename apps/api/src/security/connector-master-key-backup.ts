/**
 * Arden.AS API — backup e restore da connector master-key keyring (ARDEN-PRD-001.1C).
 *
 * Produz um artefato CIFRADO e AUTENTICADO do keyring, embrulhado por uma WRAPPING KEY
 * SEPARADA (vinda do PlatformSecretSource — NUNCA derivada da própria master key, NUNCA
 * fixa em código). O artefato:
 * - é versionado (formatVersion) e verificável (checksum SHA-256 do payload cifrado);
 * - não contém plaintext de chave, nem a wrapping key, nem secrets de tenants, nem
 *   credenciais de banco;
 * - falha FECHADA em wrapping key errada, artefato/checksum adulterado ou auth tag inválida.
 *
 * `verifyRestore` decifra em memória isolada, valida o keyring e testa um decrypt com
 * fixture controlada, descartando o plaintext. NUNCA altera o ambiente ativo.
 */

import { createHash } from 'node:crypto';
import { encrypt, decrypt, type EncryptedEnvelope } from '../connectors/vault/aes-gcm';
import {
  buildConnectorMasterKeyring,
  type ConnectorMasterKeyring,
  MasterKeyConfigurationError,
} from './connector-master-keyring';

export const MASTER_KEY_BACKUP_FORMAT_VERSION = 1 as const;

export interface ConnectorMasterKeyBackupManifest {
  formatVersion: number;
  createdAt: string;
  environment: string;
  primaryKeyVersion: string;
  includedKeyVersions: string[];
  encryptionMethod: 'AES-256-GCM';
  checksum: string; // SHA-256 (hex) do ciphertext
  metadata: Record<string, string>;
}

export interface ConnectorMasterKeyBackupArtifact {
  manifest: ConnectorMasterKeyBackupManifest;
  envelope: EncryptedEnvelope; // payload cifrado (keyring em Base64 por versão)
}

export class MasterKeyBackupError extends Error {
  constructor(
    readonly code:
      | 'MASTER_KEY_BACKUP_INVALID'
      | 'MASTER_KEY_RESTORE_VERIFICATION_FAILED',
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'MasterKeyBackupError';
  }
}

/** AAD determinística do backup — vincula formato+ambiente+primária (não é secret). */
function backupAad(environment: string, primaryKeyVersion: string): Buffer {
  return Buffer.from(`master-key-backup\tv${MASTER_KEY_BACKUP_FORMAT_VERSION}\t${environment}\t${primaryKeyVersion}`, 'utf8');
}

/** Payload canônico: mapa version→Base64(32 bytes). Determinístico (versões ordenadas). */
function serializeKeyring(keyring: ConnectorMasterKeyring): string {
  const all = [keyring.primary, ...keyring.decryptKeys].sort((a, b) => a.version.localeCompare(b.version));
  const map: Record<string, string> = {};
  for (const k of all) map[k.version] = k.key.toString('base64');
  return JSON.stringify({ primaryVersion: keyring.primary.version, keys: map });
}

function sha256Hex(b64: string): string {
  return createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex');
}

export function createConnectorMasterKeyBackup(input: {
  keyring: ConnectorMasterKeyring;
  wrappingKey: Buffer; // 32 bytes, SEPARADA da master key
  environment: string;
  createdAt: string; // fornecido pelo chamador (determinismo/testes)
  metadata?: Record<string, string>;
}): ConnectorMasterKeyBackupArtifact {
  if (input.wrappingKey.length !== 32) {
    throw new MasterKeyBackupError('MASTER_KEY_BACKUP_INVALID', 'wrapping key must be 32 bytes');
  }
  const primaryVersion = input.keyring.primary.version;
  const aad = backupAad(input.environment, primaryVersion);
  const envelope = encrypt(serializeKeyring(input.keyring), input.wrappingKey, aad);
  const includedKeyVersions = [input.keyring.primary.version, ...input.keyring.decryptKeys.map((k) => k.version)].sort();
  const manifest: ConnectorMasterKeyBackupManifest = {
    formatVersion: MASTER_KEY_BACKUP_FORMAT_VERSION,
    createdAt: input.createdAt,
    environment: input.environment,
    primaryKeyVersion: primaryVersion,
    includedKeyVersions,
    encryptionMethod: 'AES-256-GCM',
    checksum: sha256Hex(envelope.ciphertext),
    metadata: input.metadata ?? {},
  };
  return { manifest, envelope };
}

/**
 * Restaura o keyring do artefato — SOMENTE em memória (não toca ambiente ativo). Falha
 * FECHADA em formato/checksum inválido, wrapping key errada ou auth tag adulterada.
 */
export function restoreConnectorMasterKeyBackup(
  artifact: ConnectorMasterKeyBackupArtifact,
  wrappingKey: Buffer,
): ConnectorMasterKeyring {
  const { manifest, envelope } = artifact;
  if (manifest.formatVersion !== MASTER_KEY_BACKUP_FORMAT_VERSION) {
    throw new MasterKeyBackupError('MASTER_KEY_BACKUP_INVALID', `unsupported formatVersion ${manifest.formatVersion}`);
  }
  if (wrappingKey.length !== 32) {
    throw new MasterKeyBackupError('MASTER_KEY_BACKUP_INVALID', 'wrapping key must be 32 bytes');
  }
  if (sha256Hex(envelope.ciphertext) !== manifest.checksum) {
    throw new MasterKeyBackupError('MASTER_KEY_BACKUP_INVALID', 'checksum mismatch');
  }
  const aad = backupAad(manifest.environment, manifest.primaryKeyVersion);
  let plaintext: string;
  try {
    plaintext = decrypt(envelope, wrappingKey, aad); // lança em auth tag/AAD/chave inválida
  } catch {
    throw new MasterKeyBackupError('MASTER_KEY_RESTORE_VERIFICATION_FAILED', 'decrypt failed (wrong wrapping key or tampered artifact)');
  }
  let parsed: { primaryVersion: string; keys: Record<string, string> };
  try {
    parsed = JSON.parse(plaintext) as { primaryVersion: string; keys: Record<string, string> };
  } catch {
    throw new MasterKeyBackupError('MASTER_KEY_RESTORE_VERIFICATION_FAILED', 'malformed payload');
  } finally {
    plaintext = ''; // descarta plaintext
  }
  try {
    return buildConnectorMasterKeyring({ primaryVersion: parsed.primaryVersion, keys: parsed.keys });
  } catch (err) {
    if (err instanceof MasterKeyConfigurationError) {
      throw new MasterKeyBackupError('MASTER_KEY_RESTORE_VERIFICATION_FAILED', 'restored keyring invalid');
    }
    throw err;
  }
}

/** Resultado SANITIZADO da verificação de restore — nunca contém material de chave. */
export interface RestoreVerificationResult {
  formatVersion: number;
  environment: string;
  primaryKeyVersion: string;
  includedKeyVersions: string[];
  checksumValid: boolean;
  keyringValid: boolean;
  expectedVersionsPresent: boolean;
  status: 'PASS' | 'FAIL';
}

/**
 * Verifica um restore sem alterar o ambiente ativo: valida formato, checksum, auth tag,
 * decifra em isolamento, valida o keyring e confere as versões esperadas. Retorna relatório
 * sanitizado. Fail-closed → status FAIL (não lança para permitir relatório).
 */
export function verifyConnectorMasterKeyRestore(
  artifact: ConnectorMasterKeyBackupArtifact,
  wrappingKey: Buffer,
  expectedVersions: readonly string[],
): RestoreVerificationResult {
  const base: RestoreVerificationResult = {
    formatVersion: artifact.manifest.formatVersion,
    environment: artifact.manifest.environment,
    primaryKeyVersion: artifact.manifest.primaryKeyVersion,
    includedKeyVersions: artifact.manifest.includedKeyVersions,
    checksumValid: false,
    keyringValid: false,
    expectedVersionsPresent: false,
    status: 'FAIL',
  };
  try {
    const keyring = restoreConnectorMasterKeyBackup(artifact, wrappingKey);
    const present = new Set([keyring.primary.version, ...keyring.decryptKeys.map((k) => k.version)]);
    const expectedOk = expectedVersions.every((v) => present.has(v));
    return {
      ...base,
      checksumValid: true,
      keyringValid: true,
      expectedVersionsPresent: expectedOk,
      status: expectedOk ? 'PASS' : 'FAIL',
    };
  } catch {
    return base;
  }
}
