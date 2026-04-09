// @ts-nocheck
/**
 * API健康检查工具
 * 用于诊断后端服务连接问题
 * Updated: 2026-02-10 - Fixed 401/403 handling
 */

import axios from 'axios'
import { logger } from '@/shared/lib/utils/logger'
import { ElNotification } from 'element-plus'
import { API_BASE_URL, API_TARGET, USE_MOCK } from '@/shared/config/api'
import { tokenManager } from '@/shared/lib/utils/tokenManager'

const backendDisplayTarget = API_TARGET || API_BASE_URL

// 创建一个不使用认证的axios实例，专门用于健康检查
const healthApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 增加超时时间到10秒，避免开发环境下的初始化延迟
  headers: {
    'Content-Type': 'application/json'
  }
})

async function probeEndpoint(url: string, timeout: number) {
  const token = tokenManager.getAccessToken()
  return healthApi.get(url, {
    timeout,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    // 健康检查只需要确认服务可达，2xx-4xx都认为服务正常
    validateStatus: status => status >= 200 && status < 500
  })
}

/**
 * 优先使用公开的健康检查端点，避免403错误
 */
const PREFERRED_HEALTH_ENDPOINTS = ['/auth/health', '/actuator/health']

export interface HealthCheckResult {
  service: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: Record<string, unknown>
  timestamp: Date
}

/**
 * 检查后端服务是否可用
 */
export async function checkBackendHealth(): Promise<HealthCheckResult> {
  logger.debug('🏥 [Health Check] 检查后端服务健康状态...')

  try {
    const response = await probeEndpoint('/organizations', 10000)

    if (response.status >= 200 && response.status < 300) {
      logger.debug('✅ [Health Check] 后端服务正常')
      return {
        service: 'Backend API',
        status: 'success',
        message: '后端服务运行正常',
        details: response.data,
        timestamp: new Date()
      }
    }

    if (response.status === 401 || response.status === 403) {
      logger.debug('✅ [Health Check] 健康检查端点需要认证，后端服务可达')
      return {
        service: 'Backend API',
        status: 'success',
        message: '后端服务运行正常（健康检查端点需要认证）',
        details: { status: response.status },
        timestamp: new Date()
      }
    }

    if (response.status === 404) {
      logger.warn('⚠️ [Health Check] /organizations 不存在，尝试降级验证服务可用性')
      try {
        const actuatorResponse = await probeEndpoint('/actuator/health', 3000)
        if (
          (actuatorResponse.status >= 200 && actuatorResponse.status < 300) ||
          actuatorResponse.status === 401 ||
          actuatorResponse.status === 403
        ) {
          return {
            service: 'Backend API',
            status: 'success',
            message: '后端服务可访问（使用 actuator 健康检查）',
            details: { status: 'accessible-actuator', code: actuatorResponse.status },
            timestamp: new Date()
          }
        }
      } catch {
        // actuator 在当前后端中可能被统一异常包装为 500，继续尝试轻量业务端点
      }

      try {
        const authValidateResponse = await probeEndpoint('/auth/validate', 3000)
        if (
          (authValidateResponse.status >= 200 && authValidateResponse.status < 300) ||
          authValidateResponse.status === 401 ||
          authValidateResponse.status === 403
        ) {
          return {
            service: 'Backend API',
            status: 'success',
            message: '后端服务可访问（健康检查端点不可用，但业务接口正常）',
            details: { status: 'accessible', code: authValidateResponse.status },
            timestamp: new Date()
          }
        }
      } catch {
        return {
          service: 'Backend API',
          status: 'warning',
          message: '后端服务可访问，但健康检查端点不存在',
          details: { status: 404 },
          timestamp: new Date()
        }
      }
    }

    // 如果业务端点未直接给出明确结果，再尝试公开健康检查端点
    for (const endpoint of PREFERRED_HEALTH_ENDPOINTS) {
      try {
        logger.debug(`🔍 [Health Check] 尝试公开端点: ${endpoint}`)
        const fallbackResponse = await probeEndpoint(endpoint, 5000)

        if (
          (fallbackResponse.status >= 200 && fallbackResponse.status < 300) ||
          fallbackResponse.status === 401 ||
          fallbackResponse.status === 403
        ) {
          logger.debug(`✅ [Health Check] 后端服务正常 (${endpoint})`)
          return {
            service: 'Backend API',
            status: 'success',
            message: '后端服务运行正常',
            details: fallbackResponse.data,
            timestamp: new Date()
          }
        }
      } catch (endpointError) {
        logger.debug(`⚠️ [Health Check] 端点 ${endpoint} 不可用，尝试下一个`)
      }
    }

    return {
      service: 'Backend API',
      status: 'warning',
      message: `后端服务已响应，但返回了异常状态码 ${response.status}`,
      details: {
        status: response.status,
        response: response.data
      },
      timestamp: new Date()
    }
  } catch (error: unknown) {
    const axiosError = axios.isAxiosError(error) ? error : null
    const errorCode = axiosError?.code
    const errorMessage =
      axiosError?.message || (error instanceof Error ? error.message : String(error))
    const responseStatus = axiosError?.response?.status
    const responseContentType = String(axiosError?.response?.headers?.['content-type'] || '')
    const responseData = axiosError?.response?.data as
      | { message?: string; code?: string }
      | string
      | undefined

    // Vite dev proxy may convert upstream ECONNREFUSED into an HTTP 500 with
    // empty/plain-text body. Treat it as backend unreachable instead of a
    // misleading server-side 500.
    const looksLikeProxyConnectionFailure =
      responseStatus === 500 &&
      responseContentType.includes('text/plain') &&
      (responseData === '' || responseData == null)

    // 处理超时错误
    if (errorCode === 'ECONNABORTED' && errorMessage.includes('timeout')) {
      logger.error('❌ [Health Check] 后端服务响应超时:', error)
      return {
        service: 'Backend API',
        status: 'error',
        message: '后端服务响应超时，可能正在启动或负载过高',
        details: { error: errorMessage, code: errorCode },
        timestamp: new Date()
      }
    }

    if (
      errorCode === 'ECONNREFUSED' ||
      errorMessage.includes('Network Error') ||
      looksLikeProxyConnectionFailure
    ) {
      logger.error('❌ [Health Check] 无法连接到后端服务:', error)
      return {
        service: 'Backend API',
        status: 'error',
        message: `无法连接到后端服务，请确认后端是否运行在 ${backendDisplayTarget}`,
        details: { error: errorMessage, code: errorCode },
        timestamp: new Date()
      }
    }

    // 提取后端返回的详细错误信息
    const detailedMessage =
      (typeof responseData === 'object' && responseData?.message) || errorMessage
    logger.error('❌ [Health Check] 后端服务异常:', error)

    return {
      service: 'Backend API',
      status: 'error',
      message: `后端服务异常: ${detailedMessage}`,
      details: {
        error: errorMessage,
        response: responseData,
        code:
          typeof responseData === 'object' && responseData !== null && 'code' in responseData
            ? (responseData as { code?: string }).code
            : undefined
      },
      timestamp: new Date()
    }
  }
}

