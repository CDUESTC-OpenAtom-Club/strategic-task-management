/**
 * Test Setup Configuration
 *
 * This file configures the testing environment for both unit tests and property-based tests.
 *
 * Requirements: Testing framework configuration (Vitest + fast-check)
 */

import { beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'
import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Mock localStorage and sessionStorage before all tests
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string): string | null => {
      return store[key] || null
    },
    setItem: (key: string, value: string): void => {
      store[key] = value.toString()
    },
    removeItem: (key: string): void => {
      delete store[key]
    },
    clear: (): void => {
      store = {}
    },
    get length(): number {
      return Object.keys(store).length
    },
    key: (index: number): string | null => {
      const keys = Object.keys(store)
      return keys[index] || null
    }
  }
})()

// Configure Vue Test Utils
beforeAll(() => {
  // Set global config for Vue Test Utils
  config.global.stubs = {
    // Stub out router-link and router-view
    'router-link': true,
    'router-view': true,
    // Minimal Element Plus stubs that still render slot content for assertions
    'el-icon': {
      template: '<i class="el-icon"><slot /></i>'
    },
    'el-button': {
      emits: ['click'],
      template: '<button class="el-button" @click="$emit(\'click\')"><slot /></button>'
    },
    'el-input': true,
    'el-form': true,
    'el-form-item': true,
    'el-table': true,
    'el-table-column': true
  }

  // Mock localStorage
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true
  })

  // Mock sessionStorage
  Object.defineProperty(global, 'sessionStorage', {
    value: localStorageMock,
    writable: true
  })
})

beforeEach(() => {
  setActivePinia(createPinia())
})

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks()

  // Clear localStorage (if it exists and has clear method)
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear()
  }

  // Clear sessionStorage (if it exists and has clear method)
  if (typeof sessionStorage !== 'undefined' && typeof sessionStorage.clear === 'function') {
    sessionStorage.clear()
  }
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
