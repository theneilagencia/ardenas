/**
 * Arden.AS API — redaction centralizada de dados sensíveis (ARDEN-BE-006.4).
 *
 * Recursiva, case-insensitive, resistente a arrays e a referências circulares, sem
 * mutar o objeto original. Usada para sanitizar objetos/erros/headers/URLs antes de
 * log/auditoria/resposta. Nunca deixa segredo escapar por serialização acidental.
 */

const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'apikey',
  'token',
  'access_token',
  'refresh_token',
  'password',
  'secret',
  'client_secret',
  'credential',
  'credentials',
  'encryptedsecret',
  'nonce',
  'authtag',
  'masterkey',
]);

const SENSITIVE_QUERY_PARAMS: ReadonlySet<string> = new Set([
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'secret',
  'password',
  'signature',
  'sig',
]);

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

export interface SanitizedError {
  name: string;
  code?: string;
  message: string;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) return value.map((v) => redactValue(v, seen));
  if (value && typeof value === 'object') {
    if (seen.has(value as object)) return '[CIRCULAR]';
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : redactValue(v, seen);
    }
    return out;
  }
  return value;
}

export class SensitiveDataRedactor {
  /** Redige recursivamente um objeto sem mutar o original. */
  redactObject(value: unknown): unknown {
    return redactValue(value, new WeakSet());
  }

  /** Redige headers (case-insensitive) sem mutar o original. */
  redactHeaders(headers: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) out[k] = isSensitiveKey(k) ? REDACTED : v;
    return out;
  }

  /** Reduz um erro a uma forma SEGURA (sem stack, sem material sensível). */
  redactError(error: unknown): SanitizedError {
    if (error && typeof error === 'object') {
      const e = error as { name?: string; code?: string; message?: string };
      const code = typeof e.code === 'string' ? e.code : undefined;
      // Só a mensagem quando NÃO parecer conter segredo; caso contrário, genérica.
      const message = typeof e.message === 'string' && !/secret|token|password|key=/i.test(e.message) ? e.message : 'Erro interno.';
      return { name: typeof e.name === 'string' ? e.name : 'Error', code, message };
    }
    return { name: 'Error', message: 'Erro interno.' };
  }

  /** Remove userinfo e redige query params sensíveis; retorna string segura. */
  redactUrl(url: URL): string {
    const clean = new URL(url.toString());
    clean.username = '';
    clean.password = '';
    for (const key of [...clean.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) clean.searchParams.set(key, REDACTED);
    }
    return clean.toString();
  }
}

export const sensitiveDataRedactor = new SensitiveDataRedactor();
