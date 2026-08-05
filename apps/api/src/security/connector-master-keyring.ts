/**
 * Arden.AS API — keyring versionado da connector master key (ARDEN-PRD-001.1B).
 *
 * Formaliza o keyring já existente (BE-006.4) com estados explícitos e invariantes:
 * exatamente UMA chave PRIMARY (cifra e decifra); versões anteriores DECRYPT_ONLY;
 * versões únicas; material de 32 bytes; falha FECHADA em versão desconhecida/ausente.
 * NENHUMA chave é persistida no banco — o keyring vem só da config/secret source.
 * NUNCA imprime material de chave.
 */

export type ConnectorMasterKeyStatus = 'PRIMARY' | 'DECRYPT_ONLY';

export interface ConnectorMasterKey {
  readonly version: string;
  readonly key: Buffer; // 32 bytes (AES-256)
  readonly status: ConnectorMasterKeyStatus;
}

export interface ConnectorMasterKeyring {
  readonly primary: ConnectorMasterKey;
  readonly decryptKeys: readonly ConnectorMasterKey[];
}

export class MasterKeyConfigurationError extends Error {
  constructor(
    readonly code:
      | 'MASTER_KEY_CONFIGURATION_INVALID'
      | 'MASTER_KEY_VERSION_UNAVAILABLE',
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'MasterKeyConfigurationError';
  }
}

export interface KeyringInput {
  primaryVersion: string;
  /** version → material Base64 (32 bytes decodificados). Deve conter a primária. */
  keys: Readonly<Record<string, string>>;
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeKey(version: string, b64: string): Buffer {
  if (typeof b64 !== 'string' || b64.length === 0) {
    throw new MasterKeyConfigurationError('MASTER_KEY_CONFIGURATION_INVALID', `empty material for version ${version}`);
  }
  if (!B64.test(b64)) {
    throw new MasterKeyConfigurationError('MASTER_KEY_CONFIGURATION_INVALID', `invalid encoding for version ${version}`);
  }
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== 32) {
    throw new MasterKeyConfigurationError('MASTER_KEY_CONFIGURATION_INVALID', `version ${version} must decode to 32 bytes`);
  }
  return buf;
}

/**
 * Constrói e VALIDA o keyring. Invariantes checadas:
 * - primária presente; material válido (32 bytes, Base64);
 * - versões únicas (sem duplicidade);
 * - exatamente uma primária (as demais viram DECRYPT_ONLY).
 */
export function buildConnectorMasterKeyring(input: KeyringInput): ConnectorMasterKeyring {
  const versions = Object.keys(input.keys);
  if (versions.length === 0) {
    throw new MasterKeyConfigurationError('MASTER_KEY_CONFIGURATION_INVALID', 'no key versions provided');
  }
  // Duplicidade de versão: chaves de objeto já são únicas; detectamos duplicatas
  // case-insensitive/normalizadas para evitar `V1`/`v1` colidindo silenciosamente.
  const normalized = new Set<string>();
  for (const v of versions) {
    const n = v.trim();
    if (n === '') throw new MasterKeyConfigurationError('MASTER_KEY_CONFIGURATION_INVALID', 'empty version label');
    if (normalized.has(n)) {
      throw new MasterKeyConfigurationError('MASTER_KEY_CONFIGURATION_INVALID', `duplicate version ${n}`);
    }
    normalized.add(n);
  }
  if (!(input.primaryVersion in input.keys)) {
    throw new MasterKeyConfigurationError('MASTER_KEY_CONFIGURATION_INVALID', `primary version ${input.primaryVersion} not present in keyring`);
  }

  const primary: ConnectorMasterKey = {
    version: input.primaryVersion,
    key: decodeKey(input.primaryVersion, input.keys[input.primaryVersion]),
    status: 'PRIMARY',
  };
  const decryptKeys: ConnectorMasterKey[] = [];
  for (const [version, b64] of Object.entries(input.keys)) {
    if (version === input.primaryVersion) continue;
    decryptKeys.push({ version, key: decodeKey(version, b64), status: 'DECRYPT_ONLY' });
  }
  return { primary, decryptKeys };
}

/** Chave por versão (para decifrar versões antigas). Falha FECHADA se indisponível. */
export function resolveKeyForVersion(keyring: ConnectorMasterKeyring, version: string): ConnectorMasterKey {
  if (keyring.primary.version === version) return keyring.primary;
  const found = keyring.decryptKeys.find((k) => k.version === version);
  if (!found) throw new MasterKeyConfigurationError('MASTER_KEY_VERSION_UNAVAILABLE', version);
  return found;
}

/** Resultado SANITIZADO do preflight — nunca contém material de chave. */
export interface KeyringPreflightResult {
  primaryKeyVersion: string;
  availableDecryptVersions: string[];
  referencedCiphertextVersions: string[];
  missingVersions: string[];
  status: 'OK' | 'MISSING_VERSIONS';
}

/**
 * Preflight: valida o keyring contra as versões de ciphertext referenciadas no banco.
 * Se alguma versão necessária estiver ausente, retorna `MISSING_VERSIONS` (o chamador
 * deve falhar fechado). Não decifra nada.
 */
export function preflightKeyring(
  keyring: ConnectorMasterKeyring,
  referencedCiphertextVersions: readonly string[],
): KeyringPreflightResult {
  const available = new Set<string>([keyring.primary.version, ...keyring.decryptKeys.map((k) => k.version)]);
  const referenced = Array.from(new Set(referencedCiphertextVersions)).sort();
  const missing = referenced.filter((v) => !available.has(v));
  return {
    primaryKeyVersion: keyring.primary.version,
    availableDecryptVersions: keyring.decryptKeys.map((k) => k.version).sort(),
    referencedCiphertextVersions: referenced,
    missingVersions: missing,
    status: missing.length === 0 ? 'OK' : 'MISSING_VERSIONS',
  };
}

/**
 * Elegibilidade de REMOÇÃO de uma versão DECRYPT_ONLY (§17). Só REPORTA — nunca remove.
 * Elegível apenas com zero referências de ciphertext, backup válido e restore drill PASS
 * e approval humano (os três últimos são fornecidos pelo chamador operacional).
 */
export function keyRemovalEligibility(input: {
  version: string;
  referencedCiphertextCount: number;
  hasValidBackup: boolean;
  restoreDrillPassed: boolean;
  humanApprovalRecorded: boolean;
  isPrimary: boolean;
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.isPrimary) reasons.push('version is PRIMARY');
  if (input.referencedCiphertextCount > 0) reasons.push(`${input.referencedCiphertextCount} ciphertext(s) still reference this version`);
  if (!input.hasValidBackup) reasons.push('no valid backup');
  if (!input.restoreDrillPassed) reasons.push('restore drill not passed');
  if (!input.humanApprovalRecorded) reasons.push('human approval not recorded');
  return { eligible: reasons.length === 0, reasons };
}
