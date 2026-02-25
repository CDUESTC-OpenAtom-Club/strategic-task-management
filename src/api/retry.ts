/**
 * Retry Interceptor for API Requests
 * 
 * **Feature: sism-enterprise-optimization**
 * 
 * Provides automatic retry functionality for GET requests with exponential backoff.
 * Non-idempotent requests (POST, PUT, DELETE, PATCH) are NOT retried by default.
 * 
 * **Validates: Requirements 2.1.1, 2.1.2, 2.1.3, 2.1.4**
 */

import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { logger } from '@/utils/logger'

/**
 * HTTP methods that are considered idempotent and safe to retry
 */
export const IDEMPOTENT_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const
export type IdempotentMethod = typeof IDEMPOTENT_METHODS[number]

/**
 * HTTP methods that are NOT idempotent and should NOT be retried by default
 */
export const NON_IDEMPOTENT_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'] as const
export type NonIdempotentMethod = typeof NON_IDEMPOTENT_METHODS[number]

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number
  /** Base delay in milliseconds (default: 1000) */
  baseDelay: number
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay: number
  /** Custom retry condition function */
  retryCondition?: (error: AxiosError) => boolean
  /** Whether to retry this specific request (overrides method-based logic) */
  shouldRetry?: boolean
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
}

/**
 * Extended request config with retry information
 */
export interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  __retryCount?: number
  __retryConfig?: RetryConfig
}

/**
 * Calculate exponential backoff delay
 * 
 * Formula: min(baseDelay * 2^(attempt-1), maxDelay)
 * 
 * For default config (baseDelay=1000, maxDelay=10000):
 * - Attempt 1: 1000ms (1s)
 * - Attempt 2: 2000ms (2s)
 * - Attempt 3: 4000ms (4s)
 * - Attempt 4: 8000ms (8s)
 * - Attempt 5+: 10000ms (10s, capped at maxDelay)
 * 
 * @param attempt - Current retry attempt number (1-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateExponentialBackoff(
  attempt: number,
  baseDelay: number = DEFAULT_RETRY_CONFIG.baseDelay,
  maxDelay: number = DEFAULT_RETRY_CONFIG.maxDelay
): number {
  // Validate inputs
  if (attempt < 1) {
    return baseDelay
  }
  if (baseDelay <= 0) {
    return 0
  }
  if (maxDelay <= 0) {
    return 0
  }

  // Calculate delay: baseDelay * 2^(attempt-1)
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
  
  // Cap at maxDelay
  return Math.min(exponentialDelay, maxDelay)
}

/**
 * Check if an HTTP method is idempotent (safe to retry)
 * 
 * @param method - HTTP method string
 * @returns true if the method is idempotent
 */
export function isIdempotentMethod(method: string | undefined): boolean {
  if (!method) return false
  const upperMethod = method.toUpperCase()
  return IDEMPOTENT_METHODS.includes(upperMethod as IdempotentMethod)
}

/**
 * Check if an HTTP method is non-idempotent (NOT safe to retry)
 * 
 * @param method - HTTP method string
 * @returns true if the method is non-idempotent
 */
export function isNonIdempotentMethod(method: string | undefined): boolean {
  if (!method) return false
  const upperMethod = method.toUpperCase()
  return NON_IDEMPOTENT_METHODS.includes(upperMethod as NonIdempotentMethod)
}

/**
 * Check if an error is a network error (no response received)
 * 
 * @param error - Axios error object
 * @returns true if it's a network error
 */
export function isNetworkError(error: AxiosError): boolean {
  // No response means network error (timeout, connection refused, etc.)
  return !error.response && Boolean(error.code)
}

/**
 * Check if an error is a server error (5xx status code)
 * 
 * @param error - Axios error object
 * @returns true if it's a 5xx server error
 */
export function isServerError(error: AxiosError): boolean {
  const status = error.response?.status
  return status !== undefined && status >= 500 && status < 600
}

/**
 * Default retry condition: retry on network errors or 5xx server errors
 * 
 * @param error - Axios error object
 * @returns true if the request should be retried
 */
export function defaultRetryCondition(error: AxiosError): boolean {
  return isNetworkError(error) || isServerError(error)
}

/**
 * Determine if a request should be retried based on method and configuration
 * 
 * Rules:
 * 1. If shouldRetry is explicitly set in config, use that value
 * 2. Non-idempotent methods (POST, PUT, DELETE, PATCH) are NEVER retried by default
 * 3. Idempotent methods (GET, HEAD, OPTIONS) are retried if retry condition is met
 * 
 * @param config - Request configuration
 * @param error - Axios error object
 * @returns true if the request should be retried
 */
