/**
 * Request Interceptors - 请求拦截器模块
 *
 * Phase 4 重构: 简化拦截器,删除过度工程化功能
 *
 * 职责:
 * - Mock 模式处理
 * - 性能监控
 * - 缓存验证头
 * - 请求 ID
 * - 认证 Token
 *
 * 删除的功能:
 * - 请求签名 (内部系统不需要)
 * - 幂等性 Key (内部系统不需要)
 */

import type { InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import { generateRequestId } from '../errorHandler'
import {
  cacheManager,
  generateCacheKey,
  shouldCache,
  getCacheValidationHeaders
} from '@/utils/cache'

// Mock 模式配置
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/**
 * 请求拦截器配置
 */
export interface RequestInterceptorConfig {
  useMock?: boolean
}

/**
 * 创建请求拦截器
 */
export function createRequestInterceptor(config: RequestInterceptorConfig = {}) {
  const { useMock = USE_MOCK } = config

  return async (axiosConfig: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const config = axiosConfig as any

    // ========================================================================
    // MOCK MODE - 拦截请求并返回模拟数据
    // ========================================================================
    if (useMock) {
      logger.debug('🎭 [Mock Mode] 拦截请求:', config.method?.toUpperCase(), config.url)
      config._mockMode = true
      return config
    }
    // ========================================================================

    // ========================================================================
    // PERFORMANCE MONITORING - Record request start time
    // ========================================================================
    config._startTime = Date.now()

    // ========================================================================
    // CACHE VALIDATION HEADERS
    // ========================================================================
    if (config.method?.toUpperCase() === 'GET' && shouldCache(config.method, config.url || '')) {
      const cacheKey = generateCacheKey(config.url || '', config.params)
      config._cacheKey = cacheKey
      config._useCache = true

      // Add cache validation headers
      const cacheHeaders = getCacheValidationHeaders(config.url || '', config.params)
      Object.entries(cacheHeaders).forEach(([key, value]) => {
        config.headers[key] = value
      })

      if (Object.keys(cacheHeaders).length > 0) {
        logger.debug('📦 [API Cache] Validation headers added:', cacheHeaders)
      }
    }

    // ========================================================================
    // REQUEST ID (for error tracking and log correlation)
    // ========================================================================
    const requestId = generateRequestId()
    config.headers['X-Request-ID'] = requestId

    // ========================================================================
    // AUTHENTICATION TOKEN
    // ========================================================================
    const authStore = useAuthStore()
    const token = authStore.token

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
      logger.debug('🔐 [Auth] Token 已添加到请求头')
    } else {
      logger.debug('⚠️  [Auth] 未找到 Token,请求可能被拦截')
    }

    // 调试日志：请求开始
    logger.debug('🚀 [API Request]', {
      method: config.method?.toUpperCase(),
      url: config.url,
      requestId: requestId.substring(0, 8)
    })

    return config
  }
}

/**
 * 创建请求错误拦截器
 */
export function createRequestErrorInterceptor() {
  return (error: any) => {
    logger.error('❌ [Request Error]', error.message)

    // 如果是取消的请求,不显示错误
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
}
