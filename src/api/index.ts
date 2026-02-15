import axios from 'axios'
import type { ApiResponse } from '@/types'
import { logger } from '@/utils/logger'
import { createRetryInterceptor, DEFAULT_RETRY_CONFIG } from './retry'
import {
  createRequestInterceptor,
  createRequestErrorInterceptor,
  createResponseInterceptor,
  createResponseErrorInterceptor
} from './interceptors'
import { formatErrorMessage, isRetryableError, getErrorSeverity } from './errorHandler'
import type { ExtendedErrorInfo } from '@/types/error'
import { refreshCache, refreshCachePattern, cacheManager, getFromCache } from '@/utils/cache'
import { createDeduplicationInterceptor } from '@/utils/apiDeduplication'

// 扩展 AxiosRequestConfig
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _startTime?: number
    _cacheKey?: string
    _useCache?: boolean
  }
}

// Mock 模式配置
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

if (USE_MOCK) {
  logger.warn('🎭 [Mock Mode] 已启用 Mock 模式 - 所有 API 请求将返回模拟数据')
}

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// ============================================================================
// 注册拦截器
// ============================================================================

// 1. 重试拦截器 (必须最先添加)
createRetryInterceptor(api, {
  maxRetries: DEFAULT_RETRY_CONFIG.maxRetries,
  baseDelay: DEFAULT_RETRY_CONFIG.baseDelay,
  maxDelay: DEFAULT_RETRY_CONFIG.maxDelay
})

// 2. API去重拦截器 (防止重复请求)
const dedupInterceptor = createDeduplicationInterceptor()
api.interceptors.request.use(
  dedupInterceptor.requestFulfilled,
  undefined,
  { synchronous: true } // 同步执行，优先级最高
)
api.interceptors.response.use(
  dedupInterceptor.responseFulfilled,
  dedupInterceptor.responseRejected
)

// 3. 请求拦截器
api.interceptors.request.use(
  createRequestInterceptor({ useMock: USE_MOCK }),
  createRequestErrorInterceptor()
)

// 4. 响应拦截器
api.interceptors.response.use(
  createResponseInterceptor({ useMock: USE_MOCK }),
  createResponseErrorInterceptor({ useMock: USE_MOCK })
)

// ============================================================================
// API 服务方法
// ============================================================================
export const apiService = {
  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await api.get(url, { params })
    return response.data
  },

  async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await api.post(url, data)
    return response.data
  },

  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await api.put(url, data)
    return response.data
  },

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await api.delete(url)
    return response.data
  },

  async patch<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await api.patch(url, data)
    return response.data
  },

  async upload<T>(
    url: string,
    file: File,
    additionalData?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const formData = new FormData()
    formData.append('file', file)

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }

    const response = await api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  async download(url: string, filename?: string): Promise<void> {
    const response = await api.get(url, {
      responseType: 'blob'
    })

    const blob = new Blob([response.data])
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  }
}

export default api

// 重新导出工具函数
export { formatErrorMessage, isRetryableError, getErrorSeverity } from './errorHandler'
export type { ExtendedErrorInfo } from '@/types/error'
export { refreshCache, refreshCachePattern, cacheManager, getFromCache } from '@/utils/cache'
