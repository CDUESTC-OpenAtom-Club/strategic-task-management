/**
 * 降级服务属性测试
 * 
 * **Feature: github-delivery-prep, Property 3: 降级触发一致性**
 * **Validates: Requirements 6.1, 6.4**
 */
import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import type { AxiosError, AxiosResponse } from 'axios'
import { shouldFallback, getMockData, getFallbackReason, logFallback } from '@/api/fallback'
import type { StrategicIndicator } from '@/types'

vi.mock('@/api/fallback', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/fallback')>()
  return {
    ...original,
    getFallbackConfig: () => ({ enabled: true, forceMock: false })
  }
})

describe('Fallback Service Property Tests', () => {
  describe('Property 3: 降级触发一致性', () => {
    it('should trigger fallback for any 5xx status code', () => {
      fc.assert(
        fc.property(fc.integer({ min: 500, max: 599 }), (statusCode) => {
          const mockError: AxiosError = {
            isAxiosError: true,
            name: 'AxiosError',
            message: `Request failed with status code ${statusCode}`,
            config: { headers: {} as any },
            toJSON: () => ({}),
            response: { status: statusCode, statusText: 'Server Error', headers: {}, config: { headers: {} as any }, data: {} } as AxiosResponse
          }
          expect(shouldFallback(mockError)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('should NOT trigger fallback for 4xx status codes (client errors)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 400, max: 499 }).filter(code => code !== 401), (statusCode) => {
          const mockError: AxiosError = {
            isAxiosError: true,
            name: 'AxiosError',
            message: `Request failed with status code ${statusCode}`,
            config: { headers: {} as any },
            toJSON: () => ({}),
            response: { status: statusCode, statusText: 'Client Error', headers: {}, config: { headers: {} as any }, data: {} } as AxiosResponse
          }
          expect(shouldFallback(mockError)).toBe(false)
        }),
        { numRuns: 100 }
      )
    })

    it('should trigger fallback for network errors (no response)', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (errorMessage) => {
          const mockError = { isAxiosError: true, name: 'AxiosError', message: errorMessage, config: { headers: {} as any }, toJSON: () => ({}) } as AxiosError
          expect(shouldFallback(mockError)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })
  })
})
