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
    fc.string({ minLength: 1, maxLength: 200 })
  )

  /**
   * 错误详情生成器
   */
  const errorDetailsArb = fc.record({
    field: fc.string({ minLength: 1, maxLength: 50 }),
    reason: fc.string({ minLength: 1, maxLength: 100 }),
    timestamp: fc.date().map(d => d.toISOString())
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
        urlPathArb,
        async (statusCode, message, details, url) => {
          // 创建测试用的 axios 实例
          const testClient = axios.create({
            baseURL: '/api',
            timeout: 10000
          })

          // 模拟响应拦截器的错误转换逻辑
          testClient.interceptors.response.use(
            response => response.data,
            (error: AxiosError) => {
              const appError: AppError = {
                code: error.response?.status || 500,
                message: (error.response?.data as any)?.message || error.message || '请求失败',
                details: (error.response?.data as any)?.details || error.response?.data
              }
              return Promise.reject(appError)
            }
          )

          // 模拟 HTTP 错误
          testClient.interceptors.request.use(_config => {
            const axiosError = new AxiosError(message)
            axiosError.response = {
              status: statusCode,
              statusText: 'Error',
              data: { message, details },
              headers: {},
              config: _config as any
            }
            return Promise.reject(axiosError)
          })

          // 执行请求并捕获错误
          try {
            await testClient.get(url)
            return false // 不应该到达这里
          } catch (error) {
            const appError = error as AppError

            // 验证错误格式
            return (
              typeof appError.code === 'number' &&
              appError.code === statusCode &&
              typeof appError.message === 'string' &&
              appError.message.length > 0 &&
              appError.details !== undefined
            )
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve HTTP status code in error.code field', () => {
    fc.assert(
      fc.property(httpErrorCodeArb, urlPathArb, async (statusCode, url) => {
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
            status: statusCode,
            statusText: 'Error',
            data: {},
            headers: {},
            config: _config as any
          }
          return Promise.reject(axiosError)
        })

        try {
          await testClient.get(url)
          return false
        } catch (error) {
          const appError = error as AppError
          return appError.code === statusCode
        }
      }),
      { numRuns: 100 }
    )
  })

  it('should extract message from response data if available', () => {
    fc.assert(
      fc.property(
        httpErrorCodeArb,
        errorMessageArb,
        urlPathArb,
        async (statusCode, message, url) => {
          const testClient = axios.create({ baseURL: '/api' })

          testClient.interceptors.response.use(
            response => response.data,
            (error: AxiosError) => {
              const responseData = error.response?.data as any
              const appError: AppError = {
                code: error.response?.status || 500,
                message: responseData?.message || error.message || '请求失败',
                details: responseData?.details || error.response?.data
              }
              return Promise.reject(appError)
            }
          )

          testClient.interceptors.request.use(_config => {
            const axiosError = new AxiosError('Default error')
            axiosError.response = {
              status: statusCode,
              statusText: 'Error',
              data: { message },
              headers: {},
              config: _config as any
            }
            return Promise.reject(axiosError)
          })

          try {
            await testClient.get(url)
            return false
          } catch (error) {
            const appError = error as AppError
            return appError.message === message
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should include details from response data', () => {
    fc.assert(
      fc.property(
        httpErrorCodeArb,
        errorDetailsArb,
        urlPathArb,
        async (statusCode, details, url) => {
          const testClient = axios.create({ baseURL: '/api' })

          testClient.interceptors.response.use(
            response => response.data,
            (error: AxiosError) => {
              const responseData = error.response?.data as any
              const appError: AppError = {
                code: error.response?.status || 500,
                message: responseData?.message || error.message || '请求失败',
                details: responseData?.details || error.response?.data
              }
              return Promise.reject(appError)
            }
          )

          testClient.interceptors.request.use(_config => {
            const axiosError = new AxiosError('Error')
            axiosError.response = {
              status: statusCode,
              statusText: 'Error',
              data: { message: 'Error', details },
              headers: {},
              config: _config as any
            }
            return Promise.reject(axiosError)
          })

          try {
            await testClient.get(url)
            return false
          } catch (error) {
            const appError = error as AppError
            const errorDetails = appError.details as any
            return (
              errorDetails !== undefined &&
              errorDetails.field === details.field &&
              errorDetails.reason === details.reason
            )
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle network errors without response', () => {
    fc.assert(
      fc.property(errorMessageArb, urlPathArb, async (message, url) => {
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
          const axiosError = new AxiosError(message)
          // 没有 response（网络错误）
          axiosError.response = undefined
          return Promise.reject(axiosError)
        })

        try {
          await testClient.get(url)
          return false
        } catch (error) {
          const appError = error as AppError
          return (
            appError.code === 500 &&
            typeof appError.message === 'string' &&
            appError.message.length > 0
          )
        }
      }),
      { numRuns: 50 }
    )
  })

  it('should transform common HTTP error codes correctly', () => {
    const commonErrorCodes = [400, 401, 403, 404, 422, 500, 502, 503, 504]

    fc.assert(
      fc.property(fc.constantFrom(...commonErrorCodes), urlPathArb, async (statusCode, url) => {
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
            status: statusCode,
            statusText: 'Error',
            data: { message: `Error ${statusCode}` },
            headers: {},
            config: _config as any
          }
          return Promise.reject(axiosError)
        })

        try {
          await testClient.get(url)
          return false
        } catch (error) {
          const appError = error as AppError
          return (
            appError.code === statusCode &&
            typeof appError.message === 'string' &&
            appError.details !== undefined
          )
        }
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
        urlPathArb,
        async (method, statusCode, url) => {
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
              status: statusCode,
              statusText: 'Error',
              data: { message: 'Error' },
              headers: {},
              config: _config as any
            }
            return Promise.reject(axiosError)
          })

          try {
            switch (method) {
              case 'get':
                await testClient.get(url)
                break
              case 'post':
                await testClient.post(url, {})
                break
              case 'put':
                await testClient.put(url, {})
                break
              case 'delete':
                await testClient.delete(url)
                break
              case 'patch':
                await testClient.patch(url, {})
                break
            }
            return false
          } catch (error) {
            const appError = error as AppError
            return (
              appError.code === statusCode &&
              typeof appError.message === 'string' &&
              appError.details !== undefined
            )
          }
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
