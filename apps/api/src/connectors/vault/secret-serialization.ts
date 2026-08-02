/**
 * Arden.AS API — serialização e validação de segredo (ARDEN-BE-006.4).
 *
 * Aceita APENAS objeto JSON simples; rejeita funções, protótipos inesperados,
 * referências circulares e tamanho excessivo. Valida (de forma limitada, sem ajv)
 * contra o `credentialSchema` do conector: campos obrigatórios e recusa de campos
 * desconhecidos quando `additionalProperties: false`. Produz canonicalização
 * determinística para criptografia e fingerprint.
 */

import { createHash } from 'node:crypto';

const MAX_SECRET_BYTES = 16 * 1024;

export interface SecretValidationError {
  field: string;
  code: string;
  message: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Canonicaliza (chaves ordenadas, sem undefined/funções). Lança em circular. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === 'function') continue;
      out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

export function canonicalSecretString(secret: Record<string, unknown>): string {
  return JSON.stringify(canonicalize(secret));
}

/** Fingerprint público seguro: `sha256:<8 hex>` do segredo canônico. Não reconstrói o segredo. */
export function fingerprintSecret(secret: Record<string, unknown>): string {
  const hash = createHash('sha256').update(canonicalSecretString(secret)).digest('hex');
  return `sha256:${hash.slice(0, 8)}`;
}

/**
 * Valida a estrutura do segredo e (limitadamente) contra o credentialSchema.
 * Retorna erros (vazio = válido). NÃO lança — o chamador decide o erro tipado.
 */
export function validateSecret(secret: unknown, credentialSchema?: Record<string, unknown>): SecretValidationError[] {
  const errors: SecretValidationError[] = [];
  if (!isPlainObject(secret)) {
    return [{ field: 'secret', code: 'invalid_type', message: 'O segredo deve ser um objeto JSON simples.' }];
  }
  // Rejeita funções e circular via serialização.
  let serialized: string;
  try {
    serialized = JSON.stringify(secret);
  } catch {
    return [{ field: 'secret', code: 'unserializable', message: 'O segredo não é serializável (circular?).' }];
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SECRET_BYTES) {
    errors.push({ field: 'secret', code: 'too_large', message: 'Segredo excede o limite de tamanho.' });
  }
  for (const [k, v] of Object.entries(secret)) {
    if (typeof v === 'function') errors.push({ field: `secret.${k}`, code: 'invalid_type', message: 'Funções não são permitidas.' });
  }

  // Validação limitada contra o credentialSchema (JSON Schema documental).
  if (credentialSchema && typeof credentialSchema === 'object') {
    const required = Array.isArray(credentialSchema.required) ? (credentialSchema.required as string[]) : [];
    const properties = isPlainObject(credentialSchema.properties) ? (credentialSchema.properties as Record<string, unknown>) : {};
    const additional = credentialSchema.additionalProperties;
    for (const field of required) {
      if (!(field in secret)) errors.push({ field: `secret.${field}`, code: 'required', message: `Campo obrigatório ausente: ${field}.` });
    }
    if (additional === false) {
      for (const key of Object.keys(secret)) {
        if (!(key in properties)) errors.push({ field: `secret.${key}`, code: 'unknown', message: `Campo desconhecido: ${key}.` });
      }
    }
  }
  return errors;
}
