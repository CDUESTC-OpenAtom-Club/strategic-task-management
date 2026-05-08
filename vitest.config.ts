import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom', // Changed from 'node' to 'jsdom' for Vue component testing
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.{test,spec,property.test}.{js,ts}',
      'src/**/*.{test,spec,property.test}.{js,ts}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    testTimeout: 30000,
    // Property-based tests require more iterations
    // fast-check default is 100 runs per property
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.property.test.ts',
        '**/*.config.*',
        '**/dist/**'
      ]
    }
  },
  resolve: {
    alias: [
      {
        find: /^@\/features\/strategic-indicator(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/3-features/indicator', import.meta.url))
      },
      {
        find: /^@\/app(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/1-app', import.meta.url))
      },
      {
        find: /^@\/features(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/3-features', import.meta.url))
      },
      {
        find: /^@\/entities(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/4-entities', import.meta.url))
      },
      {
        find: /^@\/shared(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/5-shared', import.meta.url))
      },
      {
        find: /^@\/processes(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/6-processes', import.meta.url))
      },
      {
        find: /^@\/1-app(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/1-app', import.meta.url))
      },
      {
        find: /^@\/3-features(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/3-features', import.meta.url))
      },
      {
        find: /^@\/4-entities(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/4-entities', import.meta.url))
      },
      {
        find: /^@\/5-shared(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/5-shared', import.meta.url))
      },
      {
        find: /^@\/6-processes(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/6-processes', import.meta.url))
      },
      {
        find: /^@components(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/components', import.meta.url))
      },
      {
        find: /^@views(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/views', import.meta.url))
      },
      {
        find: /^@stores(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/stores', import.meta.url))
      },
      {
        find: /^@types(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/types', import.meta.url))
      },
      {
        find: /^@utils(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/utils', import.meta.url))
      },
      { find: /^@api(?=\/|$)/, replacement: fileURLToPath(new URL('./src/api', import.meta.url)) },
      {
        find: /^@composables(?=\/|$)/,
        replacement: fileURLToPath(new URL('./src/composables', import.meta.url))
      },
      { find: /^@\//, replacement: `${fileURLToPath(new URL('./src', import.meta.url))}/` }
    ]
  }
})
