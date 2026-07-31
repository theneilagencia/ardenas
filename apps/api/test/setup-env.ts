/**
 * Arden.AS API — setup de ambiente para testes (ARDEN-BE-001).
 * Define variáveis de ambiente ANTES de qualquer import de módulo Nest (o
 * DocsModule valida a config no import). Usa o banco de TESTE.
 */

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??=
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/arden_test?schema=public';
process.env.LOG_LEVEL ??= 'silent';
process.env.APP_VERSION ??= '0.1.0-test';
process.env.CORS_ORIGINS ??= 'http://allowed.test';
process.env.API_PREFIX ??= '/api/v1';
process.env.ENABLE_SWAGGER ??= 'true';
