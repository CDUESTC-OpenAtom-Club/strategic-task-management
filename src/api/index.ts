/**
 * API Module - Backward Compatibility Layer
 *
 * This file provides backward compatibility for imports from the old api/index.ts.
 * The API client has been consolidated in @/shared/api/client.ts.
 *
 * Migration Map:
 * - apiService → Use @/shared/api/client's apiClient instance
 * - Individual methods → Available on apiClient (get, post, put, delete, patch, upload, download)
 *
 * @deprecated Import from @/shared/api/client instead
 */

// Re-export the unified API client
export { ApiClient, apiClient } from '@/shared/api/client'
export type { ApiClientConfig, AppError } from '@/shared/api/client'

// Re-export legacy apiService wrapper for backward compatibility
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

  async upload<T>(
    url: string,
    file: File,
    additionalData?: Record<string, unknown>
  ) {
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
export type { ExtendedErrorInfo } from '@/types/error'
export { refreshCache, refreshCachePattern, cacheManager, getFromCache } from '@/utils/cache'

// Re-export feature APIs for backward compatibility
export { approvalApi } from '@/features/approval/api/approval'
export { indicatorApi } from '@/features/strategic-indicator/api/indicator'
export { milestoneApi } from '@/features/strategic-indicator/api/milestone'
export { orgApi } from '@/features/organization/api/org'
export { userApi } from '@/features/auth/api/user'
export { planApi, indicatorFillApi, planFillApi } from '@/features/plan/api/planApi'
export { strategicApi } from '@/features/task/api/strategicApi'

// Default export for backward compatibility (import api from '@/api')
export { apiClient as default } from '@/shared/api/client'
