/**
 * Arden.AS API — provider de cofre AES-256-GCM (ARDEN-BE-006.4).
 *
 * Cifra o segredo com a chave corrente e AAD (tenant+conexão+versão+keyVersion),
 * persistindo APENAS o material criptográfico na versão de credencial (tenant-scoped).
 * Nenhum plaintext persistido. Resolve SÓ em memória. Falha fechada e SANITIZADA em
 * integridade inválida — nunca vaza detalhe criptográfico. Na revogação, faz
 * crypto-shredding (zera o ciphertext) preservando metadados/histórico.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { credentialInvalid, credentialResolutionFailed, notFound } from '../../common/errors/api-error';
import { ConnectorKeyProvider } from './connector-key-provider';
import { VAULT_ALGORITHM, buildAad, decrypt, encrypt, type EncryptedEnvelope } from './aes-gcm';
import { canonicalSecretString, fingerprintSecret, validateSecret } from './secret-serialization';
import type { CredentialVaultDb, ResolveSecretInput, ResolvedSecret, RevokeSecretInput, RotateSecretInput, SecretVault, StoreSecretInput, StoredSecretReference } from './secret-vault';

@Injectable()
export class AppAesGcmVault implements SecretVault {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: ConnectorKeyProvider,
  ) {}

  private db(tx?: CredentialVaultDb): CredentialVaultDb {
    return tx ?? this.prisma;
  }

  async storeSecret(input: StoreSecretInput, db?: CredentialVaultDb): Promise<StoredSecretReference> {
    const errors = validateSecret(input.secret, input.credentialSchema);
    if (errors.length) throw credentialInvalid(errors);

    const material = this.keys.getKey(input.keyVersion);
    const aad = buildAad({ organizationId: input.organizationId, connectionId: input.connectionId, credentialVersionId: input.credentialVersionId, keyVersion: material.version });
    const envelope = encrypt(canonicalSecretString(input.secret), material.key, aad);
    const fingerprint = fingerprintSecret(input.secret);

    const res = await this.db(db).connectionCredentialVersion.updateMany({
      where: { id: input.credentialVersionId, organizationId: input.organizationId, connectionId: input.connectionId },
      data: {
        encryptedSecret: envelope.ciphertext,
        encryptedDataKey: null, // provider sem DEK separada (documentado)
        nonce: envelope.nonce,
        authTag: envelope.authTag,
        algorithm: VAULT_ALGORITHM,
        keyVersion: material.version,
        fingerprint,
      },
    });
    if (res.count === 0) throw notFound('Versão de credencial não encontrada.');
    return { credentialVersionId: input.credentialVersionId, keyVersion: material.version, algorithm: VAULT_ALGORITHM, fingerprint };
  }

  rotateSecret(input: RotateSecretInput, db?: CredentialVaultDb): Promise<StoredSecretReference> {
    // A rotação de LIFECYCLE (nova versão, activate, supersede, ponteiro) é do
    // serviço; aqui só ciframos o segredo da nova versão.
    return this.storeSecret(input, db);
  }

  async resolveSecret(input: ResolveSecretInput, db?: CredentialVaultDb): Promise<ResolvedSecret> {
    const row = await this.db(db).connectionCredentialVersion.findFirst({
      where: { id: input.credentialVersionId, organizationId: input.organizationId, connectionId: input.connectionId },
    });
    if (!row) throw notFound('Versão de credencial não encontrada.');
    if (!row.encryptedSecret || !row.nonce || !row.authTag || !row.keyVersion) {
      throw credentialResolutionFailed('Material criptográfico ausente.');
    }
    try {
      const material = this.keys.getKey(row.keyVersion);
      const aad = buildAad({ organizationId: input.organizationId, connectionId: input.connectionId, credentialVersionId: input.credentialVersionId, keyVersion: row.keyVersion });
      const envelope: EncryptedEnvelope = { ciphertext: row.encryptedSecret, nonce: row.nonce, authTag: row.authTag };
      const plaintext = decrypt(envelope, material.key, aad);
      const secret = JSON.parse(plaintext) as Record<string, unknown>;
      return { credentialVersionId: row.id, secret, fingerprint: row.fingerprint ?? '', keyVersion: row.keyVersion };
    } catch {
      // Sanitizado: nunca expõe auth tag / chave / ciphertext / stack.
      throw credentialResolutionFailed();
    }
  }

  /** Crypto-shredding na revogação: zera o material, preserva metadados/histórico. */
  async revokeSecret(input: RevokeSecretInput, db?: CredentialVaultDb): Promise<void> {
    await this.db(db).connectionCredentialVersion.updateMany({
      where: { id: input.credentialVersionId, organizationId: input.organizationId, connectionId: input.connectionId },
      data: { encryptedSecret: null, encryptedDataKey: null, nonce: null, authTag: null },
    });
  }
}
