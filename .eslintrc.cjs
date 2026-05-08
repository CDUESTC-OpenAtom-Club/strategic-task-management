require('@rushstack/eslint-patch/modern-module-resolution')

const autoImportGlobals = require('./.eslintrc-auto-import.json')

module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    '@vue/eslint-config-typescript/recommended',
    'eslint-config-prettier'
  ],
  globals: autoImportGlobals.globals,
  ignorePatterns: ['dist/', 'coverage/', 'node_modules/', 'src/**/_deprecated/**'],
  rules: {
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'off',
    'no-restricted-imports': [
      'warn',
      {
        patterns: [
          {
            group: ['@/api', '@/api/*'],
            message: 'Use the canonical shared API entrypoint instead of src/api.'
          },
          {
            group: ['@/utils', '@/utils/*'],
            message: 'Use the canonical shared lib entrypoint instead of src/utils.'
          },
          {
            group: ['@/types', '@/types/*'],
            message: 'Use the canonical entity or shared type entrypoint instead of src/types.'
          },
          {
            group: ['@/composables', '@/composables/*'],
            message: 'Use the canonical shared composable entrypoint instead of src/composables.'
          },
          {
            group: ['@/router', '@/router/*'],
            message: 'Use the app-layer router entrypoint instead of src/router.'
          },
          {
            group: ['@/5-shared/lib/api', '@/5-shared/lib/api/*'],
            message: 'Use @/5-shared/api as the canonical shared API path.'
          },
          {
            group: ['@/5-shared/lib/authorization', '@/5-shared/lib/authorization/*'],
            message: 'Use @/5-shared/lib/permissions as the canonical permission path.'
          },
          {
            group: ['@/5-shared/lib/hooks/usePermission'],
            message: 'Use @/5-shared/lib/permissions as the canonical permission path.'
          },
          {
            group: ['@/3-features/legacy-indicator', '@/3-features/legacy-indicator/*'],
            message: 'Do not add new dependencies on legacy-indicator.'
          }
        ]
      }
    ]
  },
  overrides: [
    {
      files: ['vite.config.ts', 'vitest.config.ts', 'scripts/**/*.mjs', '*.cjs'],
      env: {
        node: true,
        browser: false
      }
    }
  ]
}
