/**
 * API Module - Backward Compatibility Layer
 *
 * This file provides backward compatibility for imports from the old api/index.ts.
 * The API client has been consolidated in @/5-shared/api/client.ts.
 *
 * Migration Map:
 * - apiService → Use @/5-shared/api/client's apiClient instance
 * - Individual methods → Available on apiClient (get, post, put, delete, patch, upload, download)
 *
 * @deprecated Import from @/5-shared/api/client instead
 */

// Re-export the unified API client
export { ApiClient, apiClient } from '@/5-shared/api/client'
export type { ApiClientConfig, AppError } from '@/5-shared/api/client'

// Re-export legacy apiService wrapper for backward compatibility
export const apiService = {
  async get<T>(url: string, params?: Record<string, unknown>) {
    const { apiClient } = await import('@/5-shared/api/client')
    return apiClient.get<T>(url, params)
  },

  async post<T>(url: string, data?: unknown) {
    const { apiClient } = await import('@/5-shared/api/client')
    return apiClient.post<T>(url, data)
  },

  async put<T>(url: string, data?: unknown) {
    const { apiClient } = await import('@/5-shared/api/client')
    return apiClient.put<T>(url, data)
  },

  async delete<T>(url: string) {
    const { apiClient } = await import('@/5-shared/api/client')
    return apiClient.delete<T>(url)
  },

  async patch<T>(url: string, data?: unknown) {
    const { apiClient } = await import('@/5-shared/api/client')
    return apiClient.patch<T>(url, data)
  },

  async upload<T>(url: string, file: File, additionalData?: Record<string, unknown>) {
    const { apiClient } = await import('@/5-shared/api/client')
    return apiClient.upload<T>(url, file, additionalData)
  },

  async download(url: string, filename?: string) {
    const { apiClient } = await import('@/5-shared/api/client')
    return apiClient.download(url, filename)
  }
}

// Re-export utility functions
export { formatErrorMessage, isRetryableError, getErrorSeverity } from '@/5-shared/api/errorHandler'
export type { ExtendedErrorInfo } from '@/5-shared/types/error'
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
} from '@/5-shared/lib/utils/cache'

// Re-export retry utilities
export {
  createRetryInterceptor,
  withRetry,
  withoutRetry,
  forceRetry,
  type RetryConfig
} from '@/5-shared/api/retry'

// Default export for backward compatibility (import api from '@/5-shared/api')
export { apiClient as default } from '@/5-shared/api/client'
