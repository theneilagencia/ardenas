/**
 * ARDEN-PRD-001.1B/1.1C — testes do ciclo de vida da master-key keyring:
 * validação, rotação/backward-decrypt, elegibilidade de remoção, backup cifrado,
 * restore verify e DRILL offline completo com canários sintéticos.
 */
import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt, buildAad } from '../connectors/vault/aes-gcm';
import {
  buildConnectorMasterKeyring,
  resolveKeyForVersion,
  preflightKeyring,
  keyRemovalEligibility,
  MasterKeyConfigurationError,
} from './connector-master-keyring';
import {
  createConnectorMasterKeyBackup,
  restoreConnectorMasterKeyBackup,
  verifyConnectorMasterKeyRestore,
  MasterKeyBackupError,
} from './connector-master-key-backup';

const MK_CANARY = 'ARDEN_PRD001_MASTER_KEY_CANARY_7f1c2a9d';
const SECRET_CANARY = 'ARDEN_PRD001_CONNECTOR_SECRET_CANARY_3b8e5d0a';
const WRAP_CANARY = 'ARDEN_PRD001_BACKUP_WRAPPING_CANARY_a4c6e2f1';

// Chaves sintéticas determinísticas a partir dos canários (32 bytes).
const k = (canary: string, salt: number) => {
  const b = Buffer.alloc(32);
  Buffer.from(canary).copy(b);
  b[31] = salt;
  return b;
};
const K1 = k(MK_CANARY, 1);
const K2 = k(MK_CANARY, 2);
const WRAP = k(WRAP_CANARY, 9);
const b64 = (buf: Buffer) => buf.toString('base64');

describe('ConnectorMasterKeyring — validação', () => {
  it('constrói keyring com uma primária', () => {
    const kr = buildConnectorMasterKeyring({ primaryVersion: 'v1', keys: { v1: b64(K1) } });
    expect(kr.primary.version).toBe('v1');
    expect(kr.primary.status).toBe('PRIMARY');
    expect(kr.decryptKeys).toHaveLength(0);
  });

  it('primária + decrypt-only', () => {
    const kr = buildConnectorMasterKeyring({ primaryVersion: 'v2', keys: { v1: b64(K1), v2: b64(K2) } });
    expect(kr.primary.version).toBe('v2');
    expect(kr.decryptKeys.map((x) => x.version)).toEqual(['v1']);
    expect(kr.decryptKeys[0].status).toBe('DECRYPT_ONLY');
  });

  it('sem primária no keyring → falha', () => {
    expect(() => buildConnectorMasterKeyring({ primaryVersion: 'v9', keys: { v1: b64(K1) } })).toThrow(MasterKeyConfigurationError);
  });

  it('material com tamanho inválido → falha', () => {
    expect(() => buildConnectorMasterKeyring({ primaryVersion: 'v1', keys: { v1: Buffer.alloc(16).toString('base64') } })).toThrow(/32 bytes/);
  });

  it('encoding inválido → falha', () => {
    expect(() => buildConnectorMasterKeyring({ primaryVersion: 'v1', keys: { v1: 'not base64 @@@' } })).toThrow(MasterKeyConfigurationError);
  });

  it('material vazio → falha', () => {
    expect(() => buildConnectorMasterKeyring({ primaryVersion: 'v1', keys: { v1: '' } })).toThrow(MasterKeyConfigurationError);
  });

  it('versão desconhecida → fail-closed', () => {
    const kr = buildConnectorMasterKeyring({ primaryVersion: 'v1', keys: { v1: b64(K1) } });
    expect(() => resolveKeyForVersion(kr, 'v9')).toThrow(/MASTER_KEY_VERSION_UNAVAILABLE/);
  });

  it('preflight OK quando todas as versões referenciadas existem', () => {
    const kr = buildConnectorMasterKeyring({ primaryVersion: 'v2', keys: { v1: b64(K1), v2: b64(K2) } });
    const r = preflightKeyring(kr, ['v1', 'v2']);
    expect(r.status).toBe('OK');
    expect(r.missingVersions).toEqual([]);
    expect(r.primaryKeyVersion).toBe('v2');
    // Nunca contém material de chave.
    expect(JSON.stringify(r)).not.toContain(b64(K1));
  });

  it('preflight MISSING_VERSIONS quando ciphertext referencia versão ausente', () => {
    const kr = buildConnectorMasterKeyring({ primaryVersion: 'v2', keys: { v2: b64(K2) } });
    const r = preflightKeyring(kr, ['v1', 'v2']);
    expect(r.status).toBe('MISSING_VERSIONS');
    expect(r.missingVersions).toEqual(['v1']);
  });
});