/**
 * 快速检查后端连接（用于应用启动时）
 */
export async function quickBackendCheck(): Promise<boolean> {
  try {
    const response = await probeEndpoint('/organizations', 3000)

    if (response.status >= 200 && response.status < 300) {
      return true
    }

    if (response.status === 401 || response.status === 403) {
      return true
    }

    if (response.status === 404) {
      try {
        const actuatorResponse = await probeEndpoint('/actuator/health', 3000)
        return (
          (actuatorResponse.status >= 200 && actuatorResponse.status < 300) ||
          actuatorResponse.status === 401 ||
          actuatorResponse.status === 403
        )
      } catch {
        return false
      }
    }

    return false
  } catch (error: unknown) {
    return false
  }
}

/**
 * 显示后端连接状态通知
 */
export async function showBackendConnectionStatus() {
  const isConnected = await quickBackendCheck()

  if (isConnected) {
    logger.info('✅ [Backend Connection] 后端服务连接正常')

    if (import.meta.env.DEV) {
      ElNotification({
        title: '后端连接成功',
        message: '已成功连接到后端服务',
        type: 'success',
        duration: 3000,
        position: 'bottom-right'
      })
    }
  } else {
    logger.error('❌ [Backend Connection] 无法连接到后端服务')

    ElNotification({
      title: '后端连接失败',
      message: `无法连接到后端服务，请确认后端已启动在 ${backendDisplayTarget}`,
      type: 'error',
      duration: 0, // 不自动关闭
      position: 'bottom-right'
    })
  }

  return isConnected
}

/**
 * 测试认证流程
 */
