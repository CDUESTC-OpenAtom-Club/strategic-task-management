/**
 * Error Handler Tests
 * 
 * Unit tests for API error handling
 */

import { describe, it, expect } from 'vitest'
import {
  handleApiError,
  isRetryableError,
  isNetworkError,
  isServerError,
  isClientError,
  isAuthError,
  formatErrorMessage
} from '../errorHandler'
import type { AxiosError } from 'axios'

describe('Error Handler', () => {
  describe('handleApiError', () => {
    it('should handle server error response', () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 500,
          data: {
            message: 'Internal server error',
            code: 'SERVER_ERROR'
          }
        },
        config: {
          headers: {
            'X-Request-ID': 'test-123'
          }
        }
      } as unknown as AxiosError

      const result = handleApiError(error)

      expect(result.message).toBe('Internal server error')
      expect(result.status).toBe(500)
      expect(result.code).toBe('SERVER_ERROR')
      expect(result.severity).toBe('high')
      expect(result.retryable).toBe(true)
      expect(result.requestId).toBe('test-123')
    })

    it('should handle network error', () => {
      const error = {
        isAxiosError: true,
        request: {},
        code: 'ECONNABORTED',
        config: {}
      } as unknown as AxiosError

      const result = handleApiError(error)

      expect(result.message).toContain('请求超时')
      expect(result.code).toBe('ECONNABORTED')
      expect(result.severity).toBe('high')
      expect(result.retryable).toBe(true)
    })

    it('should handle request setup error', () => {
      const error = {
        isAxiosError: true,
        message: 'Request configuration error',
        code: 'REQUEST_ERROR',
        config: {}
      } as unknown as AxiosError

      const result = handleApiError(error)

      expect(result.message).toBe('Request configuration error')
      expect(result.code).toBe('REQUEST_ERROR')
      expect(result.severity).toBe('medium')
      expect(result.retryable).toBe(false)
    })
  })

  describe('isRetryableError', () => {
    it('should return true for 5xx errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 500 }
      } as unknown as AxiosError

      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for network errors', () => {
      const error = {
        isAxiosError: true,
        request: {},
        code: 'ECONNABORTED'
      } as unknown as AxiosError

      expect(isRetryableError(error)).toBe(true)
    })

    it('should return false for 4xx errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 404 }
      } as unknown as AxiosError

      expect(isRetryableError(error)).toBe(false)
    })

    it('should return true for 408 timeout', () => {
      const error = {
        isAxiosError: true,
        response: { status: 408 }
      } as unknown as AxiosError

      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for 429 rate limit', () => {
      const error = {
        isAxiosError: true,
        response: { status: 429 }
      } as unknown as AxiosError

      expect(isRetryableError(error)).toBe(true)
    })
  })

  describe('isNetworkError', () => {
    it('should return true for network errors', () => {
      const error = {
        isAxiosError: true,
        request: {},
        code: 'ECONNABORTED'
      } as unknown as AxiosError

      expect(isNetworkError(error)).toBe(true)
    })

    it('should return false for server errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 500 }
      } as unknown as AxiosError

      expect(isNetworkError(error)).toBe(false)
    })
  })

  describe('isServerError', () => {
    it('should return true for 5xx errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 500 }
      } as unknown as AxiosError

      expect(isServerError(error)).toBe(true)
    })

    it('should return false for 4xx errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 404 }
      } as unknown as AxiosError

      expect(isServerError(error)).toBe(false)
    })
  })

  describe('isClientError', () => {
    it('should return true for 4xx errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 404 }
      } as unknown as AxiosError

      expect(isClientError(error)).toBe(true)
    })

    it('should return false for 5xx errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 500 }
      } as unknown as AxiosError

      expect(isClientError(error)).toBe(false)
    })
  })

  describe('isAuthError', () => {
    it('should return true for 401 errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 401 }
      } as unknown as AxiosError

      expect(isAuthError(error)).toBe(true)
    })

    it('should return true for 403 errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 403 }
      } as unknown as AxiosError

      expect(isAuthError(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 404 }
      } as unknown as AxiosError

      expect(isAuthError(error)).toBe(false)
    })
  })

  describe('formatErrorMessage', () => {
    it('should format axios error', () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Not found' }
        },
        config: {}
      } as unknown as AxiosError

      const message = formatErrorMessage(error)
      expect(message).toBe('Not found')
    })

    it('should format generic error', () => {
      const error = new Error('Something went wrong')
      const message = formatErrorMessage(error)
      expect(message).toBe('Something went wrong')
    })

    it('should handle unknown error', () => {
      const message = formatErrorMessage('unknown')
      expect(message).toBe('未知错误')
    })
  })
})
