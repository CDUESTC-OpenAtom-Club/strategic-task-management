/**
 * 简化的重试拦截器
 *
 * 为 GET 请求提供基础重试功能
 * 内部管理系统不需要复杂的指数退避算法
 *
 * Phase 3 重构: 从 250+ 行简化到 20 行
 */

import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'

export interface RetryConfig {
  maxRetries: number
  retryDelay: number // 固定延迟,不使用指数退避
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1秒固定延迟
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  __retryCount?: number
}

/**
 * 创建简化的重试拦截器
 */
export function createRetryInterceptor(
  axiosInstance: AxiosInstance,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
) {
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const requestConfig = error.config as RetryableRequestConfig

      // 初始化重试计数
      requestConfig.__retryCount = requestConfig.__retryCount || 0

      // 判断是否应该重试
      const shouldRetry =
        requestConfig.__retryCount < config.maxRetries &&
        requestConfig.method?.toUpperCase() === 'GET' && // 只重试 GET 请求
        error.code === 'ECONNABORTED' || // 只重试网络错误
        error.code === 'ETIMEDOUT'

      if (!shouldRetry) {
        return Promise.reject(error)
      }

      // 增加重试计数
      requestConfig.__retryCount++

      // 等待固定延迟后重试
      await new Promise((resolve) => setTimeout(resolve, config.retryDelay))

      // 重试请求
      return axiosInstance(requestConfig)
    }
  )
}
