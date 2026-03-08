/**
 * API健康检查工具
 * 用于诊断后端服务连接问题
 * Updated: 2026-02-10 - Fixed 401/403 handling
 */

import axios from 'axios'
import { logger } from '@/utils/logger'
import { ElNotification } from 'element-plus'

// 创建一个不使用认证的axios实例，专门用于健康检查
const healthApi = axios.create({
  baseURL: '/api',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
})

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
    // 尝试访问 Spring Boot Actuator 健康检查端点
    const response = await healthApi.get('/actuator/health', { timeout: 5000 })

    logger.debug('✅ [Health Check] 后端服务正常')
    return {
      service: 'Backend API',
      status: 'success',
      message: '后端服务运行正常',
      details: response.data,
      timestamp: new Date()
    }
  } catch (error: unknown) {
    logger.error('❌ [Health Check] 后端服务异常:', error)

    if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
      return {
        service: 'Backend API',
        status: 'error',
        message: '无法连接到后端服务，请确认后端是否运行在 http://localhost:8080',
        details: { error: error.message, code: error.code },
        timestamp: new Date()
      }
    }

    if (error.response?.status === 404) {
      // 如果 actuator/health 不存在，尝试其他端点来验证服务可用性
      try {
        await healthApi.get('/auth/login', { timeout: 3000 })
        return {
          service: 'Backend API',
          status: 'success',
          message: '后端服务可访问（健康检查端点不可用，但服务正常）',
          details: { status: 'accessible' },
          timestamp: new Date()
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

    // 403 表示端点存在但需要认证，这实际上意味着服务是正常的
    if (error.response?.status === 403) {
      return {
        service: 'Backend API',
        status: 'success',
        message: '后端服务运行正常（健康检查端点需要认证）',
        details: { status: 403 },
        timestamp: new Date()
      }
    }

    // 提取后端返回的详细错误信息
    const responseData = error.response?.data
    const detailedMessage = responseData?.message || error.message
    
    return {
      service: 'Backend API',
      status: 'error',
      message: `后端服务异常: ${detailedMessage}`,
      details: { 
        error: error.message, 
        response: responseData,
        code: responseData?.code
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
    // 尝试访问 Spring Boot Actuator 健康检查端点
    await healthApi.get('/actuator/health', { timeout: 3000 })
    return true
  } catch (error: unknown) {
    // 404 表示端点不存在但服务可访问
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number } }
      if (axiosError.response?.status === 404) {
        return true
      }
      // 401/403 表示需要认证但服务可访问
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        return true
      }
    }
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
      message: '无法连接到后端服务，请确认后端已启动在 http://localhost:8080',
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

  const testCredentials = credentials || {
    username: 'admin',
    password: '123456'
  }

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
  
  // 如果后端服务正常，检查认证流程
  if (results[0].status !== 'error') {
    results.push(await checkAuthFlow())
  }
  
  return results
}

/**
 * 在开发环境下自动运行健康检查
 */
export function autoHealthCheck() {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK !== 'true') {
    logger.debug('🏥 [Health Check] 开发环境，自动运行健康检查...')
    
    // 延迟1秒执行，确保应用已初始化
    setTimeout(async () => {
      const results = await runFullHealthCheck()
      
      logger.info('🏥 健康检查报告')
      logger.info('整体状态:', results.every(r => r.status === 'success') ? '健康' : '有问题')
      logger.debug('详细结果:', results.map(r => ({
        服务: r.service,
        状态: r.status,
        消息: r.message
      })))
      
      // 如果有严重问题，显示警告
      const hasError = results.some(r => r.status === 'error')
      if (hasError) {
        logger.warn('⚠️ 检测到后端服务问题，请检查')
        logger.warn('1. 后端服务是否运行在 http://localhost:8080')
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
    }, 1000)
  }
}