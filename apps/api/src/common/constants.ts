/** Arden.AS API — constantes comuns (ARDEN-BE-001). */

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Limite do correlation-id aceito do cliente (não confiar em strings enormes). */
export const CORRELATION_ID_MAX_LENGTH = 200;

/** Limite de corpo da requisição (1 MiB) — segurança básica. */
export const BODY_LIMIT_BYTES = 1_048_576;

/** Chaves sensíveis redigidas de logs (nunca registrar segredos). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["proxy-authorization"]',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'req.headers["api-key"]',
  'res.headers["set-cookie"]',
  'password',
  'token',
  'secret',
  'credential',
  'credentials',
  'access_token',
  'refresh_token',
  'client_secret',
  '*.password',
  '*.token',
  '*.secret',
  '*.credential',
  '*.credentials',
  '*.access_token',
  '*.refresh_token',
  '*.client_secret',
];
