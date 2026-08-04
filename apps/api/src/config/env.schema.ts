/**
 * Arden.AS API — validação de configuração (ARDEN-BE-001).
 *
 * A aplicação NÃO inicia com variável obrigatória ausente/ inválida. Mensagens
 * claras. Defaults apenas para valores seguros. Em production, configuração
 * permissiva (CORS "*") é rejeitada. Segredos nunca são logados.
 */

import { z } from 'zod';

const nodeEnv = z.enum(['development', 'test', 'production']);

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

export const envSchema = z
  .object({
    NODE_ENV: nodeEnv.default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL é obrigatória')
      .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
        message: 'DATABASE_URL deve ser uma conexão PostgreSQL (postgres://…).',
      }),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    APP_VERSION: z.string().min(1).default('0.1.0'),
    CORS_ORIGINS: z.string().default(''),
    API_PREFIX: z
      .string()
      .default('/api/v1')
      .refine((v) => v.startsWith('/'), { message: 'API_PREFIX deve começar com "/".' }),
    ENABLE_SWAGGER: booleanish.default(true),
    GIT_SHA: z.string().optional().default(''),

    // ── Autenticação (ARDEN-BE-002) ──────────────────────────────────────────
    AUTH_PROVIDER: z.enum(['supabase', 'fake']).default('supabase'),
    SUPABASE_URL: z.string().optional().default(''),
    SUPABASE_ANON_KEY: z.string().optional().default(''),
    SUPABASE_JWKS_URL: z.string().optional().default(''),
    SUPABASE_JWT_ISSUER: z.string().optional().default(''),
    SUPABASE_JWT_AUDIENCE: z.string().optional().default(''),
    AUTH_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().min(0).max(300).default(5),

    // ── Cofre de credenciais (ARDEN-BE-006.4) ────────────────────────────────
    // Provider do cofre. `fake` só para testes; proibido em production.
    CONNECTOR_VAULT_PROVIDER: z.enum(['app-aes-gcm', 'fake']).default('app-aes-gcm'),
    // Master key AES-256 (Base64 → exatamente 32 bytes). NUNCA versionada; NUNCA
    // com default. Obrigatória em production com provider app-aes-gcm.
    CONNECTOR_MASTER_KEY: z.string().optional().default(''),
    // Versão da chave corrente (persistida nos metadados da credencial).
    CONNECTOR_KEY_VERSION: z.string().min(1).default('v1'),
    // Keyring opcional (JSON { "<version>": "<base64-32-bytes>" }) para decifrar
    // versões antigas após rotação de master key.
    CONNECTOR_KEYRING_JSON: z.string().optional().default(''),

    // ── Provider comercial Anthropic (ARDEN-BE-008.3) ────────────────────────
    // Gate de RUNTIME: registra o AnthropicModelProvider no registry. Default false.
    // Nesta fase só é honrado fora de produção (ver ANTHROPIC_PROVIDER_RUNTIME_ENABLED
    // no wiring do registry). Habilitar não implica chamada externa.
    ANTHROPIC_PROVIDER_RUNTIME_ENABLED: booleanish.default(false),
    // Gate de CHAMADA EXTERNA: autoriza o transporte real (SDK) a alcançar a Anthropic.
    // Default false. Com false, o transporte real NUNCA chama a rede (erro seguro).
    ANTHROPIC_PROVIDER_EXTERNAL_CALLS_ENABLED: booleanish.default(false),
    // Gate de TOOL CALLING (ARDEN-BE-008.5): habilita o mapeamento/loop de ferramentas
    // Anthropic. Default false; só honrado fora de produção e sob o gate de runtime. Com
    // false, structured output continua funcionando e request com tools é rejeitado.
    ANTHROPIC_TOOL_CALLING_ENABLED: booleanish.default(false),

    // ── Smoke test real controlado (ARDEN-BE-008.4) ──────────────────────────
    // Habilita o comando de smoke test (nunca em suíte normal/CI). Default false.
    ANTHROPIC_SMOKE_TEST_ENABLED: booleanish.default(false),
    // Reconhecimento explícito do operador de que uma chamada real pode ocorrer.
    ANTHROPIC_SMOKE_TEST_ACKNOWLEDGED: booleanish.default(false),
    // Allowlist server-side de organizações autorizadas a chamadas reais NÃO produtivas
    // (CSV de UUIDs). Nunca vem do request. Vazio = nenhuma organização autorizada.
    ANTHROPIC_NON_PROD_ALLOWED_ORGANIZATION_IDS: z.string().default(''),
    // Quotas conservadoras não produtivas (denial-of-wallet), configuráveis.
    ANTHROPIC_NON_PROD_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).max(4096).default(256),
    ANTHROPIC_NON_PROD_DAILY_CALL_CAP: z.coerce.number().int().min(1).max(10000).default(50),
    ANTHROPIC_NON_PROD_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(1),
    // Circuit breaker: falhas consecutivas para abrir; janela de meio-aberto (ms).
    ANTHROPIC_CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().min(1).max(100).default(5),
    ANTHROPIC_CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
  })
  .transform((env) => ({
    ...env,
    anthropicNonProdAllowedOrganizationIds: env.ANTHROPIC_NON_PROD_ALLOWED_ORGANIZATION_IDS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }))
  .transform((env) => ({
    ...env,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  }))
  .superRefine((env, ctx) => {
    // Production não pode aceitar CORS permissivo por padrão.
    if (env.NODE_ENV === 'production') {
      if (env.corsOrigins.length === 0 || env.corsOrigins.includes('*')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'Em production, CORS_ORIGINS deve ser uma allowlist explícita (sem "*").',
        });
      }
    }

    // O provider fake NUNCA pode ser ativado em produção.
    if (env.AUTH_PROVIDER === 'fake' && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_PROVIDER'],
        message: 'AUTH_PROVIDER=fake é proibido em production.',
      });
    }

    // ── Cofre de credenciais (ARDEN-BE-006.4) ────────────────────────────────
    // O provider fake NUNCA pode ser ativado em produção.
    if (env.CONNECTOR_VAULT_PROVIDER === 'fake' && env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CONNECTOR_VAULT_PROVIDER'],
        message: 'CONNECTOR_VAULT_PROVIDER=fake é proibido em production.',
      });
    }
    if (env.CONNECTOR_VAULT_PROVIDER === 'app-aes-gcm') {
      const key = env.CONNECTOR_MASTER_KEY;
      if (!key) {
        if (env.NODE_ENV === 'production') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CONNECTOR_MASTER_KEY'],
            message: 'CONNECTOR_MASTER_KEY é obrigatória em production (Base64 de 32 bytes).',
          });
        }
      } else {
        // Se fornecida, DEVE decodificar para exatamente 32 bytes (AES-256).
        let bytes = -1;
        try {
          bytes = Buffer.from(key, 'base64').length;
        } catch {
          bytes = -1;
        }
        if (bytes !== 32) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CONNECTOR_MASTER_KEY'],
            message: 'CONNECTOR_MASTER_KEY deve ser Base64 de exatamente 32 bytes.',
          });
        }
      }
    }
    if (env.CONNECTOR_KEYRING_JSON) {
      try {
        const parsed = JSON.parse(env.CONNECTOR_KEYRING_JSON) as Record<string, string>;
        for (const [ver, b64] of Object.entries(parsed)) {
          if (Buffer.from(b64, 'base64').length !== 32) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CONNECTOR_KEYRING_JSON'], message: `Chave ${ver} do keyring deve ter 32 bytes.` });
          }
        }
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CONNECTOR_KEYRING_JSON'], message: 'CONNECTOR_KEYRING_JSON deve ser JSON válido.' });
      }
    }

    // Supabase exige JWKS e issuer para verificação criptográfica do token.
    if (env.AUTH_PROVIDER === 'supabase') {
      if (!env.SUPABASE_JWKS_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_JWKS_URL'],
          message: 'AUTH_PROVIDER=supabase requer SUPABASE_JWKS_URL.',
        });
      }
      if (!env.SUPABASE_JWT_ISSUER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SUPABASE_JWT_ISSUER'],
          message: 'AUTH_PROVIDER=supabase requer SUPABASE_JWT_ISSUER.',
        });
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

/**
 * Valida `process.env` (ou um objeto dado). Lança erro CLARO em caso de
 * configuração inválida — a aplicação não deve subir silenciosamente.
 */
export function loadConfig(source: Record<string, unknown> = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração inválida:\n${details}`);
  }
  return result.data;
}
