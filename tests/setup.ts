/**
 * Test Setup Configuration
 *
 * This file configures the testing environment for both unit tests and property-based tests.
 *
 * Requirements: Testing framework configuration (Vitest + fast-check)
 */

import { beforeAll, afterEach, afterAll } from 'vitest'
import { config } from '@vue/test-utils'

// Configure Vue Test Utils
beforeAll(() => {
  // Set global config for Vue Test Utils
  config.global.stubs = {
    // Stub out router-link and router-view
    'router-link': true,
    'router-view': true,
    // Stub out Element Plus components if needed
    'el-button': true,
    'el-input': true,
    'el-form': true,
    'el-form-item': true,
    'el-table': true,
    'el-table-column': true
  }
})

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks()

  // Clear localStorage
  localStorage.clear()

  // Clear sessionStorage
  sessionStorage.clear()
})

// Clean up after all tests
afterAll(() => {
  // Final cleanup
  vi.restoreAllMocks()
})

// Global test utilities
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const flushPromises = () => new Promise(resolve => setImmediate(resolve))

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  error: vi.fn(console.error),
  warn: vi.fn(console.warn),
  // Suppress log, info, debug in tests
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}
