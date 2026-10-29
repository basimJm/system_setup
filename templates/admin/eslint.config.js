import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const MAX_FILE_LINES = 300;
const MAX_COMPLEXITY = 15;
const MAX_PARAMS = 4;
const MAX_DEPTH = 4;

/** Clean-architecture import boundaries (inner layers never import outer ones). */
const forbid = (...layers) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: layers.map((layer) => ({
        group: [`@/${layer}`, `@/${layer}/**`],
        message: `This layer must not depend on "${layer}" (CLAUDE.md architecture).`,
      })),
    },
  ],
});

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'playwright-report',
      'test-results',
      'design',
      // Local real-server QA tooling (plain Node scripts, not part of the app).
      'qa',
      'docs',
      'src/data/contract/generated',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'max-lines': ['error', { max: MAX_FILE_LINES }],
      complexity: ['error', MAX_COMPLEXITY],
      'max-params': ['error', MAX_PARAMS],
      'max-depth': ['error', MAX_DEPTH],
      '@typescript-eslint/no-deprecated': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'XSS risk: never inject raw HTML.',
        },
        { selector: "CallExpression[callee.name='eval']", message: 'eval is forbidden.' },
        {
          selector: "NewExpression[callee.name='Function']",
          message: 'new Function is forbidden.',
        },
      ],
    },
  },
  {
    files: ['src/domain/**'],
    rules: forbid('data', 'presentation', 'infrastructure', 'app', 'design'),
  },
  { files: ['src/infrastructure/**'], rules: forbid('data', 'presentation', 'app', 'design') },
  { files: ['src/data/**'], rules: forbid('presentation', 'app', 'design') },
  { files: ['src/design/**'], rules: forbid('data', 'presentation', 'app', 'domain') },
  { files: ['src/presentation/**'], rules: forbid('data') },
  {
    files: ['scripts/**', 'tests/**', 'e2e/**', '*.config.*'],
    rules: { 'no-console': 'off', 'max-lines': 'off' },
  },
  { files: ['**/*.js', '**/*.cjs'], ...tseslint.configs.disableTypeChecked },
);
