/**
 * Arden.AS API — abstração SecretVault (ARDEN-BE-006.4).
 *
 * O domínio depende desta interface, nunca do provider concreto. O provider é
 * selecionado por configuração (`app-aes-gcm` | `fake`) no bootstrap. Retorna
 * plaintext SOMENTE em memória ao chamador autorizado; nunca expõe material
 * criptográfico ao domínio.
 */

import type { Prisma } from '@prisma/client';

export const SECRET_VAULT = 'SECRET_VAULT';

/** Cliente mínimo para o cofre participar da MESMA transação do serviço (atomicidade). */
export type CredentialVaultDb = Pick<Prisma.TransactionClient, 'connectionCredentialVersion'>;

export interface StoreSecretInput {
  organizationId: string;
  connectionId: string;
  credentialVersionId: string;
  keyVersion: string;
  secret: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Schema do conector para validação limitada antes de cifrar. */
  credentialSchema?: Record<string, unknown>;
}

export interface StoredSecretReference {
  credentialVersionId: string;
  keyVersion: string;
  algorithm: 'AES-256-GCM';
  fingerprint: string;
}

export interface ResolveSecretInput {
  organizationId: string;
  connectionId: string;
  credentialVersionId: string;
}

export interface ResolvedSecret {
  credentialVersionId: string;
  secret: Record<string, unknown>;
  fingerprint: string;
  keyVersion: string;
}

export type RotateSecretInput = StoreSecretInput;

export interface RevokeSecretInput {
  organizationId: string;
  connectionId: string;
  credentialVersionId: string;
}

export interface SecretVault {
  storeSecret(input: StoreSecretInput, db?: CredentialVaultDb): Promise<StoredSecretReference>;
  resolveSecret(input: ResolveSecretInput, db?: CredentialVaultDb): Promise<ResolvedSecret>;
  rotateSecret(input: RotateSecretInput, db?: CredentialVaultDb): Promise<StoredSecretReference>;
  revokeSecret(input: RevokeSecretInput, db?: CredentialVaultDb): Promise<void>;
}
