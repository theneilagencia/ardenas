import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.a11y.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'a11y',
          include: ['src/**/*.a11y.test.{ts,tsx}'],
        },
      },
      {
        // Ferramentas de infraestrutura (ARDEN-PRD-001.2A.2): offline, ambiente node.
        extends: true,
        test: {
          name: 'infra',
          environment: 'node',
          include: ['tooling/infrastructure/**/*.spec.ts'],
          setupFiles: [],
        },
      },
    ],
  },
});
