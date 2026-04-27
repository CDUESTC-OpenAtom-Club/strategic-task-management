/**
 * @deprecated Compatibility entrypoint.
 * Canonical path: `@/shared/api` or feature-local `api` modules.
 * Remove after 2026-05-31.
 */

import { apiClient } from '@/shared/api/client'

export * from '@/shared/api'
export { apiClient }
export { planApi, indicatorFillApi, planFillApi } from '@/features/plan/api/planApi'
export { orgApi } from '@/features/organization/api/org'

async function withLegacyRetry<T>(operation: () => Promise<T>, attempts: number = 3): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === attempts) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 1000))
    }
  }

  throw lastError
}

function suppressUnhandled<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {})
  return promise
}

export const indicatorApi = {
  createIndicator(request: unknown) {
    return suppressUnhandled(withLegacyRetry(() => apiClient.post('/indicators', request)))
  },

  updateIndicator(id: string | number, request: unknown) {
    return suppressUnhandled(withLegacyRetry(() => apiClient.put(`/indicators/${id}`, request)))
  },

  deleteIndicator(id: string | number) {
    return suppressUnhandled(withLegacyRetry(() => apiClient.delete(`/indicators/${id}`)))
  },

  distributeIndicator(request: unknown) {
    return suppressUnhandled(
      withLegacyRetry(() => apiClient.post('/indicators/distribute', request))
    )
  },

  batchDistributeIndicator(request: unknown) {
    return suppressUnhandled(
      withLegacyRetry(() => apiClient.post('/indicators/distribute/batch', request))
    )
  },

  getAllIndicators(params?: Record<string, unknown>) {
    return apiClient.get('/indicators', params)
  },

  getIndicatorById(id: string | number) {
    return apiClient.get(`/indicators/${id}`)
  }
}

export default apiClient
