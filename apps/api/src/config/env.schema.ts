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
  })
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
