/**
 * API Client Wrapper Functions
 *
 * Provides wrapper functions for explicit retry logic
 * to replace local withRetry implementations in feature files
 */

// import { apiClient } from './client' // Commented - not currently used
import type { RetryConfig } from '@/shared/api/retry'
import { logger } from '@/shared/lib/utils/logger'

/**
 * Execute an async function with retry logic
 *
 * This is a wrapper function that provides explicit retry control
 * for critical operations, replacing local withRetry implementations.
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Promise with the function result
 *
 * @example
 * ```typescript
 * import { withRetry } from '@/shared/api'
 *
 * const result = await withRetry(async () => {
 *   return apiClient.post('/critical-endpoint', data)
 * }, { maxRetries: 3 })
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = config

  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      logger.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed:`, error)

      const explicitlyNonRetryable =
        typeof error === 'object' &&
        error !== null &&
        'retryable' in error &&
        (error as { retryable?: boolean }).retryable === false

      const status =
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        typeof (error as { status?: unknown }).status === 'number'
          ? (error as { status: number }).status
          : undefined

      const isClientError = status !== undefined && status >= 400 && status < 500

      if (explicitlyNonRetryable || isClientError) {
        logger.debug('[Retry] Error marked as non-retryable, aborting remaining attempts')
        break
      }

      if (attempt < maxRetries) {
        // 指数退避: 1s, 2s, 3s (capped at maxDelay)
        const delayMs = Math.min(baseDelay * attempt, maxDelay)
        logger.debug(`[Retry] Waiting ${delayMs}ms before next attempt`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  logger.error(`[Retry] All ${maxRetries} attempts failed`, lastError ?? new Error('Unknown error'))
  throw lastError ?? new Error('Unknown error')
}

/**
 * Execute an async function with exponential backoff retry
 *
 * Uses exponential backoff: 1s, 2s, 4s, 8s... (capped at maxDelay)
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Promise with the function result
 */
export async function withExponentialRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = config

  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      logger.warn(`[Retry] Attempt ${attempt}/${maxRetries} failed:`, error)

      if (attempt < maxRetries) {
        // 指数退避: 1s, 2s, 4s, 8s (capped at maxDelay)
        const delayMs = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
        logger.debug(`[Retry] Waiting ${delayMs}ms before next attempt`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  logger.error(`[Retry] All ${maxRetries} attempts failed`, lastError ?? new Error('Unknown error'))
  throw lastError ?? new Error('Unknown error')
}

/**
 * Re-export apiClient for convenience
 */
export { apiClient } from './client'
