/**
 * Shared API canonical facade.
 *
 * This module is the preferred public entry for shared API access and retry helpers.
 * Lower-level modules remain available under `@/shared/api/*` when a feature needs
 * a more specific import such as `@/shared/api/client`.
 */

// Re-export the unified API client
export { ApiClient, apiClient } from '@/shared/api/client'
export type { ApiClientConfig, AppError } from '@/shared/api/client'

// Keep the legacy apiService facade for callers that still use Axios-like semantics.
export const apiService = {
  async get<T>(url: string, params?: Record<string, unknown>) {
    const { apiClient } = await import('@/shared/api/client')
    return apiClient.get<T>(url, params)
  },

  async post<T>(url: string, data?: unknown) {
    const { apiClient } = await import('@/shared/api/client')
    return apiClient.post<T>(url, data)
  },

  async put<T>(url: string, data?: unknown) {
    const { apiClient } = await import('@/shared/api/client')
    return apiClient.put<T>(url, data)
  },

  async delete<T>(url: string) {
    const { apiClient } = await import('@/shared/api/client')
    return apiClient.delete<T>(url)
  },

  async patch<T>(url: string, data?: unknown) {
    const { apiClient } = await import('@/shared/api/client')
    return apiClient.patch<T>(url, data)
  },

  async upload<T>(url: string, file: File, additionalData?: Record<string, unknown>) {
    const { apiClient } = await import('@/shared/api/client')
    return apiClient.upload<T>(url, file, additionalData)
  },

  async download(url: string, filename?: string) {
    const { apiClient } = await import('@/shared/api/client')
    return apiClient.download(url, filename)
  }
}

// Re-export utility functions
export { formatErrorMessage, isRetryableError, getErrorSeverity } from '@/shared/api/errorHandler'
export type { ExtendedErrorInfo } from '@/shared/types/error'
export {
  buildQueryKey,
  serializeQueryKey,
  fetchWithCache,
  invalidateQueries,
  queryCache,
  refreshCache,
  refreshCachePattern,
  cacheManager,
  getFromCache
} from '@/shared/lib/utils/cache'

// Re-export retry utilities
export {
  createRetryInterceptor,
  withRetry,
  withoutRetry,
  forceRetry,
  type RetryConfig
} from '@/shared/api/retry'

// Default export for callers using `import api from '@/shared/api'`.
export { apiClient as default } from '@/shared/api/client'
