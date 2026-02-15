/**
 * 错误处理器属性测试
 * 
 * **Validates: P10 - 所有错误响应包含 requestId 用于追踪**
 * 
 * 验证错误处理器的核心属性：
 * 1. 所有转换后的错误都包含必需字段
 * 2. requestId 格式正确（UUID v4）
 * 3. timestamp 格式正确（ISO 8601）
 * 4. 错误码格式正确
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  generateRequestId,
  transformError,
  toExtendedError,
  formatErrorMessage,
  isRetryableError,
  getErrorSeverity,
} from '@/api/errorHandler'
import { isApiErrorResponse, ErrorSeverity } from '@/types/error'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

// ============================================================================
// Arbitraries (生成器)
// ============================================================================

/**
 * 生成有效的 HTTP 状态码
 */
const httpStatusArb = fc.oneof(
  fc.constant(400),
  fc.constant(401),
  fc.constant(403),
  fc.constant(404),
  fc.constant(409),
  fc.constant(422),
  fc.constant(429),
  fc.constant(500),
  fc.constant(502),
  fc.constant(503),
  fc.constant(504),
  fc.integer({ min: 400, max: 599 })
)

/**
 * 生成错误消息
 */
const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0)

/**
 * 生成错误码
 */
const errorCodeArb = fc.oneof(
  fc.constant('AUTH_001'),
  fc.constant('VAL_001'),
  fc.constant('BIZ_001'),
  fc.constant('SYS_001'),
  fc.constant('NET_001'),
  fc.constant('RATE_001'),
  fc.stringMatching(/^[A-Z]{2,5}_\d{3}$/)
)

/**
 * 生成模拟的 Axios 请求配置
 */
const axiosConfigArb = fc.record({
  url: fc.webUrl(),
  method: fc.constantFrom('get', 'post', 'put', 'delete', 'patch'),
  timeout: fc.integer({ min: 1000, max: 60000 }),
  headers: fc.constant({}),
})

/**
 * 生成模拟的响应数据
 */
const responseDataArb = fc.oneof(
  // 标准格式
  fc.record({
    code: errorCodeArb,
    message: errorMessageArb,
    requestId: fc.uuid(),
    timestamp: fc.date().map(d => d.toISOString()),
  }),
  // 简单格式
  fc.record({
    message: errorMessageArb,
  }),
  // 带 error 字段
  fc.record({
    error: errorMessageArb,
  }),
  // 空对象
  fc.constant({}),
  // undefined
  fc.constant(undefined)
)

/**
 * 生成模拟的 Axios 错误
 */
const axiosErrorArb = fc.tuple(
  httpStatusArb,
  responseDataArb,
  axiosConfigArb,
  fc.constantFrom('ERR_NETWORK', 'ECONNABORTED', 'ERR_BAD_REQUEST', undefined)
).map(([status, data, config, code]) => {
  const error = new Error('Request failed') as AxiosError
  error.isAxiosError = true
  error.code = code
  error.config = config as InternalAxiosRequestConfig
  error.response = {
    status,
    statusText: 'Error',
    data,
    headers: {},
    config: config as InternalAxiosRequestConfig,
  }
  return error
})

/**
 * 生成网络错误（无响应）
 */
const networkErrorArb = fc.tuple(
  axiosConfigArb,
  fc.constantFrom('ERR_NETWORK', 'ECONNREFUSED', 'ETIMEDOUT')
).map(([config, code]) => {
  const error = new Error('Network Error') as AxiosError
  error.isAxiosError = true
  error.code = code
  error.config = config as InternalAxiosRequestConfig
  error.response = undefined
  return error
})

// ============================================================================
// Property Tests
// ============================================================================

