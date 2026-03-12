/**
 * Request Interceptors - 请求拦截器模块
 *
 * 职责:
 * - Mock 模式处理
 * - 性能监控
 * - 缓存验证头
 * - 请求 ID
 * - 认证 Token
 * - 请求签名
 * - 幂等性 Key
 *
 * @module api/interceptors
 */

import type { InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/features/auth/model/store'
import { generateSignature } from '@/utils/security'
import { logger } from '@/utils/logger'
import { addRequestId } from '@/shared/api/errorHandler'
import {
  generateIdempotencyKey,
  shouldAddIdempotencyKey,
  DEFAULT_IDEMPOTENCY_CONFIG
} from '@/utils/idempotency'
import {
  generateCacheKey,
  shouldCache,
  getCacheValidationHeaders
} from '@/utils/cache'

// 需要签名验证的敏感操作路径
const SENSITIVE_PATHS = ['/auth/password', '/indicators', '/tasks', '/milestones']

// Mock 模式配置
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/**
 * 请求拦截器配置
 */
export interface RequestInterceptorConfig {
  useMock?: boolean
  sensitivePaths?: string[]
}

/**
 * 创建请求拦截器
 */
export function createRequestInterceptor(config: RequestInterceptorConfig = {}) {
  const {
    useMock = USE_MOCK,
    sensitivePaths = SENSITIVE_PATHS
  } = config

  return async (axiosConfig: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const config = axiosConfig as InternalAxiosRequestConfig & {
      _mockMode?: boolean
      _startTime?: number
      _cacheKey?: string
      _useCache?: boolean
    }

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
    addRequestId(config)

    // 调试日志：请求开始
    logger.debug('🚀 [API Request]', {
      method: config.method?.toUpperCase(),
      url: config.url,
      params: config.params,
      data: config.data,
      requestId: config.headers['X-Request-ID']
    })

    // ========================================================================
    // AUTH TOKEN
    // ========================================================================
    const authStore = useAuthStore()

    // 优先从authStore读取token，如果不存在则从localStorage读取（解决时序问题）
    const storeToken = authStore.token
    const localToken = localStorage.getItem('token')
    const token = storeToken || localToken
    
    // Debug logging for token checks (development only)
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[RequestInterceptor] Token检查:', {
        url: config.url,
        hasStoreToken: !!storeToken,
        hasLocalToken: !!localToken,
        willUseToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
      })
    }
    
    logger.debug('🔍 [API Auth] Token检查:', {
      hasStoreToken: !!storeToken,
      hasLocalToken: !!localToken,
      willUseToken: !!token,
      url: config.url
    })
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[RequestInterceptor] ✅ Authorization头已添加:', config.url)
      }
      logger.debug('🔐 [API Auth] Token已添加', {
        source: storeToken ? 'authStore' : 'localStorage',
        tokenPreview: token.substring(0, 20) + '...',
        url: config.url
      })
    } else {
      console.warn('[RequestInterceptor] ⚠️ 无Token，未添加Authorization头:', config.url)
      logger.warn('⚠️ [API Auth] 无Token (authStore和localStorage都为空)', {
        url: config.url
      })
    }

    // ========================================================================
    // REQUEST SIGNATURE (for sensitive operations)
    // ========================================================================
    const isSensitive = sensitivePaths.some(path => config.url?.includes(path))
    const isWriteOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
      config.method?.toUpperCase() || ''
    )

    if (isSensitive && isWriteOperation) {
      const timestamp = Date.now()
      const signature = await generateSignature(config.data, timestamp)
      config.headers['X-Timestamp'] = timestamp.toString()
      config.headers['X-Signature'] = signature
      logger.debug('🔏 [API Security] 签名已添加')
    }

    // ========================================================================
    // IDEMPOTENCY KEY (for write operations on protected paths)
    // ========================================================================
    if (shouldAddIdempotencyKey(config.method, config.url || '', DEFAULT_IDEMPOTENCY_CONFIG)) {
      try {
        const idempotencyKey = await generateIdempotencyKey(
          config.method || 'POST',
          config.url || '',
          config.data
        )
        config.headers['X-Idempotency-Key'] = idempotencyKey
        logger.debug('🔑 [API Idempotency] Key已添加:', idempotencyKey.substring(0, 8) + '...')
      } catch (error) {
        logger.warn('⚠️ [API Idempotency] 生成Key失败:', error)
      }
    }

    return config
  }
}

/**
 * 创建请求错误拦截器
 */
export function createRequestErrorInterceptor() {
  return (error: unknown): Promise<never> => {
    logger.error('❌ [API Request Error]', error)
    return Promise.reject(error)
  }
}