export function shouldRetryRequest(
  config: RetryableRequestConfig,
  error: AxiosError
): boolean {
  const retryConfig = config.__retryConfig || DEFAULT_RETRY_CONFIG
  const currentRetryCount = config.__retryCount || 0
  
  // Check if we've exceeded max retries
  if (currentRetryCount >= retryConfig.maxRetries) {
    return false
  }
  
  // If shouldRetry is explicitly set, use that value
  if (retryConfig.shouldRetry !== undefined) {
    if (!retryConfig.shouldRetry) {
      return false
    }
    // If shouldRetry is true, still check the retry condition
    const retryCondition = retryConfig.retryCondition || defaultRetryCondition
    return retryCondition(error)
  }
  
  // Non-idempotent methods are NEVER retried by default
  if (isNonIdempotentMethod(config.method)) {
    return false
  }
  
  // For idempotent methods, check the retry condition
  const retryCondition = retryConfig.retryCondition || defaultRetryCondition
  return retryCondition(error)
}

/**
 * Sleep for a specified duration
 * 
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create retry interceptor for an Axios instance
 * 
 * This function adds response interceptor that handles automatic retries
 * for failed requests based on the retry configuration.
 * 
 * @param axiosInstance - Axios instance to add retry interceptor to
 * @param defaultConfig - Default retry configuration (optional)
 */
export function createRetryInterceptor(
  axiosInstance: AxiosInstance,
  defaultConfig: Partial<RetryConfig> = {}
): void {
  const mergedDefaultConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...defaultConfig,
  }

  // Response interceptor for handling retries
  axiosInstance.interceptors.response.use(
    // Success handler - pass through
    (response: AxiosResponse) => response,
    
    // Error handler - check if we should retry
    async (error: AxiosError) => {
      const config = error.config as RetryableRequestConfig | undefined
      
      if (!config) {
        return Promise.reject(error)
      }
      
      // Initialize retry config if not set
      if (!config.__retryConfig) {
        config.__retryConfig = { ...mergedDefaultConfig }
      }
      
      // Initialize retry count if not set
      if (config.__retryCount === undefined) {
        config.__retryCount = 0
      }
      
      // Check if we should retry
      if (!shouldRetryRequest(config, error)) {
        logger.debug('🔄 [Retry] Not retrying request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          retryCount: config.__retryCount,
          reason: isNonIdempotentMethod(config.method) 
            ? 'Non-idempotent method' 
            : config.__retryCount >= config.__retryConfig.maxRetries
              ? 'Max retries exceeded'
              : 'Retry condition not met',
        })
        return Promise.reject(error)
      }
      
      // Increment retry count
      config.__retryCount += 1
      
      // Calculate delay
      const delay = calculateExponentialBackoff(
        config.__retryCount,
        config.__retryConfig.baseDelay,
        config.__retryConfig.maxDelay
      )
      
      logger.info('🔄 [Retry] Retrying request', {
        method: config.method?.toUpperCase(),
        url: config.url,
        attempt: config.__retryCount,
        maxRetries: config.__retryConfig.maxRetries,
        delay: `${delay}ms`,
        errorCode: error.code,
        errorStatus: error.response?.status,
      })
      
      // Wait before retrying
      await sleep(delay)
      
      // Retry the request
      return axiosInstance.request(config)
    }
  )
}

/**
 * Create a request config with custom retry settings
 * 
 * @param config - Partial retry configuration
 * @returns Object to spread into axios request config
 */
export function withRetry(config: Partial<RetryConfig>): { __retryConfig: RetryConfig } {
  return {
    __retryConfig: {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
    },
  }
}

/**
 * Create a request config that disables retry
 * 
 * @returns Object to spread into axios request config
 */
export function withoutRetry(): { __retryConfig: RetryConfig } {
  return {
    __retryConfig: {
      ...DEFAULT_RETRY_CONFIG,
      shouldRetry: false,
    },
  }
}

/**
 * Create a request config that forces retry even for non-idempotent methods
 * 
 * WARNING: Use with caution! This can cause duplicate operations.
 * Only use when you're certain the operation is actually idempotent.
 * 
 * @param config - Optional partial retry configuration
 * @returns Object to spread into axios request config
 */
export function forceRetry(config: Partial<RetryConfig> = {}): { __retryConfig: RetryConfig } {
  return {
    __retryConfig: {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
      shouldRetry: true,
    },
  }
}
