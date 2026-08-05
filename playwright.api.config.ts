import { defineConfig, devices } from '@playwright/test';

/**
 * Arden.AS — configuração de E2E do MODO API (ARDEN-BE-002).
 *
 * Sobe o backend real (NestJS + Fastify + Postgres de teste, provider FAKE) e o
 * frontend construído com VITE_DATA_PROVIDER=api apontando para ele. Prova a
 * integração frontend↔backend de SESSÃO e ORGANIZAÇÕES (não de operações) e que o
 * modo `api` NÃO cai para dados simulados.
 *
 * O `globalSetup` aplica migrações, semeia o catálogo e faz o bootstrap da
 * organização do subject de teste.
 */

const API_PORT = 3000;
const WEB_PORT = 4271;
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/arden_test?schema=public';

export default defineConfig({
  testDir: './e2e/api',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  globalSetup: './e2e/api/global-setup.ts',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.ARDEN_CHROMIUM_PATH
          ? { executablePath: process.env.ARDEN_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: [
    {
      // Backend real. dist já construído (npm run build:api) antes do run.
      command: 'node apps/api/dist/main.js',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL,
        AUTH_PROVIDER: 'fake',
        APP_VERSION: '0.1.0-e2e',
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        API_PREFIX: '/api/v1',
        ENABLE_SWAGGER: 'true',
        LOG_LEVEL: 'silent',
        // Chave-mestra do cofre (BE-006.4) — SOMENTE TESTE (32 bytes 0x07 em Base64).
        // Sem ela o cofre fica indisponível e create/rotate de credencial retornam 500.
        CONNECTOR_MASTER_KEY: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
      },
    },
    {
      // Frontend construído em modo api, apontando para o backend acima.
      command: `npm run build && npm run preview -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_DATA_PROVIDER: 'api',
        VITE_API_BASE_URL: `http://localhost:${API_PORT}/api/v1`,
      },
    },
  ],
});
