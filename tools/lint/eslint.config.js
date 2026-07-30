import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts', '**/modernizr_build.js']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['../../apps/api/src/**/*.ts', '../../apps/api/test/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, Bun: 'readonly' }
    }
  },
  {
    files: ['../../apps/web/src/**/*.{ts,tsx}', '../../apps/web/vite.config.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      ...reactRefresh.configs.vite.rules
    }
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
      'no-useless-catch': 'off',
      '@typescript-eslint/no-namespace': 'off'
    }
  }
)
