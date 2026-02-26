import axios from 'axios'
import type { AxiosError } from 'axios'
import type { ApiResponse } from '@/types'
import { logger } from '@/utils/logger'
import { formatErrorMessage, isRetryableError, getErrorSeverity } from './errorHandler'
import type { ExtendedErrorInfo } from '@/types/error'
import { refreshCache, refreshCachePattern, cacheManager, getFromCache } from '@/utils/cache'
import { useAuthStore } from '@/stores/auth'

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// ============================================================================
// 简化的拦截器 - 只保留核心功能
// ============================================================================

// 请求拦截器: Token注入
api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    const token = authStore.token

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    logger.error('❌ [Request Error]', error.message)
    return Promise.reject(error)
  }
)

// 响应拦截器: 错误处理
api.interceptors.response.use(
  (response) => {
    // 成功响应直接返回
    return response
  },
  async (error: AxiosError) => {
    // 401 未授权 - 跳转登录
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login')
      if (!isLoginRequest) {
        const authStore = useAuthStore()
        authStore.logout()
        
        const { ElMessage } = await import('element-plus')
        ElMessage.warning({
          message: '登录已过期，请重新登录',
          duration: 3000,
          showClose: true
        })
        
        setTimeout(() => {
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login'
          }
        }, 100)
      }
    }

    // 403 权限不足
    if (error.response?.status === 403) {
      const isHealthCheck = error.config?.url?.includes('/actuator/health') ||
                           error.config?.url?.includes('/orgs') ||
                           error.config?.url?.includes('/indicators') ||
                           error.config?.url?.includes('/tasks') ||
                           error.config?.url?.includes('/milestones')
      
      const isHealthCheckRequest = error.config?.headers?.['X-Health-Check'] === 'true'
      
      if (!isHealthCheck && !isHealthCheckRequest) {
        const { ElMessage } = await import('element-plus')
        ElMessage.error({
          message: '权限不足，无法执行此操作',
          duration: 3000,
          showClose: true
        })
      }
    }

    // 500 服务器错误
    if (error.response?.status === 500) {
      const { ElMessage } = await import('element-plus')
      ElMessage.error({
        message: '服务器内部错误，请稍后重试或联系管理员',
        duration: 5000,
        showClose: true
      })
    }

    // 网络连接错误
    if (!error.response && error.request) {
      const { ElMessage } = await import('element-plus')
      ElMessage.error({
        message: '无法连接到后端服务，请确认后端服务已启动',
        duration: 5000,
        showClose: true
      })
    }

    // 超时错误
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      const { ElMessage } = await import('element-plus')
      ElMessage.warning({
        message: '请求超时，请检查网络连接或稍后重试',
        duration: 4000,
        showClose: true
      })
    }

    logger.error('❌ [API Error]', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      status: error.response?.status,
      message: error.message
    })

    return Promise.reject(error)
  }
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
