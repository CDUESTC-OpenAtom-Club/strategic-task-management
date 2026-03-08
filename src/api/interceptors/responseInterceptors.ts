/**
 * Response Interceptors - 响应拦截器模块
 *
 * 职责:
 * - Mock 模式响应处理
 * - 性能监控记录
 * - 缓存响应处理
 * - 响应格式统一化
 * - 错误处理和转换
 *
 * @module api/interceptors
 */

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { AxiosError } from 'axios'
import { logger } from '@/utils/logger'
import { recordApiLatency } from '@/utils/performance'
import { cacheManager } from '@/utils/cache'
import { transformError, toExtendedError } from '../errorHandler'
import type { ExtendedErrorInfo } from '@/types/error'
import { MockApiHandler } from '@/mock/handler'

// Mock 模式配置
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/**
 * 响应拦截器配置
 */
export interface ResponseInterceptorConfig {
  useMock?: boolean
}

/**
 * 创建响应成功拦截器
 */
export function createResponseInterceptor(config: ResponseInterceptorConfig = {}) {
  const { useMock: _useMock = USE_MOCK } = config

  return async (response: AxiosResponse): Promise<AxiosResponse> => {
    // ========================================================================
    // MOCK MODE - 返回模拟数据
    // ========================================================================
    if ((response.config as InternalAxiosRequestConfig & { _mockMode?: boolean })._mockMode) {
      logger.debug('🎭 [Mock Mode] 返回模拟响应')
      const mockResponse = await MockApiHandler.handleRequest(response.config)

      return {
        ...response,
        status: 200,
        statusText: 'OK',
        data: mockResponse
      }
    }
    // ========================================================================

    // ========================================================================
    // PERFORMANCE MONITORING
    // ========================================================================
    const startTime = response.config._startTime
    if (startTime) {
      const duration = Date.now() - startTime
      recordApiLatency(
        response.config.url || '',
        response.config.method || 'GET',
        duration,
        response.status,
        true
      )
    }

    // ========================================================================
    // CACHE RESPONSE HANDLING
    // ========================================================================
    if (response.config._useCache && response.config._cacheKey) {
      const cacheKey = response.config._cacheKey

      // Handle 304 Not Modified
      if (response.status === 304) {
        const cached = cacheManager.get(cacheKey)
        if (cached) {
          logger.debug('📦 [API Cache] 304 Not Modified, using cached data:', cacheKey)
          return { ...response, data: cached.data }
        }
      }

      // Cache the new response
      const etag = response.headers['etag']
      const lastModified = response.headers['last-modified']

      cacheManager.set(cacheKey, response.data, {
        etag,
        lastModified
      })

      logger.debug('📦 [API Cache] Cached response:', {
        key: cacheKey,
        etag: etag || 'none',
        lastModified: lastModified || 'none'
      })
    }

    // 调试日志：响应成功
    logger.debug('✅ [API Response]', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      requestId: response.config.headers['X-Request-ID'],
      cached: response.status === 304
    })

    // ========================================================================
    // RESPONSE FORMAT NORMALIZATION
    // ========================================================================
    const data = response.data

    // 格式1: { code: 0, data: {...}, message: "..." }
    if (data && typeof data === 'object' && 'code' in data) {
      logger.debug('📦 [API Format] 检测到格式1: { code, data, message }')
      if (data.code === 0) {
        return {
          ...response,
          data: {
            success: true,
            data: data.data,
            message: data.message
          }
        }
      } else {
        logger.error('❌ [API Business Error] code:', data.code, 'message:', data.message)
        throw new Error(data.message || 'Request failed')
      }
    }

    // 格式2: { success: true, data: {...} }
    if (data && typeof data === 'object' && 'success' in data) {
      logger.debug('📦 [API Format] 检测到格式2: { success, data }')
      return response
    }

    // 格式3: 直接返回数据
    logger.debug('📦 [API Format] 检测到格式3: 直接返回数据')
    return {
      ...response,
      data: {
        success: true,
        data: data
      }
    }
  }
}

/**
 * 创建响应错误拦截器
 */
