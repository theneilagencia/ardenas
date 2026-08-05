import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Lint do backend (NestJS). Independente do lint do frontend. Sem React.
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'prisma/generated'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      // Decorators de parâmetro do Nest (ex.: @Inject) usam "useless" constructors às vezes.
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
);
