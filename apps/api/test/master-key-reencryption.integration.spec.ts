/**
 * ARDEN-PRD-001.1D — integração PostgreSQL do pipeline de recriptografia + readiness.
 * PostgreSQL real. Cria credenciais cifradas com K1, promove K2, recripta via CAS,
 * comprova migração + plaintext preservado + ownership intacto + idempotência +
 * cross-tenant + preflight fail-closed em versão ausente. Secret canary não vaza.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from './test-app';
import { prisma, resetIdentity, seedOrg } from './identity-helpers';
import { seedActor, idemKey, type Actor } from './operations-helpers';
import type { AuthenticatedRequestContext } from '../src/identity/request-context';
import { ConnectorCatalogProjector } from '../src/connectors/catalog/connector-catalog.projector';
import { ConnectionsService } from '../src/connectors/connections/connections.service';
import { CredentialVersionsService } from '../src/connectors/connections/credential-versions.service';
import { ConnectorKeyProvider } from '../src/connectors/vault/connector-key-provider';
import { buildAad, decrypt } from '../src/connectors/vault/aes-gcm';
import { ConnectorCredentialReencryptionService } from '../src/security/connector-credential-reencryption.service';
import { PrismaReencryptionDb } from '../src/security/connector-reencryption.prisma-adapter';
import { computeConnectorMasterKeyPreflight } from '../src/security/connector-master-key-preflight.service';

const CANARY = 'ARDEN_PRD001_DB_REENCRYPTION_CANARY_9c3f2a';
const SRC = 'test-v1'; // versão-fonte da fixture (setup-env)
const K1 = Buffer.alloc(32, 7); // = fixture de teste (setup-env)
const K2 = Buffer.alloc(32, 8);

let app: NestFastifyApplication;
let connections: ConnectionsService;
let credentials: CredentialVersionsService;

// Provider com v2 primária + test-v1/v2 no keyring.
function v2Provider(): ConnectorKeyProvider {
  return new ConnectorKeyProvider({
    CONNECTOR_KEY_VERSION: 'v2',
    CONNECTOR_MASTER_KEY: K2.toString('base64'),
    CONNECTOR_KEYRING_JSON: JSON.stringify({ [SRC]: K1.toString('base64'), v2: K2.toString('base64') }),
  } as unknown as ConstructorParameters<typeof ConnectorKeyProvider>[0]);
}

beforeAll(async () => {
  app = await startTestApp();
  await app.get(ConnectorCatalogProjector).project();
  connections = app.get(ConnectionsService);
  credentials = app.get(CredentialVersionsService);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetIdentity();
  await app.get(ConnectorCatalogProjector).project();
});

function ctxFor(actor: Actor, orgId: string): AuthenticatedRequestContext {
  return { correlationId: `c-${actor.subject}`, userId: actor.userId, organizationId: orgId } as unknown as AuthenticatedRequestContext;
}

async function makeCredential(slug: string, token: string): Promise<{ orgId: string; connectionId: string; credId: string }> {
  const org = await seedOrg({ name: slug, slug });
  const actor = await seedActor(`u-${slug}`, org.id, ['security_admin']);
  const ctx = ctxFor(actor, org.id);
  const conn = (await connections.create(ctx, { connectorKey: 'system.http', connectorVersion: '1', name: 'c' }, idemKey('c'))).body.data;
  const active = (await connections.transitionStatus(ctx, conn.id, 'ACTIVE', conn.revision)).data;
  const cred = (await credentials.create(ctx, active.id, { secret: { scheme: 'BEARER_TOKEN', token } }, idemKey('cred'))).body.data;
  return { orgId: org.id, connectionId: active.id, credId: cred.id };
}

describe('ARDEN-PRD-001.1D — reencryption pipeline (PostgreSQL)', () => {
  it('recripta K1→K2 via CAS, preserva plaintext e ownership; idempotente', async () => {
    const alpha = await makeCredential('re-alpha', `${CANARY}-alpha`);
    // Confirma keyVersion inicial = v1 (fixture).
    const before = await prisma.connectionCredentialVersion.findFirst({ where: { id: alpha.credId } });
    expect(before!.keyVersion).toBe(SRC);
    const originalCiphertext = before!.encryptedSecret;

    const keys = v2Provider();
    const svc = new ConnectorCredentialReencryptionService(new PrismaReencryptionDb(prisma), keys);

    const inspection = await svc.inspect();
    expect(inspection.primaryKeyVersion).toBe('v2');
    expect(inspection.eligibleCount).toBeGreaterThanOrEqual(1);

    const r = await svc.runBatch({ batchSize: 100 });
    expect(r.reencrypted).toBeGreaterThanOrEqual(1);
    expect(r.failed).toBe(0);

    const after = await prisma.connectionCredentialVersion.findFirst({ where: { id: alpha.credId } });
    expect(after!.keyVersion).toBe('v2');
    expect(after!.encryptedSecret).not.toBe(originalCiphertext); // material mudou
    expect(after!.organizationId).toBe(alpha.orgId); // ownership intacto
    expect(after!.connectionId).toBe(alpha.connectionId);
    expect(after!.status).toBe('ACTIVE');

    // Plaintext preservado: decifra com K2 + AAD(v2) e confere o canário.
    const aad = buildAad({ organizationId: alpha.orgId, connectionId: alpha.connectionId, credentialVersionId: alpha.credId, keyVersion: 'v2' });
    const plaintext = decrypt({ ciphertext: after!.encryptedSecret!, nonce: after!.nonce!, authTag: after!.authTag! }, K2, aad);
    expect(plaintext).toContain(`${CANARY}-alpha`);

    // Idempotência: 2ª execução não altera nada.
    const r2 = await svc.runBatch({ batchSize: 100 });
    expect(r2.eligible).toBe(0);
    expect(r2.reencrypted).toBe(0);

    // Banco não contém plaintext do canário.
    const raw = JSON.stringify(await prisma.connectionCredentialVersion.findMany());
    expect(raw).not.toContain(`${CANARY}-alpha`);
  });

  it('cross-tenant: recriptografia global preserva ownership de Alpha e Beta', async () => {
    const alpha = await makeCredential('re-a2', `${CANARY}-a2`);
    const beta = await makeCredential('re-b2', `${CANARY}-b2`);
    const svc = new ConnectorCredentialReencryptionService(new PrismaReencryptionDb(prisma), v2Provider());
    await svc.runBatch({ batchSize: 100 });

    const a = await prisma.connectionCredentialVersion.findFirst({ where: { id: alpha.credId } });
    const b = await prisma.connectionCredentialVersion.findFirst({ where: { id: beta.credId } });
    expect(a!.organizationId).toBe(alpha.orgId);
    expect(b!.organizationId).toBe(beta.orgId);
    expect(a!.organizationId).not.toBe(b!.organizationId);
    expect(a!.keyVersion).toBe('v2');
    expect(b!.keyVersion).toBe('v2');
  });

  it('preflight fail-closed quando uma versão referenciada está ausente do keyring', async () => {
    await makeCredential('re-pf', `${CANARY}-pf`); // cria credencial em v1
    // Keyring só com v2 (sem v1) → v1 referenciada fica missing.
    const onlyV2 = new ConnectorKeyProvider({
      CONNECTOR_KEY_VERSION: 'v2',
      CONNECTOR_MASTER_KEY: K2.toString('base64'),
      CONNECTOR_KEYRING_JSON: JSON.stringify({ v2: K2.toString('base64') }),
    } as unknown as ConstructorParameters<typeof ConnectorKeyProvider>[0]);
    const referenced = (await prisma.connectionCredentialVersion.findMany({ where: { status: 'ACTIVE', keyVersion: { not: null } }, distinct: ['keyVersion'], select: { keyVersion: true } }))
      .map((r) => r.keyVersion!)
      .filter(Boolean);
    const pre = await computeConnectorMasterKeyPreflight(onlyV2.describeKeyring(), referenced);
    expect(pre.status).toBe('MISSING_VERSIONS');
    expect(pre.missingVersions).toContain(SRC);
  });
});
