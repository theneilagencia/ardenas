/**
 * Arden.AS API — primitivas AES-256-GCM (ARDEN-BE-006.4).
 *
 * Criptografia AUTENTICADA nativa (`node:crypto`), sem crypto artesanal. Nonce
 * aleatório de 96 bits POR operação (nunca reutilizado), auth tag e AAD
 * determinística vinculando tenant+recurso+versão de chave. Falha FECHADA em auth
 * tag inválida (`decipher.final()` lança).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const VAULT_ALGORITHM = 'AES-256-GCM' as const;

export interface EncryptedEnvelope {
  ciphertext: string; // Base64
  nonce: string; // Base64 (96 bits)
  authTag: string; // Base64 (128 bits)
}

/** AAD determinística: organizationId <TAB> connectionId <TAB> credentialVersionId <TAB> keyVersion. */
export function buildAad(parts: { organizationId: string; connectionId: string; credentialVersionId: string; keyVersion: string }): Buffer {
  return Buffer.from(
    `${parts.organizationId}\t${parts.connectionId}\t${parts.credentialVersionId}\t${parts.keyVersion}`,
    'utf8',
  );
}

export function encrypt(plaintext: string, key: Buffer, aad: Buffer): EncryptedEnvelope {
  if (key.length !== 32) throw new Error('vault key must be 32 bytes');
  const nonce = randomBytes(12); // 96 bits, único por operação
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/** Descriptografa; LANÇA (falha fechada) se auth tag/AAD/chave não conferem. */
export function decrypt(envelope: EncryptedEnvelope, key: Buffer, aad: Buffer): string {
  if (key.length !== 32) throw new Error('vault key must be 32 bytes');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'base64'));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}
