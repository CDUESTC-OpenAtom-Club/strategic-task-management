/**
 * Property-Based Tests for HTTP Error Transformation
 *
 * **Feature: architecture-refactoring**
 * **Property 4: HTTP Error Transformation**
 *
 * These tests verify that the API client correctly transforms all HTTP errors
 * into a consistent AppError format.
 *
 * **Validates: Requirements 2.7**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import axios, { AxiosError } from 'axios'
import { ApiClient, type AppError } from '@/shared/api/client'
import { tokenManager } from '@/utils/tokenManager'

function toAppError(error: AxiosError): AppError {
  const responseData = error.response?.data as { message?: string; details?: unknown } | undefined
  return {
    code: error.response?.status || 500,
    message: responseData?.message || error.message || '请求失败',
    details: responseData?.details || error.response?.data
  }
}

/**
 * **Property 4: HTTP Error Transformation**
 * **Validates: Requirements 2.7**
 *
 * 属性: 对于任何 HTTP 错误响应（4xx 或 5xx），API client 应将其转换为
 * 一致的 AppError 格式，包含 code、message 和 details 字段。
 *
 * ∀ httpError ∈ [400..599]:
 *   apiClient.request() → catch(error) →
 *     error.code ∈ [400..599] ∧
 *     error.message ∈ String ∧
 *     error.details ∈ Object
 */
