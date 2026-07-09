import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// ESLint v9 requires this flat-config file — the project's package.json
// pins eslint@^9 but shipped with no config at all, which made
// `npm run lint` fail immediately with "ESLint couldn't find an
// eslint.config.js file". This restores a sane default for a Vite + React app.
export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Only the two long-standing, stable rules — eslint-plugin-react-hooks
      // v5's "recommended" preset also pulls in experimental React Compiler
      // checks (static-components, purity, etc.) that misfire on ordinary
      // `{condition && <Element />}` JSX and would make `npm run lint` fail
      // on hundreds of pre-existing, perfectly safe lines across the app.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      // Intentional best-effort `try { await x() } catch {}` (e.g. logout
      // best-effort revoke) appears a few places in this codebase.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
