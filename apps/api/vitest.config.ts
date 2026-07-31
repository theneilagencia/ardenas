import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Vitest + SWC: o SWC emite metadata de decorators (design:type) que o NestJS
// usa na injeção de dependências — o esbuild padrão do Vite não emite. O alias
// resolve os contratos compartilhados a partir do SOURCE (sem exigir build).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // Testes de integração compartilham um banco — evita corrida entre arquivos.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@arden/contracts': resolve(__dirname, '../../packages/contracts/index.ts'),
    },
  },
  plugins: [
    // Compila com SWC (decorators + metadata).
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
