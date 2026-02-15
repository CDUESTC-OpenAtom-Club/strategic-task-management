/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  extends: [
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    'prettier' // Must be last to override other configs
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  // Note: @typescript-eslint plugin is already included via @vue/eslint-config-typescript
  rules: {
    // 8.1.1 禁止 console.log，但允许 warn 和 error
    'no-console': ['error', { allow: ['warn', 'error'] }],
    
    // 8.1.2 TypeScript 严格模式规则
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    
    // Vue 相关规则
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'warn',
    'vue/require-default-prop': 'off',
    'vue/require-explicit-emits': 'error',
    
    // 通用代码质量规则
    'no-debugger': 'error',
    'no-alert': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all']
  },
  overrides: [
    {
      // 测试文件可以使用 console
      files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
      rules: {
        'no-console': 'off'
      }
    },
    {
      // 配置文件和脚本可以使用 console
      files: [
        '*.config.ts', 
        '*.config.js', 
        '*.config.cjs',
        'scripts/**/*.js',
        'scripts/**/*.cjs', 
        'server/**/*.js',
        'database/**/*.js'
      ],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    '*.d.ts',
    'coverage'
  ]
}
