/**
 * ARDEN-PRD-001.1D — testes unit do pipeline de recriptografia (fake DB in-memory).
 * Elegibilidade, dry-run, CAS success/conflict, idempotência, versão desconhecida,
 * auth-tag inválida, resultado sanitizado, e o preflight compartilhado.
 */
import { describe, expect, it } from 'vitest';
import { buildAad, encrypt } from '../connectors/vault/aes-gcm';
import { ConnectorKeyProvider } from '../connectors/vault/connector-key-provider';
import {
  ConnectorCredentialReencryptionService,
  type ReencryptionDb,
  type ReencryptableCredentialRow,
} from './connector-credential-reencryption.service';
import { computeConnectorMasterKeyPreflight } from './connector-master-key-preflight.service';

const REENCRYPT_CANARY = 'ARDEN_PRD001_DB_REENCRYPTION_CANARY_c1a2b3d4';
const K1 = Buffer.alloc(32, 11);
const K2 = Buffer.alloc(32, 22);

function provider(primary: string, keyring: Record<string, Buffer>): ConnectorKeyProvider {
  const config = {
    CONNECTOR_KEY_VERSION: primary,
    CONNECTOR_MASTER_KEY: keyring[primary].toString('base64'),
    CONNECTOR_KEYRING_JSON: JSON.stringify(
      Object.fromEntries(Object.entries(keyring).map(([v, b]) => [v, b.toString('base64')])),
    ),
  } as unknown as ConstructorParameters<typeof ConnectorKeyProvider>[0];
  return new ConnectorKeyProvider(config);
}

/** DB fake: guarda linhas cifradas e implementa CAS por (id, keyVersion, ciphertext). */
class FakeDb implements ReencryptionDb {
  rows = new Map<string, ReencryptableCredentialRow>();
  seed(row: ReencryptableCredentialRow) { this.rows.set(row.id, { ...row }); }
  async distinctReferencedVersions() { return Array.from(new Set([...this.rows.values()].map((r) => r.keyVersion))); }
  async countEligible(primary: string, source?: string) {
    return [...this.rows.values()].filter((r) => r.keyVersion !== primary && (!source || r.keyVersion === source)).length;
  }
  async findEligibleBatch(primary: string, limit: number, source?: string) {
    return [...this.rows.values()].filter((r) => r.keyVersion !== primary && (!source || r.keyVersion === source)).slice(0, limit).map((r) => ({ ...r }));
  }
  async casReencrypt(input: { id: string; expectedKeyVersion: string; expectedCiphertext: string; newCiphertext: string; newNonce: string; newAuthTag: string; newKeyVersion: string }) {
    const row = this.rows.get(input.id);
    if (!row || row.keyVersion !== input.expectedKeyVersion || row.encryptedSecret !== input.expectedCiphertext) return 0;
    row.keyVersion = input.newKeyVersion;
    row.encryptedSecret = input.newCiphertext;
    row.nonce = input.newNonce;
    row.authTag = input.newAuthTag;
    return 1;
  }
}

function makeRow(db: FakeDb, id: string, key: Buffer, keyVersion: string): void {
  const aad = buildAad({ organizationId: 'org', connectionId: 'conn', credentialVersionId: id, keyVersion });
  const env = encrypt(JSON.stringify({ apiKey: `${REENCRYPT_CANARY}-${id}` }), key, aad);
  db.seed({ id, organizationId: 'org', connectionId: 'conn', encryptedSecret: env.ciphertext, nonce: env.nonce, authTag: env.authTag, keyVersion });
}

