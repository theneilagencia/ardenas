/**
 * Arden.AS API — provider de cofre FAKE (ARDEN-BE-006.4).
 *
 * SOMENTE testes unitários controlados. Guarda o segredo APENAS em memória do
 * processo (nunca no banco, nunca em disco). Proibido em production (o factory
 * recusa). Existe para provar a seleção de provider e testar componentes que
 * dependem de `SecretVault` sem criptografia real.
 */

import { credentialResolutionFailed } from '../../common/errors/api-error';
import { fingerprintSecret } from './secret-serialization';
import type { CredentialVaultDb, ResolveSecretInput, ResolvedSecret, RevokeSecretInput, RotateSecretInput, SecretVault, StoreSecretInput, StoredSecretReference } from './secret-vault';

export class FakeVault implements SecretVault {
  private readonly store = new Map<string, { secret: Record<string, unknown>; keyVersion: string; fingerprint: string }>();

  private key(input: { organizationId: string; connectionId: string; credentialVersionId: string }): string {
    return `${input.organizationId}:${input.connectionId}:${input.credentialVersionId}`;
  }

  async storeSecret(input: StoreSecretInput, _db?: CredentialVaultDb): Promise<StoredSecretReference> {
    void _db;
    const fingerprint = fingerprintSecret(input.secret);
    this.store.set(this.key(input), { secret: input.secret, keyVersion: input.keyVersion, fingerprint });
    return { credentialVersionId: input.credentialVersionId, keyVersion: input.keyVersion, algorithm: 'AES-256-GCM', fingerprint };
  }

  rotateSecret(input: RotateSecretInput, db?: CredentialVaultDb): Promise<StoredSecretReference> {
    return this.storeSecret(input, db);
  }

  async resolveSecret(input: ResolveSecretInput, _db?: CredentialVaultDb): Promise<ResolvedSecret> {
    void _db;
    const entry = this.store.get(this.key(input));
    if (!entry) throw credentialResolutionFailed();
    return { credentialVersionId: input.credentialVersionId, secret: entry.secret, fingerprint: entry.fingerprint, keyVersion: entry.keyVersion };
  }

  async revokeSecret(input: RevokeSecretInput, _db?: CredentialVaultDb): Promise<void> {
    void _db;
    this.store.delete(this.key(input));
  }
}