describe('Rotação e backward-decrypt', () => {
  const aad = buildAad({ organizationId: 'org', connectionId: 'conn', credentialVersionId: 'cred', keyVersion: 'v1' });

  it('ciphertext de K1 continua legível após promover K2', () => {
    // Cifra com K1 (primária inicial).
    const env = encrypt(SECRET_CANARY, K1, aad);
    // Rotação: agora v2 é primária, v1 é decrypt-only.
    const kr = buildConnectorMasterKeyring({ primaryVersion: 'v2', keys: { v1: b64(K1), v2: b64(K2) } });
    const keyForOld = resolveKeyForVersion(kr, 'v1');
    expect(decrypt(env, keyForOld.key, aad)).toBe(SECRET_CANARY);
  });

  it('novo ciphertext usa a primária (K2) e é legível', () => {
    const kr = buildConnectorMasterKeyring({ primaryVersion: 'v2', keys: { v1: b64(K1), v2: b64(K2) } });
    const aad2 = buildAad({ organizationId: 'org', connectionId: 'conn', credentialVersionId: 'cred2', keyVersion: 'v2' });
    const env = encrypt(SECRET_CANARY, kr.primary.key, aad2);
    expect(decrypt(env, resolveKeyForVersion(kr, 'v2').key, aad2)).toBe(SECRET_CANARY);
  });

  it('elegibilidade de remoção bloqueada enquanto há referências', () => {
    const e = keyRemovalEligibility({ version: 'v1', referencedCiphertextCount: 3, hasValidBackup: true, restoreDrillPassed: true, humanApprovalRecorded: true, isPrimary: false });
    expect(e.eligible).toBe(false);
    expect(e.reasons.join()).toMatch(/still reference/);
  });

  it('elegibilidade só com zero referências + backup + drill + approval', () => {
    const e = keyRemovalEligibility({ version: 'v1', referencedCiphertextCount: 0, hasValidBackup: true, restoreDrillPassed: true, humanApprovalRecorded: true, isPrimary: false });
    expect(e.eligible).toBe(true);
  });
});