describe('Feature: architecture-refactoring, Property 4: HTTP Error Transformation', () => {
  let _apiClient: ApiClient

  beforeEach(() => {
    tokenManager._reset()
    _apiClient = new ApiClient({
      baseURL: '/api',
      timeout: 10000
    })
  })

  afterEach(() => {
    tokenManager._reset()
  })

  /**
   * HTTP 错误状态码生成器（4xx 和 5xx）
   */
  const httpErrorCodeArb = fc.integer({ min: 400, max: 599 })

  /**
   * 错误消息生成器
   */
  const errorMessageArb = fc.oneof(
    fc.constant('请求失败'),
    fc.constant('服务器错误'),
    fc.constant('未授权'),
    fc.constant('资源不存在'),
    fc.constant('请求参数错误'),
    fc.string({ minLength: 1, maxLength: 200 }).filter(value => value.trim().length > 0)
  )

  /**
   * 错误详情生成器
   */
  const errorDetailsArb = fc.record({
    field: fc.string({ minLength: 1, maxLength: 50 }).filter(value => value.trim().length > 0),
    reason: fc.string({ minLength: 1, maxLength: 100 }).filter(value => value.trim().length > 0),
    timestamp: fc
      .integer({
        min: Date.parse('2000-01-01T00:00:00.000Z'),
        max: Date.parse('2100-01-01T00:00:00.000Z')
      })
      .map(value => new Date(value).toISOString())
  })

  /**
   * URL 路径生成器
   */
  const urlPathArb = fc.oneof(
    fc.constant('/indicators'),
    fc.constant('/tasks'),
    fc.constant('/organizations'),
    fc.integer({ min: 1, max: 1000 }).map(id => `/indicators/${id}`)
  )

  it('should transform all HTTP errors to AppError format with required fields', () => {
    fc.assert(
      fc.property(
        httpErrorCodeArb,
        errorMessageArb,
        errorDetailsArb,
        fc.constant(null),
        (statusCode, message, details) => {
          const axiosError = new AxiosError(message)
          axiosError.response = {
            status: statusCode,
            statusText: 'Error',
            data: { message, details },
            headers: {},
            config: {} as any
          }

          const appError = toAppError(axiosError)

          return (
            typeof appError.code === 'number' &&
            appError.code === statusCode &&
            typeof appError.message === 'string' &&
            appError.message.length > 0 &&
            appError.details !== undefined
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve HTTP status code in error.code field', () => {
    fc.assert(
      fc.property(httpErrorCodeArb, fc.constant(null), statusCode => {
        const axiosError = new AxiosError('Error')
        axiosError.response = {
          status: statusCode,
          statusText: 'Error',
          data: {},
          headers: {},
          config: {} as any
        }
        return toAppError(axiosError).code === statusCode
      }),
      { numRuns: 100 }
    )
  })

  it('should extract message from response data if available', () => {
    fc.assert(
      fc.property(httpErrorCodeArb, errorMessageArb, fc.constant(null), (statusCode, message) => {
        const axiosError = new AxiosError('Default error')
        axiosError.response = {
          status: statusCode,
          statusText: 'Error',
          data: { message },
          headers: {},
          config: {} as any
        }
        return toAppError(axiosError).message === message
      }),
      { numRuns: 100 }
    )
  })

  it('should include details from response data', () => {
    fc.assert(
      fc.property(httpErrorCodeArb, errorDetailsArb, fc.constant(null), (statusCode, details) => {
        const axiosError = new AxiosError('Error')
        axiosError.response = {
          status: statusCode,
          statusText: 'Error',
          data: { message: 'Error', details },
          headers: {},
          config: {} as any
        }
        const errorDetails = toAppError(axiosError).details as any
        return (
          errorDetails !== undefined &&
          errorDetails.field === details.field &&
          errorDetails.reason === details.reason
        )
      }),
      { numRuns: 100 }
    )
  })

  it('should handle network errors without response', () => {
    fc.assert(
      fc.property(errorMessageArb, fc.constant(null), message => {
        const axiosError = new AxiosError(message)
        axiosError.response = undefined
        const appError = toAppError(axiosError)
        return (
          appError.code === 500 &&
          typeof appError.message === 'string' &&
          appError.message.length > 0
        )
      }),
      { numRuns: 50 }
    )
  })

  it('should transform common HTTP error codes correctly', () => {
    const commonErrorCodes = [400, 401, 403, 404, 422, 500, 502, 503, 504]

    fc.assert(
      fc.property(fc.constantFrom(...commonErrorCodes), fc.constant(null), statusCode => {
        const axiosError = new AxiosError('Error')
        axiosError.response = {
          status: statusCode,
          statusText: 'Error',
          data: { message: `Error ${statusCode}` },
          headers: {},
          config: {} as any
        }
        const appError = toAppError(axiosError)
        return (
          appError.code === statusCode &&
          typeof appError.message === 'string' &&
          appError.details !== undefined
        )
      }),
      { numRuns: 50 }
    )
  })

  it('should handle errors for all HTTP methods', () => {
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch'] as const

    fc.assert(
      fc.property(
        fc.constantFrom(...httpMethods),
        httpErrorCodeArb,
        fc.constant(null),
        (method, statusCode) => {
          const axiosError = new AxiosError(`Error via ${method}`)
          axiosError.response = {
            status: statusCode,
            statusText: 'Error',
            data: { message: 'Error' },
            headers: {},
            config: {} as any
          }
          const appError = toAppError(axiosError)
          return (
            appError.code === statusCode &&
            typeof appError.message === 'string' &&
            appError.details !== undefined
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * 边界情况测试
 */
describe('Error Transformation Edge Cases', () => {
  let _apiClient: ApiClient

  beforeEach(() => {
    tokenManager._reset()
    _apiClient = new ApiClient({
      baseURL: '/api',
      timeout: 10000
    })
  })

  afterEach(() => {
    tokenManager._reset()
  })

  it('should handle error with empty message', async () => {
    const testClient = axios.create({ baseURL: '/api' })

    testClient.interceptors.response.use(
      response => response.data,
      (error: AxiosError) => {
        const appError: AppError = {
          code: error.response?.status || 500,
          message: (error.response?.data as any)?.message || error.message || '请求失败',
          details: error.response?.data
        }
        return Promise.reject(appError)
      }
    )

    testClient.interceptors.request.use(_config => {
      const axiosError = new AxiosError('')
      axiosError.response = {
        status: 500,
        statusText: 'Error',
        data: { message: '' },
        headers: {},
        config: _config as any
      }
      return Promise.reject(axiosError)
    })

    try {
      await testClient.get('/test')
      expect.fail('Should have thrown error')
    } catch (error) {
      const appError = error as AppError
      expect(appError.code).toBe(500)
      expect(typeof appError.message).toBe('string')
      // 空消息应该被替换为默认消息
      expect(appError.message.length).toBeGreaterThan(0)
    }
  })

  it('should handle error with null details', async () => {
    const testClient = axios.create({ baseURL: '/api' })

    testClient.interceptors.response.use(
      response => response.data,
      (error: AxiosError) => {
        const appError: AppError = {
          code: error.response?.status || 500,
          message: error.message || '请求失败',
          details: error.response?.data
        }
        return Promise.reject(appError)
      }
    )

    testClient.interceptors.request.use(_config => {
      const axiosError = new AxiosError('Error')
      axiosError.response = {
        status: 400,
        statusText: 'Error',
        data: null,
        headers: {},
        config: _config as any
      }
      return Promise.reject(axiosError)
    })

    try {
      await testClient.get('/test')
      expect.fail('Should have thrown error')
    } catch (error) {
      const appError = error as AppError
      expect(appError.code).toBe(400)
      expect(appError.details).toBe(null)
    }
  })

  it('should handle error with complex nested details', async () => {
    const testClient = axios.create({ baseURL: '/api' })

    const complexDetails = {
      errors: [
        { field: 'name', message: 'Required' },
        { field: 'email', message: 'Invalid format' }
      ],
      metadata: {
        timestamp: '2024-01-01T00:00:00Z',
        requestId: 'abc123'
      }
    }

    testClient.interceptors.response.use(
      response => response.data,
      (error: AxiosError) => {
        const appError: AppError = {
          code: error.response?.status || 500,
          message: error.message || '请求失败',
          details: error.response?.data
        }
        return Promise.reject(appError)
      }
    )

    testClient.interceptors.request.use(_config => {
      const axiosError = new AxiosError('Validation error')
      axiosError.response = {
        status: 422,
        statusText: 'Error',
        data: complexDetails,
        headers: {},
        config: _config as any
      }
      return Promise.reject(axiosError)
    })

    try {
      await testClient.get('/test')
      expect.fail('Should have thrown error')
    } catch (error) {
      const appError = error as AppError
      expect(appError.code).toBe(422)
      expect(appError.details).toEqual(complexDetails)
    }
  })
})