export function createResponseErrorInterceptor(config: ResponseInterceptorConfig = {}) {
  const { useMock = USE_MOCK } = config

  return async (error: AxiosError): Promise<never> => {
    // ========================================================================
    // MOCK MODE - 拦截错误并返回模拟数据
    // ========================================================================
    if (useMock && error.config) {
      logger.debug('🎭 [Mock Mode] 拦截错误请求:', error.config.method?.toUpperCase(), error.config.url)

      const mockResponse = await MockApiHandler.handleRequest(error.config)
      return {
        ...error,
        status: 200,
        statusText: 'OK',
        data: mockResponse
      } as unknown as never
    }
    // ========================================================================

    // ========================================================================
    // PERFORMANCE MONITORING
    // ========================================================================
    const startTime = error.config?._startTime
    if (startTime) {
      const duration = Date.now() - startTime
      recordApiLatency(
        error.config?.url || '',
        error.config?.method || 'GET',
        duration,
        error.response?.status,
        false
      )
    }

    // 调试日志：响应错误
    logger.error('❌ [API Response Error]', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      code: error.code,
      requestId: error.config?.headers?.['X-Request-ID']
    })

    // ========================================================================
    // BACKEND CONNECTION ERROR HANDLING
    // ========================================================================
    // 检查是否为后端连接错误（无响应）
    if (!error.response && error.request) {
      logger.error('🔌 [Backend Connection] 无法连接到后端服务')
      logger.error('🔍 [Backend Connection] 请检查:')
      logger.error('   1. 后端服务是否运行在 http://localhost:8080')
      logger.error('   2. 数据库连接是否正常')
      logger.error('   3. 防火墙或代理设置是否阻止连接')
      
      // 显示用户友好的错误提示
      const { ElMessage } = await import('element-plus')
      ElMessage.error({
        message: '无法连接到后端服务，请确认后端服务已启动',
        duration: 5000,
        showClose: true
      })
    }

    // ========================================================================
    // NETWORK TIMEOUT ERROR HANDLING
    // ========================================================================
    // 检查是否为超时错误
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      logger.error('⏱️ [Network Timeout] 请求超时')
      
      const { ElMessage } = await import('element-plus')
      ElMessage.warning({
        message: '请求超时，请检查网络连接或稍后重试',
        duration: 4000,
        showClose: true
      })
    }

    // ========================================================================
    // 401 AUTH ERROR HANDLING WITH AUTO REFRESH
    // ========================================================================
    if (error.response?.status === 401) {
      logger.warn('🔒 [API Auth] 401 未授权')
      
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
      const isLoginRequest = originalRequest?.url?.includes('/auth/login')
      const isRefreshRequest = originalRequest?.url?.includes('/auth/refresh')
      
      // 登录和刷新请求失败，直接返回错误（不尝试刷新）
      if (isLoginRequest || isRefreshRequest) {
        logger.debug('🔒 [API Auth] 登录/刷新请求失败，不尝试刷新')
        return Promise.reject(error)
      }
      
      // 防止重复刷新（如果已经尝试过刷新但仍然失败）
      if (originalRequest._retry) {
        logger.warn('🔒 [API Auth] Token 刷新后仍然失败，跳转登录')
        
        const { useAuthStore } = await import('@/stores/auth')
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
        
        return Promise.reject(error)
      }
      
      // 标记为已重试，防止无限循环
      originalRequest._retry = true
      
      try {
        logger.debug('🔄 [API Auth] 尝试刷新 Token...')
        
        // 刷新 Token
        const { tokenManager } = await import('@/utils/tokenManager')
        const newToken = await tokenManager.refreshAccessToken()
        
        logger.debug('✅ [API Auth] Token 刷新成功，重试原请求')
        
        // 更新 auth store 中的 token
        const { useAuthStore } = await import('@/stores/auth')
        const authStore = useAuthStore()
        authStore.token = newToken
        
        // 同步到 localStorage（确保刷新后状态一致）
        localStorage.setItem('token', newToken)
        
        // 更新原请求的 Authorization 头
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        
        // 重新发起原请求
        const axios = (await import('axios')).default
        return axios.request(originalRequest)
        
      } catch (refreshError) {
        logger.error('❌ [API Auth] Token 刷新失败:', refreshError)
        
        // 刷新失败，清除登录状态
        const { useAuthStore } = await import('@/stores/auth')
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
        
        return Promise.reject(refreshError)
      }
    }

    // ========================================================================
    // 403 FORBIDDEN ERROR HANDLING
    // ========================================================================
    if (error.response?.status === 403) {
      logger.warn('🚫 [API Auth] 403 权限不足')
      
      // 不要为健康检查请求显示错误通知（403是预期的）
      const isHealthCheck = error.config?.url?.includes('/actuator/health') ||
                           error.config?.url?.includes('/orgs') ||
                           error.config?.url?.includes('/indicators') ||
                           error.config?.url?.includes('/tasks') ||
                           error.config?.url?.includes('/milestones')
      
      // 检查是否是健康检查发起的请求（通过请求头标记）
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

    // ========================================================================
    // 500 SERVER ERROR HANDLING
    // ========================================================================
    if (error.response?.status === 500) {
      logger.error('💥 [Server Error] 服务器内部错误')
      
      const { ElMessage } = await import('element-plus')
      ElMessage.error({
        message: '服务器内部错误，请稍后重试或联系管理员',
        duration: 5000,
        showClose: true
      })
    }

    // ========================================================================
    // UNIFIED ERROR HANDLING
    // ========================================================================
    const apiError = transformError(error)
    const extendedError: ExtendedErrorInfo = toExtendedError(apiError, error)

    logger.error('❌ [API Error] 统一错误格式:', {
      code: extendedError.code,
      message: extendedError.message,
      requestId: extendedError.requestId,
      severity: extendedError.severity,
      retryable: extendedError.retryable
    })

    return Promise.reject(extendedError)
  }
}
