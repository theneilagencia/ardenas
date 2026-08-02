/**
 * Arden.AS API — montagem de autenticação de ferramenta (ARDEN-BE-006.6).
 *
 * A partir da credencial resolvida (plaintext EM MEMÓRIA) + configuração NÃO sensível,
 * produz os headers de auth. Modos: NONE, BEARER_TOKEN, API_KEY_HEADER, BASIC_AUTH,
 * HMAC, CUSTOM_FIXED_HEADERS. O plaintext é usado só aqui e descartado pelo chamador.
 * Nomes de header sensíveis vindos de CONFIG (não da credencial) são REJEITADOS — o
 * input da etapa nunca injeta Authorization/Cookie. `now` é injetado (sem ler relógio).
 */

import { createHmac } from 'node:crypto';
import { toolExecutionDenied } from '../../common/errors/api-error';

export type AuthMode = 'NONE' | 'BEARER_TOKEN' | 'API_KEY_HEADER' | 'BASIC_AUTH' | 'HMAC' | 'CUSTOM_FIXED_HEADERS';

/** Headers que CONFIG/CUSTOM_FIXED_HEADERS nunca podem definir (auth vem da credencial). */
const FORBIDDEN_FIXED_HEADERS: ReadonlySet<string> = new Set([
  'authorization', 'cookie', 'proxy-authorization', 'set-cookie', 'x-forwarded-for', 'host',
]);

export interface AuthBuildInput {
  mode: AuthMode;
  /** Segredo resolvido (em memória). Ex.: { token }, { username, password }, { signingSecret }. */
  secret: Record<string, unknown>;
  /** Headers fixos NÃO sensíveis (config do conector/binding). */
  fixedHeaders?: Record<string, string>;
  /** Nome do header para API_KEY_HEADER (default x-api-key). */
  headerName?: string;
  /** Corpo já serializado (para HMAC). */
  bodyString?: string;
  /** Instante injetado (para timestamp de assinatura). */
  now: Date;
  correlationId: string;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function applyFixedHeaders(target: Record<string, string>, fixed?: Record<string, string>): void {
  for (const [k, v] of Object.entries(fixed ?? {})) {
    if (FORBIDDEN_FIXED_HEADERS.has(k.toLowerCase())) {
      throw toolExecutionDenied(`Header fixo não permitido na configuração: ${k}.`);
    }
    target[k] = v;
  }
}

/** Monta os headers de autenticação. Retorna somente headers (sem segredo bruto). */
export function buildAuthHeaders(input: AuthBuildInput): Record<string, string> {
  const headers: Record<string, string> = {};
  applyFixedHeaders(headers, input.fixedHeaders);

  switch (input.mode) {
    case 'NONE':
    case 'CUSTOM_FIXED_HEADERS':
      break;
    case 'BEARER_TOKEN': {
      const token = str(input.secret.token);
      if (!token) throw toolExecutionDenied('Credencial BEARER_TOKEN sem token.');
      headers['authorization'] = `Bearer ${token}`;
      break;
    }
    case 'API_KEY_HEADER': {
      const token = str(input.secret.token);
      const name = str(input.headerName) ?? str(input.secret.headerName) ?? 'x-api-key';
      if (!token) throw toolExecutionDenied('Credencial API_KEY_HEADER sem token.');
      if (FORBIDDEN_FIXED_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== 'authorization') {
        throw toolExecutionDenied(`Nome de header de API key não permitido: ${name}.`);
      }
      headers[name] = token;
      break;
    }
    case 'BASIC_AUTH': {
      const username = str(input.secret.username);
      const password = str(input.secret.password);
      if (!username || !password) throw toolExecutionDenied('Credencial BASIC_AUTH incompleta.');
      headers['authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      break;
    }
    case 'HMAC': {
      const signingSecret = str(input.secret.signingSecret);
      if (!signingSecret) throw toolExecutionDenied('Credencial HMAC sem signingSecret.');
      const timestamp = String(Math.floor(input.now.getTime() / 1000));
      const payload = `${timestamp}.${input.bodyString ?? ''}`;
      const signature = createHmac('sha256', signingSecret).update(payload).digest('hex');
      headers['x-arden-timestamp'] = timestamp;
      headers['x-arden-signature'] = `sha256=${signature}`;
      break;
    }
    default:
      throw toolExecutionDenied(`Modo de autenticação desconhecido: ${String(input.mode)}.`);
  }
  return headers;
}

/** Deriva o modo de auth a partir do schema/credencial do conector. */
export function deriveAuthMode(connectorKey: string, secret: Record<string, unknown>, signPayload: boolean): AuthMode {
  if (connectorKey === 'system.webhook') return signPayload ? 'HMAC' : 'NONE';
  const scheme = typeof secret.scheme === 'string' ? secret.scheme : 'NONE';
  switch (scheme) {
    case 'BEARER_TOKEN': return 'BEARER_TOKEN';
    case 'API_KEY_HEADER': return 'API_KEY_HEADER';
    case 'BASIC_AUTH': return 'BASIC_AUTH';
    default: return 'NONE';
  }
}