describe('Backup e restore da keyring', () => {
  const kr = buildConnectorMasterKeyring({ primaryVersion: 'v2', keys: { v1: b64(K1), v2: b64(K2) } });
  const NOW = '2026-08-05T00:00:00.000Z';

  it('backup é cifrado e não contém plaintext de chave nem wrapping key', () => {
    const art = createConnectorMasterKeyBackup({ keyring: kr, wrappingKey: WRAP, environment: 'drill', createdAt: NOW });
    const dump = JSON.stringify(art);
    expect(dump).not.toContain(b64(K1));
    expect(dump).not.toContain(b64(K2));
    expect(dump).not.toContain(b64(WRAP));
    expect(dump).not.toContain(WRAP_CANARY);
    expect(art.manifest.includedKeyVersions).toEqual(['v1', 'v2']);
    expect(art.manifest.encryptionMethod).toBe('AES-256-GCM');
  });

  it('restore com a wrapping key correta recupera o keyring', () => {
    const art = createConnectorMasterKeyBackup({ keyring: kr, wrappingKey: WRAP, environment: 'drill', createdAt: NOW });
    const restored = restoreConnectorMasterKeyBackup(art, WRAP);
    expect(restored.primary.version).toBe('v2');
    expect(restored.decryptKeys.map((x) => x.version)).toEqual(['v1']);
  });

  it('wrapping key errada falha (fail-closed)', () => {
    const art = createConnectorMasterKeyBackup({ keyring: kr, wrappingKey: WRAP, environment: 'drill', createdAt: NOW });
    expect(() => restoreConnectorMasterKeyBackup(art, randomBytes(32))).toThrow(MasterKeyBackupError);
  });

  it('artefato adulterado (checksum) falha', () => {
    const art = createConnectorMasterKeyBackup({ keyring: kr, wrappingKey: WRAP, environment: 'drill', createdAt: NOW });
    const tampered = { ...art, manifest: { ...art.manifest, checksum: 'deadbeef' } };
    expect(() => restoreConnectorMasterKeyBackup(tampered, WRAP)).toThrow(/MASTER_KEY_BACKUP_INVALID/);
  });

  it('ciphertext adulterado falha na auth tag', async () => {
    const art = createConnectorMasterKeyBackup({ keyring: kr, wrappingKey: WRAP, environment: 'drill', createdAt: NOW });
    const bad = Buffer.from(art.envelope.ciphertext, 'base64');
    bad[0] ^= 0xff;
    // Recalcula o checksum para o ciphertext adulterado, provando que a AUTH TAG barra
    // (não apenas o checksum). O restore deve FALHAR mesmo com checksum coerente.
    const { createHash } = await import('node:crypto');
    const newChecksum = createHash('sha256').update(bad).digest('hex');
    const tampered = { manifest: { ...art.manifest, checksum: newChecksum }, envelope: { ...art.envelope, ciphertext: bad.toString('base64') } };
    expect(verifyConnectorMasterKeyRestore(tampered, WRAP, ['v1', 'v2']).status).toBe('FAIL');
  });

  it('verifyRestore retorna PASS sanitizado sem material de chave', () => {
    const art = createConnectorMasterKeyBackup({ keyring: kr, wrappingKey: WRAP, environment: 'drill', createdAt: NOW });
    const r = verifyConnectorMasterKeyRestore(art, WRAP, ['v1', 'v2']);
    expect(r.status).toBe('PASS');
    expect(JSON.stringify(r)).not.toContain(b64(K1));
    expect(JSON.stringify(r)).not.toContain(b64(WRAP));
  });
});

describe('DRILL offline completo de recuperação (§27)', () => {
  it('gera → cifra canário → backup → restaura → decifra → rotaciona → recripta → elegibilidade', () => {
    const NOW = '2026-08-05T00:00:00.000Z';
    // 1. keyring K1
    let kr = buildConnectorMasterKeyring({ primaryVersion: 'v1', keys: { v1: b64(K1) } });
    // 2. cifra credential canário com K1
    const aad1 = buildAad({ organizationId: 'org', connectionId: 'conn', credentialVersionId: 'cred', keyVersion: 'v1' });
    const env1 = encrypt(SECRET_CANARY, resolveKeyForVersion(kr, 'v1').key, aad1);
    // 3. backup cifrado
    const backup = createConnectorMasterKeyBackup({ keyring: kr, wrappingKey: WRAP, environment: 'drill', createdAt: NOW });
    // 4. "remove" keyring ativo (simulado) → 5. restaura em memória isolada
    const restored = restoreConnectorMasterKeyBackup(backup, WRAP);
    // 6. valida keyring restaurado + 7. decifra canário
    expect(decrypt(env1, resolveKeyForVersion(restored, 'v1').key, aad1)).toBe(SECRET_CANARY);
    // 8. adiciona K2 e 9. promove K2
    kr = buildConnectorMasterKeyring({ primaryVersion: 'v2', keys: { v1: b64(K1), v2: b64(K2) } });
    // 10. recripta a credential (decifra com v1, cifra com v2)
    const plain = decrypt(env1, resolveKeyForVersion(kr, 'v1').key, aad1);
    const aad2 = buildAad({ organizationId: 'org', connectionId: 'conn', credentialVersionId: 'cred', keyVersion: 'v2' });
    const env2 = encrypt(plain, kr.primary.key, aad2);
    // 11. comprova leitura pós-recriptografia
    expect(decrypt(env2, resolveKeyForVersion(kr, 'v2').key, aad2)).toBe(SECRET_CANARY);
    // 12. K1 elegível para remoção após zero referências
    const elig = keyRemovalEligibility({ version: 'v1', referencedCiphertextCount: 0, hasValidBackup: true, restoreDrillPassed: true, humanApprovalRecorded: true, isPrimary: false });
    expect(elig.eligible).toBe(true);
  });
});
