/**
 * 简化的 API Client
 *
 * 这是一个纯粹的网络请求封装层，只负责：
 * 1. Token 注入
 * 2. 错误转换
 * 3. 基础的请求/响应拦截
 *
 * 不包含：
 * - 自动重试（应在业务层显式处理）
 * - 请求去重（应在业务层显式处理）
 * - 复杂的 Mock 切换逻辑
 *
 * **Validates: Requirements 2.3, 2.6, 2.7**
 */

import axios, { AxiosError } from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { tokenManager } from '@/shared/lib/utils/tokenManager'
import { logger } from '@/shared/lib/utils/logger'
import type { ApiErrorResponse } from '@/shared/types/error'
import { createRequestInterceptor } from '@/shared/api/interceptors/requestInterceptors'
import { createResponseInterceptor, createResponseErrorInterceptor } from '@/shared/api/interceptors/responseInterceptors'
import { API_BASE_URL, API_TIMEOUT, USE_MOCK } from '@/shared/config/api'

/**
 * 应用错误类型
 */
export interface AppError {
  /** HTTP 状态码 */
  code: number
  /** 错误消息 */
  message: string
  /** 详细错误信息 */
  details?: unknown
}

/**
 * API Client 配置
 */
export interface ApiClientConfig {
  /** API 基础 URL */
  baseURL: string
  /** 请求超时时间（毫秒） */
  timeout?: number
}

/**
 * 简化的 API Client 类
 *
 * 提供基础的 HTTP 请求功能，包含 Token 注入和错误转换
 */
export class ApiClient {
  private client: AxiosInstance

  constructor(config: ApiClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (USE_MOCK) {
      logger.debug('🎭 [Mock Mode] 初始化 Mock API 客户端')
    } else {
      logger.debug('🔗 [Proxy Mode] 使用代理到后端 API')
    }

    // 使用共享的请求和响应拦截器（包含 Mock API 支持）
    this.client.interceptors.request.use(createRequestInterceptor({ useMock: USE_MOCK }))
    this.client.interceptors.response.use(
      createResponseInterceptor({ useMock: USE_MOCK }),
      createResponseErrorInterceptor({ useMock: USE_MOCK })
    )

    // 保留原始的简单拦截器作为补充
    this.setupRequestInterceptor()
    this.setupResponseInterceptor()
  }

  /**
   * 设置请求拦截器
   * 功能：注入 Token 和请求日志
   */
  private setupRequestInterceptor(): void {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // 注入 Token
        const token = tokenManager.getAccessToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // 请求日志
        logger.debug(`[API] ${config.method} ${config.url}`, {
          params: config.params,
          data: config.data
        })

        return config
      },
      error => {
        logger.error('[API] Request error:', error)
        return Promise.reject(error)
      }
    )
  }

  /**
   * 设置响应拦截器
   * 功能：错误转换和 401 处理
   */
  private setupResponseInterceptor(): void {
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // 响应日志
        logger.debug(`[API] Response ${response.status}:`, response.data)
        return response.data
      },
      (error: unknown) => {
        // 处理 401 错误：清除 Token 并跳转登录
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          logger.warn('[API] 401 Unauthorized - redirecting to login')
          tokenManager.clearAccessToken()
          window.location.href = '/login'
        }

        // 前置拦截器已经转成统一错误格式时，直接透传，避免把 400 再包装成 500/未知错误
        if (!axios.isAxiosError(error)) {
          logger.error('[API] Error:', error)
          return Promise.reject(error)
        }

        // 转换为统一的错误格式
        const appError = this.transformError(error)
        logger.error('[API] Error:', appError)

        return Promise.reject(appError)
      }
    )
  }

  /**
   * 将 HTTP 错误转换为应用错误格式
   *
   * @param error Axios 错误对象
   * @returns 统一的应用错误格式
   */
  private transformError(error: AxiosError): AppError {
    const statusCode = error.response?.status || 500
    const responseData = error.response?.data as ApiErrorResponse | undefined

    // 使用后端返回的业务错误码（如果有），否则使用 HTTP 状态码
    const errorCode = responseData?.code !== undefined ? responseData.code : statusCode

    return {
      code: errorCode,
      message: responseData?.message || error.message || '请求失败',
      details: responseData || error.response?.data
    }
  }

  /**
   * GET 请求
   */
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    // Backward compatibility: some legacy callers still pass Axios-style { params }.
    const normalizedParams =
      params &&
      typeof params === 'object' &&
      'params' in params &&
      Object.keys(params).length === 1
        ? (params as { params?: Record<string, unknown> }).params
        : params

    return this.client.get(url, { params: normalizedParams })
  }

  /**
   * POST 请求
   */
  async post<T>(url: string, data?: unknown): Promise<T> {
    return this.client.post(url, data)
  }

  /**
   * PUT 请求
   */
  async put<T>(url: string, data?: unknown): Promise<T> {
    console.log('[API Client] PUT request:', url, data)
    const result = await this.client.put(url, data)
    console.log('[API Client] PUT response:', result)
    return result
  }

  /**
   * DELETE 请求
   */
  async delete<T>(url: string): Promise<T> {
    return this.client.delete(url)
  }

  /**
   * PATCH 请求
   */
  async patch<T>(url: string, data?: unknown): Promise<T> {
    return this.client.patch(url, data)
  }

  /**
   * 文件上传请求
   */
  async upload<T>(url: string, file: File, additionalData?: Record<string, unknown>): Promise<T> {
    const formData = new FormData()
    formData.append('file', file)

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }

    return this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }

  /**
   * 文件下载请求
   */
  async download(url: string, filename?: string): Promise<void> {
    const response = await this.client.get(url, {
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

  /**
   * 获取底层 axios 实例（兼容需要读取响应头的调用）
   */
  getAxiosInstance(): AxiosInstance {
    return this.client
  }
}

/**
 * 默认 API Client 实例
 * 使用环境变量配置的基础 URL
 */
export const apiClient = new ApiClient({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT
})
