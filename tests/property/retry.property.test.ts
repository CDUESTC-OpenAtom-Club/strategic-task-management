/**
 * Property-Based Tests for Retry Interceptor
 * 
 * **Feature: sism-enterprise-optimization**
 * 
 * These tests verify the correctness properties P5 and P6 defined in the design document
 * for the API retry interceptor.
 * 
 * **Validates: Requirements 2.1.1, 2.1.2, 2.1.3, 2.1.4**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import {
  calculateExponentialBackoff,
  isIdempotentMethod,
  isNonIdempotentMethod,
  isNetworkError,
  isServerError,
  defaultRetryCondition,
  shouldRetryRequest,
  DEFAULT_RETRY_CONFIG,
  IDEMPOTENT_METHODS,
  NON_IDEMPOTENT_METHODS,
  type RetryConfig,
  type RetryableRequestConfig,
} from '@/api/retry'

/**
 * Helper to create a mock AxiosError
 */
function createMockAxiosError(options: {
  status?: number
  code?: string
  hasResponse?: boolean
}): AxiosError {
  const { status, code, hasResponse = true } = options
  
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Test error',
    code: code,
    config: {} as InternalAxiosRequestConfig,
    response: hasResponse && status !== undefined ? {
      status,
      statusText: 'Test',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      data: {},
    } : undefined,
    toJSON: () => ({}),
  } as AxiosError
}

/**
 * Helper to create a mock RetryableRequestConfig
 */
function createMockConfig(options: {
  method?: string
  retryCount?: number
  retryConfig?: Partial<RetryConfig>
}): RetryableRequestConfig {
  const { method = 'GET', retryCount, retryConfig } = options
  
  return {
    method,
    url: '/test',
    headers: {},
    __retryCount: retryCount,
    __retryConfig: retryConfig ? { ...DEFAULT_RETRY_CONFIG, ...retryConfig } : undefined,
  } as RetryableRequestConfig
}

/**
 * **Property P5: 重试策略正确性**
 * **Validates: Requirements 2.1.1, 2.1.2**
 * 
 * 属性: GET 请求在可重试错误时最多重试 maxRetries 次，延迟遵循指数退避。
 * 
 * ∀ error ∈ RetryableErrors, ∀ attempt ∈ [1..maxRetries]:
 *   delay(attempt) = min(baseDelay * 2^(attempt-1), maxDelay)
 */
