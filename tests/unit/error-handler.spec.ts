/**
 * 错误处理单元测试
 * 
 * 测试 useErrorHandler composable 的各项功能：
 * - 友好消息生成
 * - 重试逻辑判断
 * - 错误类型检测
 * 
 * @requirements 10.2 - 超时提示和重试选项
 * @requirements 10.3 - 网络错误提示
 * @requirements 10.4 - 错误详情和建议操作
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useErrorHandler } from '@/composables/useErrorHandler'

// Mock Element Plus ElMessage
vi.mock('element-plus', () => ({
  ElMessage: vi.fn()
}))

describe('ErrorHandler Composable', () => {
  let errorHandler: ReturnType<typeof useErrorHandler>

  beforeEach(() => {
    vi.clearAllMocks()
    // 创建新的 errorHandler 实例，禁用通知以便测试
    errorHandler = useErrorHandler({
      showNotification: false,
      logToConsole: false
    })
  })

  /**
   * 友好消息生成测试
   * 
   * @requirement 10.3 - 网络错误提示
   * @requirement 10.4 - 错误详情和建议操作
   */
  describe('Friendly Message Generation (getFriendlyMessage)', () => {
    it('should return network error message for network errors', () => {
      // 模拟 Axios 网络错误（无响应，有请求）
      const networkError = {
        isAxiosError: true,
        message: 'Network Error',
        request: {},
        response: undefined
      }

      const message = errorHandler.getFriendlyMessage(networkError)
      expect(message).toBe('网络连接失败，正在使用离线数据')
    })

    it('should return timeout message for timeout errors', () => {
      // 模拟 Axios 超时错误 - 需要有 response 为 undefined 但 code 为 ECONNABORTED
      // 注意：isTimeoutError 检查 code === 'ECONNABORTED' 或 'ETIMEDOUT'
      const timeoutError = {
        isAxiosError: true,
        message: 'timeout of 5000ms exceeded',
        code: 'ECONNABORTED'
        // 不设置 request，这样不会被识别为网络错误
      }

      const message = errorHandler.getFriendlyMessage(timeoutError)
      expect(message).toBe('请求超时，请稍后重试')
    })

    it('should return timeout message for ETIMEDOUT errors', () => {
      // 模拟 ETIMEDOUT 超时错误
      const timeoutError = {
        isAxiosError: true,
        message: 'connect ETIMEDOUT',
        code: 'ETIMEDOUT'
      }

      const message = errorHandler.getFriendlyMessage(timeoutError)
      expect(message).toBe('请求超时，请稍后重试')
    })

    it('should return auth error message for 401 status', () => {
      // 模拟 401 认证错误
      const authError = {
        isAxiosError: true,
        message: 'Request failed with status code 401',
        response: { status: 401, data: {} }
      }

      const message = errorHandler.getFriendlyMessage(authError)
      expect(message).toBe('登录已过期，请重新登录')
    })

    it('should return auth error message for 403 status', () => {
      // 模拟 403 权限错误
      const forbiddenError = {
        isAxiosError: true,
        message: 'Request failed with status code 403',
        response: { status: 403, data: {} }
      }

      const message = errorHandler.getFriendlyMessage(forbiddenError)
      expect(message).toBe('登录已过期，请重新登录')
    })

    it('should return server error message for 500 status', () => {
      // 模拟 500 服务器错误
      const serverError = {
        isAxiosError: true,
        message: 'Request failed with status code 500',
        response: { status: 500, data: {} }
      }

      const message = errorHandler.getFriendlyMessage(serverError)
      expect(message).toBe('服务器繁忙，正在使用缓存数据')
    })

    it('should return server error message for 502 status', () => {
      // 模拟 502 网关错误
      const gatewayError = {
        isAxiosError: true,
        message: 'Request failed with status code 502',
        response: { status: 502, data: {} }
      }

      const message = errorHandler.getFriendlyMessage(gatewayError)
      expect(message).toBe('服务器繁忙，正在使用缓存数据')
    })

    it('should return server error message for 503 status', () => {
      // 模拟 503 服务不可用错误
      const unavailableError = {
        isAxiosError: true,
        message: 'Request failed with status code 503',
        response: { status: 503, data: {} }
      }

      const message = errorHandler.getFriendlyMessage(unavailableError)
      expect(message).toBe('服务器繁忙，正在使用缓存数据')
    })

    it('should return validation error message for 400 status', () => {
      // 模拟 400 验证错误 - 没有自定义消息时返回默认消息
      const validationError = {
        isAxiosError: true,
        message: 'Request failed with status code 400',
        response: { status: 400, data: {} }
      }

      const message = errorHandler.getFriendlyMessage(validationError)
      // 实现会尝试提取服务器返回的消息，如果没有则返回原始消息
      // 由于 data 为空对象，会返回原始 message
      expect(message).toBe('Request failed with status code 400')
    })

    it('should return server message for 400 status when provided', () => {
      // 模拟 400 验证错误 - 有服务器返回的消息
      const validationError = {
        isAxiosError: true,
        message: 'Request failed with status code 400',
        response: { 
          status: 400, 
          data: { message: '参数格式错误' } 
        }
      }

      const message = errorHandler.getFriendlyMessage(validationError)
      expect(message).toBe('参数格式错误')
    })

    it('should return not found message for 404 status', () => {
      // 模拟 404 资源未找到错误
      const notFoundError = {
        isAxiosError: true,
        message: 'Request failed with status code 404',
        response: { status: 404, data: {} }
      }

      const message = errorHandler.getFriendlyMessage(notFoundError)
      expect(message).toBe('请求的资源不存在')
    })

    it('should return unknown error message for unknown errors', () => {
      // 模拟未知错误
      const unknownError = new Error('Something went wrong')

      const message = errorHandler.getFriendlyMessage(unknownError)
      expect(message).toBe('发生未知错误，请稍后重试')
    })

    it('should return unknown error message for non-Error objects', () => {
      // 模拟非 Error 对象
      const strangeError = { foo: 'bar' }

      const message = errorHandler.getFriendlyMessage(strangeError)
      expect(message).toBe('发生未知错误，请稍后重试')
    })
  })

  /**
   * 重试逻辑测试
   * 
   * @requirement 10.2 - 超时提示和重试选项
   */
  describe('Retry Logic (isRetryable)', () => {
    it('should mark network errors as retryable', () => {
      // 网络错误应该可以重试
      const networkError = {
        isAxiosError: true,
        message: 'Network Error',
        request: {},
        response: undefined
      }

      const canRetry = errorHandler.isRetryable(networkError)
      expect(canRetry).toBe(true)
    })

    it('should mark timeout errors as retryable', () => {
      // 超时错误应该可以重试
      const timeoutError = {
        isAxiosError: true,
        message: 'timeout of 5000ms exceeded',
        code: 'ECONNABORTED'
      }

      const canRetry = errorHandler.isRetryable(timeoutError)
      expect(canRetry).toBe(true)
    })

    it('should mark auth errors (401) as NOT retryable', () => {
      // 认证错误不应该重试（需要重新登录）
      const authError = {
        isAxiosError: true,
        message: 'Request failed with status code 401',
        response: { status: 401, data: {} }
      }

      const canRetry = errorHandler.isRetryable(authError)
      expect(canRetry).toBe(false)
    })

    it('should mark auth errors (403) as NOT retryable', () => {
      // 权限错误不应该重试
      const forbiddenError = {
        isAxiosError: true,
        message: 'Request failed with status code 403',
        response: { status: 403, data: {} }
      }

      const canRetry = errorHandler.isRetryable(forbiddenError)
      expect(canRetry).toBe(false)
    })

    it('should mark validation errors (400) as NOT retryable', () => {
      // 验证错误不应该重试（数据本身有问题）
      const validationError = {
        isAxiosError: true,
        message: 'Request failed with status code 400',
        response: { status: 400, data: {} }
      }

      const canRetry = errorHandler.isRetryable(validationError)
      expect(canRetry).toBe(false)
    })

    it('should mark not found errors (404) as NOT retryable', () => {
      // 资源不存在错误不应该重试
      const notFoundError = {
        isAxiosError: true,
        message: 'Request failed with status code 404',
        response: { status: 404, data: {} }
      }

      const canRetry = errorHandler.isRetryable(notFoundError)
      expect(canRetry).toBe(false)
    })

    it('should mark server errors (500) as retryable', () => {
      // 服务器错误应该可以重试
      const serverError = {
        isAxiosError: true,
        message: 'Request failed with status code 500',
        response: { status: 500, data: {} }
      }

      const canRetry = errorHandler.isRetryable(serverError)
      expect(canRetry).toBe(true)
    })

    it('should mark server errors (502) as retryable', () => {
      // 网关错误应该可以重试
      const gatewayError = {
        isAxiosError: true,
        message: 'Request failed with status code 502',
        response: { status: 502, data: {} }
      }

      const canRetry = errorHandler.isRetryable(gatewayError)
      expect(canRetry).toBe(true)
    })

    it('should mark server errors (503) as retryable', () => {
      // 服务不可用错误应该可以重试
      const unavailableError = {
        isAxiosError: true,
        message: 'Request failed with status code 503',
        response: { status: 503, data: {} }
      }

      const canRetry = errorHandler.isRetryable(unavailableError)
      expect(canRetry).toBe(true)
    })

    it('should mark unknown errors as retryable', () => {
      // 未知错误默认可以重试
      const unknownError = new Error('Something went wrong')

      const canRetry = errorHandler.isRetryable(unknownError)
      expect(canRetry).toBe(true)
    })
  })

  /**
   * 错误类型检测测试
   * 
   * @requirement 10.3 - 网络错误提示
   * @requirement 10.4 - 错误详情和建议操作
   */
  describe('Error Type Detection (getErrorType)', () => {
    it('should detect Axios network error', () => {
      // Axios 网络错误：有请求但无响应
      const networkError = {
        isAxiosError: true,
        message: 'Network Error',
        request: {},
        response: undefined
      }

      const errorType = errorHandler.getErrorType(networkError)
      expect(errorType).toBe('NETWORK_ERROR')
    })

    it('should detect network error from Error message', () => {
      // 普通 Error 对象，消息包含 network 关键字
      const networkError = new Error('Network request failed')

      const errorType = errorHandler.getErrorType(networkError)
      expect(errorType).toBe('NETWORK_ERROR')
    })

    it('should detect Axios timeout error by code', () => {
      // Axios 超时错误：code 为 ECONNABORTED
      const timeoutError = {
        isAxiosError: true,
        message: 'timeout of 5000ms exceeded',
        code: 'ECONNABORTED'
      }

      const errorType = errorHandler.getErrorType(timeoutError)
      expect(errorType).toBe('TIMEOUT_ERROR')
    })

    it('should detect timeout error from Error message', () => {
      // 普通 Error 对象，消息包含 timeout 关键字
      const timeoutError = new Error('Request timeout')

      const errorType = errorHandler.getErrorType(timeoutError)
      expect(errorType).toBe('TIMEOUT_ERROR')
    })

    it('should map HTTP 401 to AUTH_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Unauthorized',
        response: { status: 401, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('AUTH_ERROR')
    })

    it('should map HTTP 403 to AUTH_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Forbidden',
        response: { status: 403, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('AUTH_ERROR')
    })

    it('should map HTTP 400 to VALIDATION_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Bad Request',
        response: { status: 400, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('VALIDATION_ERROR')
    })

    it('should map HTTP 404 to NOT_FOUND_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Not Found',
        response: { status: 404, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('NOT_FOUND_ERROR')
    })

    it('should map HTTP 408 to TIMEOUT_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Request Timeout',
        response: { status: 408, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('TIMEOUT_ERROR')
    })

    it('should map HTTP 500 to SERVER_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Internal Server Error',
        response: { status: 500, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('SERVER_ERROR')
    })

    it('should map HTTP 502 to SERVER_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Bad Gateway',
        response: { status: 502, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('SERVER_ERROR')
    })

    it('should map HTTP 503 to SERVER_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Service Unavailable',
        response: { status: 503, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('SERVER_ERROR')
    })

    it('should map HTTP 504 to TIMEOUT_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Gateway Timeout',
        response: { status: 504, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('TIMEOUT_ERROR')
    })

    it('should map unknown 4xx errors to VALIDATION_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Conflict',
        response: { status: 409, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('VALIDATION_ERROR')
    })

    it('should map unknown 5xx errors to SERVER_ERROR', () => {
      const error = {
        isAxiosError: true,
        message: 'Not Implemented',
        response: { status: 501, data: {} }
      }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('SERVER_ERROR')
    })

    it('should return UNKNOWN_ERROR for unrecognized errors', () => {
      const error = { foo: 'bar' }

      const errorType = errorHandler.getErrorType(error)
      expect(errorType).toBe('UNKNOWN_ERROR')
    })
  })
})