describe('ConnectorCredentialReencryptionService', () => {
  it('inspect conta elegíveis e detecta versões referenciadas', async () => {
    const db = new FakeDb();
    makeRow(db, 'c1', K1, 'v1');
    makeRow(db, 'c2', K2, 'v2');
    const svc = new ConnectorCredentialReencryptionService(db, provider('v2', { v1: K1, v2: K2 }));
    const ins = await svc.inspect();
    expect(ins.primaryKeyVersion).toBe('v2');
    expect(ins.eligibleCount).toBe(1); // só c1 (v1 != v2)
    expect(ins.referencedVersions).toEqual(['v1', 'v2']);
    expect(ins.missingVersions).toEqual([]);
  });

  it('dry-run não escreve mas reporta o que seria recriptografado', async () => {
    const db = new FakeDb();
    makeRow(db, 'c1', K1, 'v1');
    const svc = new ConnectorCredentialReencryptionService(db, provider('v2', { v1: K1, v2: K2 }));
    const r = await svc.runBatch({ batchSize: 10, dryRun: true });
    expect(r.reencrypted).toBe(1);
    expect(db.rows.get('c1')!.keyVersion).toBe('v1'); // inalterado
  });

  it('recripta K1→K2 e é idempotente (2ª execução = 0)', async () => {
    const db = new FakeDb();
    makeRow(db, 'c1', K1, 'v1');
    makeRow(db, 'c2', K1, 'v1');
    const svc = new ConnectorCredentialReencryptionService(db, provider('v2', { v1: K1, v2: K2 }));
    const r1 = await svc.runBatch({ batchSize: 10 });
    expect(r1.reencrypted).toBe(2);
    expect(db.rows.get('c1')!.keyVersion).toBe('v2');
    // Idempotente: nada elegível agora.
    const r2 = await svc.runBatch({ batchSize: 10 });
    expect(r2.eligible).toBe(0);
    expect(r2.reencrypted).toBe(0);
  });

  it('CAS conflict (alteração concorrente) → skippedConcurrentChange, sem sobrescrever', async () => {
    const db = new FakeDb();
    makeRow(db, 'c1', K1, 'v1');
    const svc = new ConnectorCredentialReencryptionService(db, provider('v2', { v1: K1, v2: K2 }));
    // Simula um vencedor concorrente que muda o ciphertext entre o read e o CAS.
    const orig = db.casReencrypt.bind(db);
    db.casReencrypt = async (input) => {
      db.rows.get('c1')!.encryptedSecret = 'changed-by-other'; // muda o estado
      db.rows.get('c1')!.keyVersion = 'v2';
      return orig(input); // agora o expected não bate → 0
    };
    const r = await svc.runBatch({ batchSize: 10 });
    expect(r.skippedConcurrentChange).toBe(1);
    expect(r.reencrypted).toBe(0);
  });

  it('versão desconhecida → falha classificada, sem corromper os demais', async () => {
    const db = new FakeDb();
    makeRow(db, 'c1', K1, 'v1');
    // Provider sem v1 no keyring (só v2). c1 referencia v1 → UNKNOWN_KEY_VERSION.
    const svc = new ConnectorCredentialReencryptionService(db, provider('v2', { v2: K2 }));
    const r = await svc.runBatch({ batchSize: 10 });
    expect(r.failed).toBe(1);
    expect(r.failureReasons.UNKNOWN_KEY_VERSION).toBe(1);
  });

  it('auth tag inválida → AUTHENTICATION_FAILED', async () => {
    const db = new FakeDb();
    makeRow(db, 'c1', K1, 'v1');
    db.rows.get('c1')!.authTag = Buffer.alloc(16, 0).toString('base64'); // tag inválida
    const svc = new ConnectorCredentialReencryptionService(db, provider('v2', { v1: K1, v2: K2 }));
    const r = await svc.runBatch({ batchSize: 10 });
    expect(r.failed).toBe(1);
    expect(r.failureReasons.AUTHENTICATION_FAILED).toBe(1);
  });

  it('resultado do batch não contém ciphertext nem canário de segredo', async () => {
    const db = new FakeDb();
    makeRow(db, 'c1', K1, 'v1');
    const svc = new ConnectorCredentialReencryptionService(db, provider('v2', { v1: K1, v2: K2 }));
    const r = await svc.runBatch({ batchSize: 10 });
    const dump = JSON.stringify(r);
    expect(dump).not.toContain(REENCRYPT_CANARY);
    expect(dump).not.toContain(db.rows.get('c1')!.encryptedSecret);
  });
});

describe('computeConnectorMasterKeyPreflight', () => {
  it('OK quando todas as versões referenciadas existem', async () => {
    const r = await computeConnectorMasterKeyPreflight({ primaryVersion: 'v2', availableVersions: ['v1', 'v2'], hasPrimary: true }, ['v1', 'v2']);
    expect(r.status).toBe('OK');
    expect(r.primaryKeyVersion).toBe('v2');
  });
  it('MISSING_VERSIONS quando falta uma versão referenciada', async () => {
    const r = await computeConnectorMasterKeyPreflight({ primaryVersion: 'v2', availableVersions: ['v2'], hasPrimary: true }, ['v1', 'v2']);
    expect(r.status).toBe('MISSING_VERSIONS');
    expect(r.missingVersions).toEqual(['v1']);
  });
  it('NO_PRIMARY quando a primária não está no keyring', async () => {
    const r = await computeConnectorMasterKeyPreflight({ primaryVersion: 'v9', availableVersions: ['v1'], hasPrimary: false }, ['v1']);
    expect(r.status).toBe('NO_PRIMARY');
    expect(r.primaryKeyVersion).toBeNull();
  });
});
