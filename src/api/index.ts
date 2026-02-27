import axios from 'axios'
import type { AxiosError } from 'axios'
import type { ApiResponse } from '@/types'
import { logger } from '@/utils/logger'
import { formatErrorMessage, isRetryableError, getErrorSeverity } from './errorHandler'
import type { ExtendedErrorInfo } from '@/types/error'
import { refreshCache, refreshCachePattern, cacheManager, getFromCache } from '@/utils/cache'
import { useAuthStore } from '@/stores/auth'
import { 
  createRequestInterceptor, 
  createRequestErrorInterceptor,
  createResponseInterceptor,
  createResponseErrorInterceptor
} from './interceptors'

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// ============================================================================
// 拦截器配置 - 包含Mock模式支持
// ============================================================================

// 请求拦截器: Token注入和Mock模式处理
api.interceptors.request.use(
  createRequestInterceptor(),
  createRequestErrorInterceptor()
)

// 响应拦截器: Mock模式处理和错误处理
api.interceptors.response.use(
  createResponseInterceptor(),
  createResponseErrorInterceptor()
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