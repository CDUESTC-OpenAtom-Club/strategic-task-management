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
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'no-restricted-imports': 'off'
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
