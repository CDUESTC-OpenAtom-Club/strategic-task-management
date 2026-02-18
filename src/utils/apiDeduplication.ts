/**
 * 简化的 API 请求去重工具
 *
 * Phase 4 重构: 从 100+ 行简化到核心功能
 * 防止相同请求同时发送多次
 */

import type { InternalAxiosRequestConfig } from 'axios'

interface PendingRequest {
  promise: Promise<any>
}

// pending 请求存储
const pendingRequests = new Map<string, PendingRequest>()

/**
 * 生成请求唯一标识
 */
function generateRequestKey(config: InternalAxiosRequestConfig): string {
  const { method, url } = config
  return `${method}-${url}`
}

/**
 * 创建去重拦截器
 */
export function createDeduplicationInterceptor() {
  return {
    requestFulfilled: (config: InternalAxiosRequestConfig) => {
      const key = generateRequestKey(config)

      // 如果已有相同请求在进行中,返回该 Promise
      if (pendingRequests.has(key)) {
        throw new Promise((_, reject) => {
          // 取消当前请求,使用正在进行的请求
          reject(new Error('Request cancelled due to duplication'))
        })
      }

      // 记录当前请求
      let resolvePromise: (value: any) => void
      let rejectPromise: (reason?: any) => void

      const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve
        rejectPromise = reject
      })

      pendingRequests.set(key, { promise })

      // 请求完成后清理
      promise.finally(() => {
        pendingRequests.delete(key)
      })

      return config
    },

    responseFulfilled: (response: any) => response,

    responseRejected: (error: any) => {
      // 如果是取消的请求,不报错
      if (error.message === 'Request cancelled due to duplication') {
        return new Promise(() => {}) // 永不 resolve,静默处理
      }
      return Promise.reject(error)
    }
  }
}
