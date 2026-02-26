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
import { tokenManager } from '@/utils/tokenManager'
import { logger } from '@/utils/logger'
import type { ApiErrorResponse } from '@/types/error'

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
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

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
        logger.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data
        })

        return config
      },
      (error) => {
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
      (error: AxiosError) => {
        // 处理 401 错误：清除 Token 并跳转登录
        if (error.response?.status === 401) {
          logger.warn('[API] 401 Unauthorized - redirecting to login')
          tokenManager.clearAccessToken()
          window.location.href = '/login'
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

    return {
      code: statusCode,
      message: responseData?.message || error.message || '请求失败',
      details: responseData?.details || error.response?.data
    }
  }

  /**
   * GET 请求
   */
  async get<T>(url: string, params?: any): Promise<T> {
    return this.client.get(url, { params })
  }

  /**
   * POST 请求
   */
  async post<T>(url: string, data?: any): Promise<T> {
    return this.client.post(url, data)
  }

  /**
   * PUT 请求
   */
  async put<T>(url: string, data?: any): Promise<T> {
    return this.client.put(url, data)
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
  async patch<T>(url: string, data?: any): Promise<T> {
    return this.client.patch(url, data)
  }
}

/**
 * 默认 API Client 实例
 * 使用环境变量配置的基础 URL
 */
export const apiClient = new ApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000
})