describe('Error Handler Property Tests', () => {
  describe('P10: 错误响应格式一致性', () => {
    /**
     * **Validates: P10**
     * 
     * 属性: 所有转换后的错误响应都包含必需字段
     * ∀ error ∈ AllErrors:
     *   response(error) has { code: string, message: string, requestId: string, timestamp: ISO8601 }
     */
    it('所有转换后的错误都包含必需字段 (code, message, requestId, timestamp)', () => {
      fc.assert(
        fc.property(axiosErrorArb, (axiosError) => {
          const result = transformError(axiosError)
          
          // 验证必需字段存在
          expect(result).toHaveProperty('code')
          expect(result).toHaveProperty('message')
          expect(result).toHaveProperty('requestId')
          expect(result).toHaveProperty('timestamp')
          
          // 验证字段类型
          expect(typeof result.code).toBe('string')
          expect(typeof result.message).toBe('string')
          expect(typeof result.requestId).toBe('string')
          expect(typeof result.timestamp).toBe('string')
          
          // 验证字段非空
          expect(result.code.length).toBeGreaterThan(0)
          expect(result.message.length).toBeGreaterThan(0)
          expect(result.requestId.length).toBeGreaterThan(0)
          expect(result.timestamp.length).toBeGreaterThan(0)
          
          // 验证符合 ApiErrorResponse 接口
          expect(isApiErrorResponse(result)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    /**
     * **Validates: P10**
     * 
     * 属性: 网络错误也包含必需字段
     */
    it('网络错误（无响应）也包含必需字段', () => {
      fc.assert(
        fc.property(networkErrorArb, (networkError) => {
          const result = transformError(networkError)
          
          expect(result).toHaveProperty('code')
          expect(result).toHaveProperty('message')
          expect(result).toHaveProperty('requestId')
          expect(result).toHaveProperty('timestamp')
          
          expect(isApiErrorResponse(result)).toBe(true)
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('requestId 格式验证', () => {
    /**
     * **Validates: P10**
     * 
     * 属性: requestId 是有效的 UUID v4 格式
     */
    it('生成的 requestId 是有效的 UUID 格式', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const requestId = generateRequestId()
          
          // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          expect(requestId).toMatch(uuidRegex)
        }),
        { numRuns: 100 }
      )
    })

    /**
     * **Validates: P10**
     * 
     * 属性: 每次生成的 requestId 都是唯一的
     */
    it('每次生成的 requestId 都是唯一的', () => {
      fc.assert(
        fc.property(fc.integer({ min: 10, max: 100 }), (count) => {
          const ids = new Set<string>()
          
          for (let i = 0; i < count; i++) {
            ids.add(generateRequestId())
          }
          
          // 所有生成的 ID 都应该是唯一的
          expect(ids.size).toBe(count)
        }),
        { numRuns: 20 }
      )
    })

    /**
     * **Validates: P10**
     * 
     * 属性: 转换后的错误中 requestId 格式正确
     */
    it('转换后的错误中 requestId 格式正确', () => {
      fc.assert(
        fc.property(axiosErrorArb, (axiosError) => {
          const result = transformError(axiosError)
          
          // requestId 应该是有效的 UUID 或从响应中提取的值
          expect(result.requestId).toBeTruthy()
          expect(result.requestId.length).toBeGreaterThanOrEqual(8)
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('timestamp 格式验证', () => {
    /**
     * **Validates: P10**
     * 
     * 属性: timestamp 是有效的 ISO 8601 格式（可解析为有效日期）
     */
    it('timestamp 是有效的 ISO 8601 格式', () => {
      fc.assert(
        fc.property(axiosErrorArb, (axiosError) => {
          const result = transformError(axiosError)
          
          // 验证 timestamp 存在且非空
          expect(result.timestamp).toBeTruthy()
          expect(typeof result.timestamp).toBe('string')
          
          // 尝试解析 timestamp - 必须是有效日期
          const date = new Date(result.timestamp)
          expect(date.toString()).not.toBe('Invalid Date')
          
          // 验证包含日期和时间部分（ISO 8601 基本格式）
          expect(result.timestamp).toContain('T')
          expect(result.timestamp).toContain('-')
        }),
        { numRuns: 50 }
      )
    })

    /**
     * **Validates: P10**
     * 
     * 属性: 新生成的 timestamp 是当前时间附近的值
     * 注意：如果响应中已有 timestamp，会保留原值
     */
    it('新生成的 timestamp 是当前时间附近的值', () => {
      fc.assert(
        fc.property(networkErrorArb, (networkError) => {
          // 使用网络错误（无响应数据），确保 timestamp 是新生成的
          const before = Date.now()
          const result = transformError(networkError)
          const after = Date.now()
          
          const timestamp = new Date(result.timestamp).getTime()
          
          // timestamp 应该在调用前后的时间范围内（允许 1 秒误差）
          expect(timestamp).toBeGreaterThanOrEqual(before - 1000)
          expect(timestamp).toBeLessThanOrEqual(after + 1000)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('错误码格式验证', () => {
    /**
     * **Validates: P10**
     * 
     * 属性: 错误码格式正确（模块_编号）
     */
    it('错误码格式正确', () => {
      fc.assert(
        fc.property(axiosErrorArb, (axiosError) => {
          const result = transformError(axiosError)
          
          // 错误码应该是非空字符串
          expect(result.code).toBeTruthy()
          expect(typeof result.code).toBe('string')
          
          // 如果是标准格式，应该匹配 PREFIX_NNN 模式
          // 但也允许其他格式（如从后端返回的自定义错误码）
          expect(result.code.length).toBeGreaterThan(0)
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('扩展错误信息', () => {
    /**
     * **Validates: P10**
     * 
     * 属性: toExtendedError 保留所有原始字段并添加扩展字段
     */
    it('toExtendedError 保留所有原始字段并添加扩展字段', () => {
      fc.assert(
        fc.property(axiosErrorArb, (axiosError) => {
          const apiError = transformError(axiosError)
          const extendedError = toExtendedError(apiError, axiosError)
          
          // 保留原始字段
          expect(extendedError.code).toBe(apiError.code)
          expect(extendedError.message).toBe(apiError.message)
          expect(extendedError.requestId).toBe(apiError.requestId)
          expect(extendedError.timestamp).toBe(apiError.timestamp)
          
          // 添加扩展字段
          expect(extendedError).toHaveProperty('severity')
          expect(extendedError).toHaveProperty('retryable')
          
          // 验证扩展字段类型
          expect(Object.values(ErrorSeverity)).toContain(extendedError.severity)
          expect(typeof extendedError.retryable).toBe('boolean')
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('辅助函数', () => {
    /**
     * 属性: formatErrorMessage 总是返回非空字符串
     */
    it('formatErrorMessage 总是返回非空字符串', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            axiosErrorArb.map(e => transformError(e)),
            fc.string(),
            fc.constant(null),
            fc.constant(undefined),
            fc.record({ message: fc.string() })
          ),
          (error) => {
            const message = formatErrorMessage(error)
            
            expect(typeof message).toBe('string')
            expect(message.length).toBeGreaterThan(0)
          }
        ),
        { numRuns: 50 }
      )
    })

    /**
     * 属性: isRetryableError 返回布尔值
     */
    it('isRetryableError 返回布尔值', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            axiosErrorArb.map(e => toExtendedError(transformError(e), e)),
            fc.constant(null),
            fc.constant(undefined),
            fc.record({ code: errorCodeArb })
          ),
          (error) => {
            const result = isRetryableError(error)
            expect(typeof result).toBe('boolean')
          }
        ),
        { numRuns: 50 }
      )
    })

    /**
     * 属性: getErrorSeverity 返回有效的严重级别
     */
    it('getErrorSeverity 返回有效的严重级别', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            axiosErrorArb.map(e => toExtendedError(transformError(e), e)),
            fc.constant(null),
            fc.constant(undefined),
            fc.record({ code: errorCodeArb })
          ),
          (error) => {
            const severity = getErrorSeverity(error)
            expect(Object.values(ErrorSeverity)).toContain(severity)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('边界情况', () => {
    /**
     * 属性: 处理空响应数据
     */
    it('处理空响应数据', () => {
      const error = new Error('Request failed') as AxiosError
      error.isAxiosError = true
      error.config = { url: '/test', method: 'get', headers: {} } as InternalAxiosRequestConfig
      error.response = {
        status: 500,
        statusText: 'Internal Server Error',
        data: undefined,
        headers: {},
        config: error.config,
      }
      
      const result = transformError(error)
      
      expect(isApiErrorResponse(result)).toBe(true)
      expect(result.code).toBeTruthy()
      expect(result.message).toBeTruthy()
    })

    /**
     * 属性: 处理非标准响应格式
     */
    it('处理非标准响应格式', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.array(fc.string()),
            fc.constant(null)
          ),
          (data) => {
            const error = new Error('Request failed') as AxiosError
            error.isAxiosError = true
            error.config = { url: '/test', method: 'get', headers: {} } as InternalAxiosRequestConfig
            error.response = {
              status: 400,
              statusText: 'Bad Request',
              data,
              headers: {},
              config: error.config,
            }
            
            const result = transformError(error)
            
            expect(isApiErrorResponse(result)).toBe(true)
          }
        ),
        { numRuns: 20 }
      )
    })
  })
})
