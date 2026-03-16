/**
 * API Module
 *
 * Unified API client with comprehensive features:
 * - Request/response interceptors
 * - Authentication token handling
 * - Unified error handling
 * - Request/response transformation
 * - Automatic retry with exponential backoff
 * - Request cancellation support
 * - Loading state management
 *
 * Usage:
 * ```typescript
 * import { apiClient } from '@/shared/lib/api'
 *
 * // Simple GET request
 * const data = await apiClient.get('/users')
 *
 * // POST with data
 * const result = await apiClient.post('/users', { name: 'John' })
 *
 * // With cancellation
 * const cancelToken = apiClient.createCancelToken('fetchUsers')
 * const users = await apiClient.get('/users', {}, { cancelToken })
 *
 * // Cancel request
 * apiClient.cancelRequest('fetchUsers')
 * ```
 */

// Export client
export {
  ApiClient,
  createApiClient,
  apiClient,
  type ApiClientConfig,
  type RequestOptions
} from './client'

// Export interceptors
export {
  setupRequestInterceptors,
  setupResponseInterceptors,
  type InterceptorConfig
} from './interceptors'

// Export error handler
export {
  handleApiError,
  isRetryableError,
  isNetworkError,
  isServerError,
  isClientError,
  isAuthError,
  isApiError,
  formatErrorMessage,
  type ApiError
} from './errorHandler'

// Export retry utilities from unified location
export {
  createRetryInterceptor,
  withRetry as withRetryInterceptor,
  withoutRetry,
  forceRetry,
  type RetryConfig
} from '@/shared/api/retry'

// Export wrapper functions for explicit retry
export { withRetry, withExponentialRetry } from './wrappers'
