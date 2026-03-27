// @ts-nocheck
/**
 * API 请求去重与缓存工具
 *
 * 功能:
 * - 防止相同请求同时发送多次
 * - 5秒内相同请求返回缓存结果
 * - 自动清理过期的pending请求
 */

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

interface PendingRequest {
  promise: Promise<AxiosResponse>
  timestamp: number
}

// pending请求存储
const pendingRequests = new Map<string, PendingRequest>()

// 缓存配置
const CACHE_TTL = 5000 // 5秒缓存

/**
 * 生成请求唯一标识
 */
function generateRequestKey(config: InternalAxiosRequestConfig): string {
  const { method, url, params, data } = config
  return `${method}-${url}-${JSON.stringify(params || {})}-${JSON.stringify(data || {})}`
}

/**
 * 清理过期的pending请求
 */
function cleanupExpiredRequests() {
  const now = Date.now()
  for (const [key, request] of pendingRequests.entries()) {
    if (now - request.timestamp > CACHE_TTL) {
      pendingRequests.delete(key)
    }
  }
}

/**
 * 创建去重拦截器
 */
export function createDeduplicationInterceptor() {
  // 定期清理过期请求
  setInterval(cleanupExpiredRequests, 60000) // 每分钟清理一次

  return {
    /**
     * 请求拦截器 - 检查是否有相同请求正在进行
     */
    requestFulfilled: (config: InternalAxiosRequestConfig) => {
      // 只对GET请求进行去重
      if (config.method?.toLowerCase() !== 'get') {
        return config
      }

      const key = generateRequestKey(config)

      // 检查是否有相同请求正在进行
      if (pendingRequests.has(key)) {
        const pending = pendingRequests.get(key)

        if (!pending) {
          return config
        }

        // 如果请求在有效期内，返回相同Promise
        if (Date.now() - pending.timestamp < CACHE_TTL) {
          // 使用特殊的reject标记，让响应拦截器处理
          return Promise.reject({
            __deduplicated: true,
            promise: pending.promise,
            config
          })
        }
      }

      return config
    },

    /**
     * 响应拦截器 - 成功时清理pending请求
     */
    responseFulfilled: (response: AxiosResponse) => {
      const key = generateRequestKey(response.config as InternalAxiosRequestConfig)
      pendingRequests.delete(key)
      return response
    },

    /**
     * 响应错误拦截器 - 失败时也清理pending请求
     */
    responseRejected: (error: unknown) => {
      // 处理去重请求的特殊标记
      if (error.__deduplicated) {
        return error.promise
      }

      // 清理失败的请求
      if (error.config) {
        const key = generateRequestKey(error.config as InternalAxiosRequestConfig)
        pendingRequests.delete(key)
      }

      return Promise.reject(error)
    }
  }
}

/**
 * 存储正在进行的请求（供外部调用）
 */
export function storePendingRequest(key: string, promise: Promise<unknown>) {
  pendingRequests.set(key, {
    promise,
    timestamp: Date.now()
  })
}

/**
 * 清除指定请求的缓存
 */
export function clearRequestCache(config: InternalAxiosRequestConfig) {
  const key = generateRequestKey(config)
  pendingRequests.delete(key)
}

/**
 * 清除所有请求缓存
 */
export function clearAllRequestCache() {
  pendingRequests.clear()
}

/**
 * 获取当前pending请求数量
 */
export function getPendingRequestsCount(): number {
  return pendingRequests.size
}