export async function checkAuthFlow(credentials?: {
  username: string
  password: string
}): Promise<HealthCheckResult> {
  logger.debug('🔐 [Health Check] 测试认证流程...')

  if (!credentials) {
    return {
      service: 'Authentication',
      status: 'success',
      message: '未提供认证测试凭据，已跳过登录探测以避免干扰真实联调',
      details: { skipped: true },
      timestamp: new Date()
    }
  }

  const testCredentials = credentials

  try {
    const response = await healthApi.post('/auth/login', testCredentials)

    logger.debug('✅ [Health Check] 认证流程正常')
    logger.debug('📦 [Health Check] 登录响应:', response.data)

    // 检查响应格式
    const hasToken = !!(
      response.data?.token ||
      response.data?.data?.token ||
      response.data?.accessToken
    )

    if (hasToken) {
      return {
        service: 'Authentication',
        status: 'success',
        message: '认证流程正常，Token获取成功',
        details: {
          responseFormat: response.data,
          hasToken: true
        },
        timestamp: new Date()
      }
    } else {
      return {
        service: 'Authentication',
        status: 'warning',
        message: '认证请求成功，但响应格式可能不正确（未找到token）',
        details: {
          responseFormat: response.data,
          hasToken: false
        },
        timestamp: new Date()
      }
    }
  } catch (error: unknown) {
    logger.error('❌ [Health Check] 认证流程异常:', error)

    // Check both error.response.status and error.originalError.response.status
    // (error might be wrapped by interceptor)
    const status = error.response?.status || error.originalError?.response?.status
    logger.debug('🔍 [Health Check] Error response status:', status)

    if (status === 401) {
      return {
        service: 'Authentication',
        status: 'warning',
        message: '认证端点可访问，但凭据无效',
        details: { status: 401 },
        timestamp: new Date()
      }
    }

    if (status === 404) {
      return {
        service: 'Authentication',
        status: 'error',
        message: '认证端点不存在',
        details: { status: 404 },
        timestamp: new Date()
      }
    }

    return {
      service: 'Authentication',
      status: 'error',
      message: `认证流程异常: ${error.message}`,
      details: { error: error.message },
      timestamp: new Date()
    }
  }
}

/**
 * 完整的健康检查流程
 */
export async function runFullHealthCheck(): Promise<HealthCheckResult[]> {
  logger.debug('🏥 [Health Check] 开始完整健康检查...')

  const results: HealthCheckResult[] = []

  // 检查后端服务
  results.push(await checkBackendHealth())

  // 仅在显式提供测试凭据时才做认证探测，避免开发态使用错误默认密码污染日志
  if (results[0].status !== 'error') {
    results.push(await checkAuthFlow())
  }

  return results
}

/**
 * 在开发环境下自动运行健康检查
 */
export function autoHealthCheck() {
  if (import.meta.env.DEV && !USE_MOCK) {
    if (tokenManager.hasValidToken()) {
      logger.debug('🏥 [Health Check] 检测到已登录会话，跳过自动健康检查')
      return
    }

    logger.debug('🏥 [Health Check] 开发环境，自动运行健康检查...')

    // 延迟2秒执行，确保Vite代理服务器已完全初始化
    setTimeout(async () => {
      const results = await runFullHealthCheck()

      logger.info('🏥 健康检查报告')
      logger.info('整体状态:', results.every(r => r.status === 'success') ? '健康' : '有问题')
      logger.debug(
        '详细结果:',
        results.map(r => ({
          服务: r.service,
          状态: r.status,
          消息: r.message
        }))
      )

      // 如果有严重问题，显示警告
      const hasError = results.some(r => r.status === 'error')
      if (hasError) {
        logger.warn('⚠️ 检测到后端服务问题，请检查')
        logger.warn(`1. 后端服务是否运行在 ${backendDisplayTarget}`)
        logger.warn('2. 数据库连接是否正常')
        logger.warn('3. 查看后端日志获取详细错误信息')

        ElNotification({
          title: '后端服务异常',
          message: '检测到后端服务问题，请检查后端是否正常运行',
          type: 'error',
          duration: 0,
          position: 'bottom-right'
        })
      } else {
        ElNotification({
          title: '系统就绪',
          message: '前后端连接正常，所有服务运行正常',
          type: 'success',
          duration: 3000,
          position: 'bottom-right'
        })
      }
    }, 2000) // 增加延迟到2秒，给Vite代理更多初始化时间
  }
}
