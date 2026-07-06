import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Shared flat ESLint config for the monorepo.
 * Non-type-checked (fast); type-aware rules can be layered per-package later.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/build/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