describe('Property P5: 重试策略正确性 - 指数退避延迟计算', () => {
  // 生成有效的重试尝试次数 (1-10)
  const attemptArb = fc.integer({ min: 1, max: 10 })
  
  // 生成有效的基础延迟 (100ms - 5000ms)
  const baseDelayArb = fc.integer({ min: 100, max: 5000 })
  
  // 生成有效的最大延迟 (1000ms - 30000ms)
  const maxDelayArb = fc.integer({ min: 1000, max: 30000 })

  it('should calculate delay using exponential backoff formula: baseDelay * 2^(attempt-1)', () => {
    fc.assert(
      fc.property(
        attemptArb,
        baseDelayArb,
        maxDelayArb,
        (attempt, baseDelay, maxDelay) => {
          const actualDelay = calculateExponentialBackoff(attempt, baseDelay, maxDelay)
          const expectedDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
          
          return actualDelay === expectedDelay
        }
      ),
      { numRuns: 200 }
    )
  })

  it('should never exceed maxDelay', () => {
    fc.assert(
      fc.property(
        attemptArb,
        baseDelayArb,
        maxDelayArb,
        (attempt, baseDelay, maxDelay) => {
          const delay = calculateExponentialBackoff(attempt, baseDelay, maxDelay)
          return delay <= maxDelay
        }
      ),
      { numRuns: 200 }
    )
  })

  it('should return baseDelay for first attempt', () => {
    fc.assert(
      fc.property(
        baseDelayArb,
        maxDelayArb,
        (baseDelay, maxDelay) => {
          // Ensure maxDelay >= baseDelay for this test
          const effectiveMaxDelay = Math.max(baseDelay, maxDelay)
          const delay = calculateExponentialBackoff(1, baseDelay, effectiveMaxDelay)
          return delay === baseDelay
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should double delay for each subsequent attempt (until maxDelay)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 100, max: 1000 }),
        (attempt, baseDelay) => {
          // Use a large maxDelay to avoid capping
          const maxDelay = baseDelay * Math.pow(2, 10)
          
          const delay1 = calculateExponentialBackoff(attempt, baseDelay, maxDelay)
          const delay2 = calculateExponentialBackoff(attempt + 1, baseDelay, maxDelay)
          
          // delay2 should be exactly double delay1 (when not capped)
          return delay2 === delay1 * 2
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should produce correct delays for default config (1s, 2s, 4s)', () => {
    // Default config: baseDelay=1000, maxDelay=10000
    expect(calculateExponentialBackoff(1)).toBe(1000)  // 1s
    expect(calculateExponentialBackoff(2)).toBe(2000)  // 2s
    expect(calculateExponentialBackoff(3)).toBe(4000)  // 4s
    expect(calculateExponentialBackoff(4)).toBe(8000)  // 8s
    expect(calculateExponentialBackoff(5)).toBe(10000) // 10s (capped)
    expect(calculateExponentialBackoff(6)).toBe(10000) // 10s (capped)
  })

  it('should handle edge case: attempt < 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 0 }),
        baseDelayArb,
        maxDelayArb,
        (attempt, baseDelay, maxDelay) => {
          const delay = calculateExponentialBackoff(attempt, baseDelay, maxDelay)
          // Should return baseDelay for invalid attempts
          return delay === baseDelay
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should handle edge case: baseDelay <= 0', () => {
    fc.assert(
      fc.property(
        attemptArb,
        fc.integer({ min: -1000, max: 0 }),
        maxDelayArb,
        (attempt, baseDelay, maxDelay) => {
          const delay = calculateExponentialBackoff(attempt, baseDelay, maxDelay)
          return delay === 0
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should handle edge case: maxDelay <= 0', () => {
    fc.assert(
      fc.property(
        attemptArb,
        baseDelayArb,
        fc.integer({ min: -1000, max: 0 }),
        (attempt, baseDelay, maxDelay) => {
          const delay = calculateExponentialBackoff(attempt, baseDelay, maxDelay)
          return delay === 0
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should be monotonically increasing until maxDelay', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        baseDelayArb,
        maxDelayArb,
        (attempt, baseDelay, maxDelay) => {
          const delay1 = calculateExponentialBackoff(attempt, baseDelay, maxDelay)
          const delay2 = calculateExponentialBackoff(attempt + 1, baseDelay, maxDelay)
          
          // delay2 should be >= delay1 (monotonically increasing)
          return delay2 >= delay1
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * **Property P6: 非幂等请求不重试**
 * **Validates: Requirements 2.1.3**
 * 
 * 属性: POST/PUT/DELETE/PATCH 请求在任何错误时都不自动重试。
 * 
 * ∀ method ∈ {POST, PUT, DELETE, PATCH}, ∀ error:
 *   request(method, url, error) → retryCount = 0
 */
describe('Property P6: 非幂等请求不重试', () => {
  // 非幂等方法生成器
  const nonIdempotentMethodArb = fc.constantFrom('POST', 'PUT', 'DELETE', 'PATCH')
  
  // 幂等方法生成器
  const idempotentMethodArb = fc.constantFrom('GET', 'HEAD', 'OPTIONS')
  
  // 5xx 状态码生成器
  const serverErrorStatusArb = fc.integer({ min: 500, max: 599 })
  
  // 网络错误代码生成器
  const networkErrorCodeArb = fc.constantFrom(
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ERR_NETWORK'
  )

  it('should never retry POST requests regardless of error type', () => {
    fc.assert(
      fc.property(
        serverErrorStatusArb,
        (status) => {
          const config = createMockConfig({ method: 'POST' })
          const error = createMockAxiosError({ status })
          
          return shouldRetryRequest(config, error) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should never retry PUT requests regardless of error type', () => {
    fc.assert(
      fc.property(
        serverErrorStatusArb,
        (status) => {
          const config = createMockConfig({ method: 'PUT' })
          const error = createMockAxiosError({ status })
          
          return shouldRetryRequest(config, error) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should never retry DELETE requests regardless of error type', () => {
    fc.assert(
      fc.property(
        serverErrorStatusArb,
        (status) => {
          const config = createMockConfig({ method: 'DELETE' })
          const error = createMockAxiosError({ status })
          
          return shouldRetryRequest(config, error) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should never retry PATCH requests regardless of error type', () => {
    fc.assert(
      fc.property(
        serverErrorStatusArb,
        (status) => {
          const config = createMockConfig({ method: 'PATCH' })
          const error = createMockAxiosError({ status })
          
          return shouldRetryRequest(config, error) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should never retry any non-idempotent method on network errors', () => {
    fc.assert(
      fc.property(
        nonIdempotentMethodArb,
        networkErrorCodeArb,
        (method, code) => {
          const config = createMockConfig({ method })
          const error = createMockAxiosError({ code, hasResponse: false })
          
          return shouldRetryRequest(config, error) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should never retry any non-idempotent method on server errors', () => {
    fc.assert(
      fc.property(
        nonIdempotentMethodArb,
        serverErrorStatusArb,
        (method, status) => {
          const config = createMockConfig({ method })
          const error = createMockAxiosError({ status })
          
          return shouldRetryRequest(config, error) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should correctly identify non-idempotent methods (case insensitive)', () => {
    fc.assert(
      fc.property(
        nonIdempotentMethodArb,
        fc.constantFrom('lower', 'upper', 'mixed'),
        (method, caseType) => {
          let testMethod: string
          switch (caseType) {
            case 'lower':
              testMethod = method.toLowerCase()
              break
            case 'upper':
              testMethod = method.toUpperCase()
              break
            case 'mixed':
              testMethod = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase()
              break
            default:
              testMethod = method
          }
          
          return isNonIdempotentMethod(testMethod) === true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should correctly identify idempotent methods', () => {
    fc.assert(
      fc.property(
        idempotentMethodArb,
        (method) => {
          return isIdempotentMethod(method) === true && isNonIdempotentMethod(method) === false
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should retry GET requests on server errors (5xx)', () => {
    fc.assert(
      fc.property(
        serverErrorStatusArb,
        (status) => {
          const config = createMockConfig({ method: 'GET' })
          const error = createMockAxiosError({ status })
          
          return shouldRetryRequest(config, error) === true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should retry GET requests on network errors', () => {
    fc.assert(
      fc.property(
        networkErrorCodeArb,
        (code) => {
          const config = createMockConfig({ method: 'GET' })
          const error = createMockAxiosError({ code, hasResponse: false })
          
          return shouldRetryRequest(config, error) === true
        }
      ),
      { numRuns: 50 }
    )
  })

  it('should not retry GET requests on 4xx errors', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 499 }),
        (status) => {
          const config = createMockConfig({ method: 'GET' })
          const error = createMockAxiosError({ status })
          
          return shouldRetryRequest(config, error) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should respect maxRetries limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        serverErrorStatusArb,
        (maxRetries, status) => {
          const config = createMockConfig({ 
            method: 'GET',
            retryCount: maxRetries,
            retryConfig: { maxRetries }
          })
          const error = createMockAxiosError({ status })
          
          // Should not retry when retryCount >= maxRetries
          return shouldRetryRequest(config, error) === false
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should allow retry when retryCount < maxRetries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        serverErrorStatusArb,
        (maxRetries, status) => {
          const config = createMockConfig({ 
            method: 'GET',
            retryCount: maxRetries - 1,
            retryConfig: { maxRetries }
          })
          const error = createMockAxiosError({ status })
          
          // Should retry when retryCount < maxRetries
          return shouldRetryRequest(config, error) === true
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Additional tests for retry condition functions
 */
describe('Retry Condition Functions', () => {
  describe('isNetworkError', () => {
    it('should return true for errors without response', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ERR_NETWORK'),
          (code) => {
            const error = createMockAxiosError({ code, hasResponse: false })
            return isNetworkError(error) === true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should return false for errors with response', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 599 }),
          (status) => {
            const error = createMockAxiosError({ status, hasResponse: true })
            return isNetworkError(error) === false
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('isServerError', () => {
    it('should return true for 5xx status codes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 500, max: 599 }),
          (status) => {
            const error = createMockAxiosError({ status })
            return isServerError(error) === true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return false for non-5xx status codes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 499 }),
          (status) => {
            const error = createMockAxiosError({ status })
            return isServerError(error) === false
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return false for network errors (no response)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('ECONNREFUSED', 'ECONNRESET'),
          (code) => {
            const error = createMockAxiosError({ code, hasResponse: false })
            return isServerError(error) === false
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  describe('defaultRetryCondition', () => {
    it('should return true for network errors OR server errors', () => {
      // Network error
      const networkError = createMockAxiosError({ code: 'ECONNREFUSED', hasResponse: false })
      expect(defaultRetryCondition(networkError)).toBe(true)
      
      // Server error
      const serverError = createMockAxiosError({ status: 500 })
      expect(defaultRetryCondition(serverError)).toBe(true)
    })

    it('should return false for client errors (4xx)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 400, max: 499 }),
          (status) => {
            const error = createMockAxiosError({ status })
            return defaultRetryCondition(error) === false
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

/**
 * Tests for retry configuration options
 */
describe('Retry Configuration', () => {
  it('should respect custom retry condition', () => {
    // Custom condition: only retry on 503
    const customCondition = (error: AxiosError) => error.response?.status === 503
    
    const config = createMockConfig({
      method: 'GET',
      retryConfig: { retryCondition: customCondition }
    })
    
    // Should retry on 503
    const error503 = createMockAxiosError({ status: 503 })
    expect(shouldRetryRequest(config, error503)).toBe(true)
    
    // Should not retry on 500
    const error500 = createMockAxiosError({ status: 500 })
    expect(shouldRetryRequest(config, error500)).toBe(false)
  })

  it('should respect shouldRetry=false override', () => {
    const config = createMockConfig({
      method: 'GET',
      retryConfig: { shouldRetry: false }
    })
    
    const error = createMockAxiosError({ status: 500 })
    expect(shouldRetryRequest(config, error)).toBe(false)
  })

  it('should respect shouldRetry=true override for non-idempotent methods', () => {
    const config = createMockConfig({
      method: 'POST',
      retryConfig: { shouldRetry: true }
    })
    
    const error = createMockAxiosError({ status: 500 })
    // Even with shouldRetry=true, still needs to pass retry condition
    expect(shouldRetryRequest(config, error)).toBe(true)
  })

  it('should use default config when no custom config provided', () => {
    const config = createMockConfig({ method: 'GET' })
    const error = createMockAxiosError({ status: 500 })
    
    // Should use default maxRetries (3)
    expect(shouldRetryRequest(config, error)).toBe(true)
    
    // After 3 retries, should stop
    config.__retryCount = 3
    config.__retryConfig = DEFAULT_RETRY_CONFIG
    expect(shouldRetryRequest(config, error)).toBe(false)
  })
})

/**
 * Tests for method constants
 */
describe('Method Constants', () => {
  it('should have correct idempotent methods', () => {
    expect(IDEMPOTENT_METHODS).toContain('GET')
    expect(IDEMPOTENT_METHODS).toContain('HEAD')
    expect(IDEMPOTENT_METHODS).toContain('OPTIONS')
    expect(IDEMPOTENT_METHODS).not.toContain('POST')
    expect(IDEMPOTENT_METHODS).not.toContain('PUT')
    expect(IDEMPOTENT_METHODS).not.toContain('DELETE')
    expect(IDEMPOTENT_METHODS).not.toContain('PATCH')
  })

  it('should have correct non-idempotent methods', () => {
    expect(NON_IDEMPOTENT_METHODS).toContain('POST')
    expect(NON_IDEMPOTENT_METHODS).toContain('PUT')
    expect(NON_IDEMPOTENT_METHODS).toContain('DELETE')
    expect(NON_IDEMPOTENT_METHODS).toContain('PATCH')
    expect(NON_IDEMPOTENT_METHODS).not.toContain('GET')
    expect(NON_IDEMPOTENT_METHODS).not.toContain('HEAD')
    expect(NON_IDEMPOTENT_METHODS).not.toContain('OPTIONS')
  })

  it('should have no overlap between idempotent and non-idempotent methods', () => {
    const idempotentSet = new Set(IDEMPOTENT_METHODS)
    const nonIdempotentSet = new Set(NON_IDEMPOTENT_METHODS)
    
    for (const method of idempotentSet) {
      expect(nonIdempotentSet.has(method as any)).toBe(false)
    }
    
    for (const method of nonIdempotentSet) {
      expect(idempotentSet.has(method as any)).toBe(false)
    }
  })
})
