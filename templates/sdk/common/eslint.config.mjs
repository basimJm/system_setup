import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'jest.config.js',
      'jest.loop.config.js',
      'tsup.config.ts',
      'scripts/*.cjs',
      'dist/**',
      'coverage/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      'no-console': 'error',
    },
  },
  { files: ['**/*.mjs', '**/*.js'], ...tseslint.configs.disableTypeChecked },
  prettier,
);
