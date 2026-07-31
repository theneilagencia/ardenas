import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Os specs de modo api (e2e/api) exigem o backend real e rodam pela config
  // dedicada `playwright.api.config.ts` (script test:e2e:api) — nunca aqui.
  testIgnore: '**/api/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Usa o Chromium pré-instalado no ambiente, quando presente.
        launchOptions: process.env.ARDEN_CHROMIUM_PATH
          ? { executablePath: process.env.ARDEN_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
