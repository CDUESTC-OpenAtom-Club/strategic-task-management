/**
 * API Retry Logic
 * 
 * Automatic retry with exponential backoff for failed requests
 * 
 * Features:
 * - Exponential backoff strategy
 * - Configurable retry attempts
 * - Idempotent method detection
 * - Custom retry conditions
 */

import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { isRetryableError } from './errorHandler'

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Base delay in milliseconds */
  baseDelay?: number
  /** Maximum delay in milliseconds */
  maxDelay?: number
  /** Custom retry condition function */
  retryCondition?: (error: AxiosError) => boolean
}

/**
 * Extended request config with retry metadata
 */
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  __retryCount?: number
  __retryConfig?: RetryConfig
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryCondition: (error: AxiosError) => isRetryableError(error)
}

/**
 * HTTP methods that are idempotent and safe to retry
 */
const IDEMPOTENT_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']

/**
 * Calculate exponential backoff delay
 * 
 * Formula: min(baseDelay * 2^(attempt-1), maxDelay)
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  if (attempt < 1) {return baseDelay}
  if (baseDelay <= 0) {return 0}
  if (maxDelay <= 0) {return 0}

  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
  return Math.min(exponentialDelay, maxDelay)
}

/**
 * Check if HTTP method is idempotent
 */
function isIdempotentMethod(method: string | undefined): boolean {
  if (!method) {return false}
  return IDEMPOTENT_METHODS.includes(method.toUpperCase())
}

/**
 * Check if request should be retried
 */
function shouldRetryRequest(
  config: RetryableRequestConfig,
  error: AxiosError,
  retryConfig: Required<RetryConfig>
): boolean {
  const currentRetryCount = config.__retryCount || 0

  // Check if max retries exceeded
  if (currentRetryCount >= retryConfig.maxRetries) {
    return false
  }

  // Only retry idempotent methods by default
  if (!isIdempotentMethod(config.method)) {
    return false
  }

  // Check custom retry condition
  return retryConfig.retryCondition(error)
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create retry interceptor for axios instance
 */
export function createRetryInterceptor(
  axiosInstance: AxiosInstance,
  config: RetryConfig = {}
): void {
  const retryConfig: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    ...config
  }

  // Response interceptor for handling retries
  axiosInstance.interceptors.response.use(
    // Success handler - pass through
    (response: AxiosResponse) => response,

    // Error handler - check if we should retry
    async (error: AxiosError) => {
      const requestConfig = error.config as RetryableRequestConfig | undefined

      if (!requestConfig) {
        return Promise.reject(error)
      }

      // Initialize retry config if not set
      if (!requestConfig.__retryConfig) {
        requestConfig.__retryConfig = retryConfig
      }

      // Initialize retry count if not set
      if (requestConfig.__retryCount === undefined) {
        requestConfig.__retryCount = 0
      }

      // Check if we should retry
      if (!shouldRetryRequest(requestConfig, error, retryConfig)) {
        return Promise.reject(error)
      }

      // Increment retry count
      requestConfig.__retryCount += 1

      // Calculate delay
      const delay = calculateBackoffDelay(
        requestConfig.__retryCount,
        retryConfig.baseDelay,
        retryConfig.maxDelay
      )

      // Log retry attempt (development only)
      if (import.meta.env.DEV) {
        console.log(
          `[API Retry] Attempt ${requestConfig.__retryCount}/${retryConfig.maxRetries} ` +
          `for ${requestConfig.method?.toUpperCase()} ${requestConfig.url} ` +
          `(delay: ${delay}ms)`
        )
      }

      // Wait before retrying
      await sleep(delay)

      // Retry the request
      return axiosInstance.request(requestConfig)
    }
  )
}

/**
 * Create request config with custom retry settings
 */
export function withRetry(config: RetryConfig): { __retryConfig: RetryConfig } {
  return {
    __retryConfig: {
      ...DEFAULT_RETRY_CONFIG,
      ...config
    }
  }
}

/**
 * Create request config that disables retry
 */
export function withoutRetry(): { __retryConfig: RetryConfig } {
  return {
    __retryConfig: {
      ...DEFAULT_RETRY_CONFIG,
      maxRetries: 0
    }
  }
}

/**
 * Create request config that forces retry even for non-idempotent methods
 * 
 * WARNING: Use with caution! This can cause duplicate operations.
 */
export function forceRetry(config: RetryConfig = {}): { __retryConfig: RetryConfig } {
  return {
    __retryConfig: {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
      retryCondition: () => true
    }
  }
}
